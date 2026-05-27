import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto/secrets";
import { loadAIMenuSnapshot } from "@/lib/ai/menu-snapshot";
import { buildSystemPrompt, streamGeminiChat, toGeminiHistory } from "@/lib/ai/gemini-advisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  tenant_slug: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().min(1).max(4000),
      }),
    )
    .max(40),
  message: z.string().min(1).max(2000),
  recent_orders: z
    .array(
      z.object({
        orderNumber: z.union([z.string(), z.number()]).optional(),
        createdAt: z.string(),
        items: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
      }),
    )
    .max(5)
    .optional(),
  current_cart: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().int(),
        sizeName: z.string().nullable().optional(),
        options: z.array(z.string()).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch (err) {
    const e = err as { issues?: Array<{ path: (string | number)[]; message: string }> };
    const first = e?.issues?.[0];
    return apiError("validation_error", first?.message ?? "invalid body", 422);
  }

  const tenant = await resolveTenantBySlug(body.tenant_slug);
  if (!tenant) return apiError("not_found", "חנות לא נמצאה", 404);

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { aiAdvisorEnabled: true, aiGeminiApiKey: true, name: true },
  });
  if (!tenantRow?.aiAdvisorEnabled || !tenantRow.aiGeminiApiKey) {
    return apiError("ai_disabled", "היועץ אינו מופעל בחנות זו", 403);
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(tenantRow.aiGeminiApiKey);
  } catch {
    return apiError("ai_misconfigured", "מפתח שגוי בהגדרות החנות", 500);
  }

  const session = await getSession();
  const customerName =
    session?.type === "customer"
      ? await prisma.customer
          .findUnique({ where: { id: session.userId }, select: { firstName: true } })
          .then((c) => c?.firstName ?? null)
      : null;

  const menu = await loadAIMenuSnapshot(tenant.id);

  const systemInstruction = buildSystemPrompt({
    menu,
    recentOrders: body.recent_orders ?? [],
    currentCart: body.current_cart ?? [],
    customerName,
  });

  const history = toGeminiHistory(body.messages);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const event of streamGeminiChat({
          apiKey,
          systemInstruction,
          history,
          message: body.message,
        })) {
          write(event);
        }
      } catch (err) {
        write({
          kind: "error",
          error: err instanceof Error ? err.message : "stream failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
