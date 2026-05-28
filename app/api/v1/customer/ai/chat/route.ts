import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto/secrets";
import { loadAIMenuSnapshot } from "@/lib/ai/menu-snapshot";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { streamAdvisorChat } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unicode ranges for the Arabic script. Hebrew customers expect Hebrew —
// the model occasionally slips into Arabic for cuisine-adjacent prompts
// (falafel, shawarma) and we strip it server-side as a safety net.
// Covers: Arabic (0600-06FF), Arabic Supplement (0750-077F),
// Arabic Extended-A (08A0-08FF), Presentation Forms-A (FB50-FDFF),
// Presentation Forms-B (FE70-FEFF).
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g;
function stripArabic(s: string): string {
  return s.replace(ARABIC_RE, "");
}

const Schema = z.object({
  tenant_slug: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(4000),
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
  cart_subtotal: z.number().int().nonnegative().optional(),
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
    select: {
      aiAdvisorEnabled: true,
      aiProvider: true,
      aiGeminiApiKey: true,
      aiClaudeApiKey: true,
      name: true,
    },
  });
  if (!tenantRow?.aiAdvisorEnabled) {
    return apiError("ai_disabled", "היועץ אינו מופעל בחנות זו", 403);
  }

  const provider = tenantRow.aiProvider;
  const encryptedKey =
    provider === "claude" ? tenantRow.aiClaudeApiKey : tenantRow.aiGeminiApiKey;
  if (!encryptedKey) {
    return apiError("ai_disabled", "לא הוגדר מפתח לספק הנבחר", 403);
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
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

  const [menu, primaryBranch] = await Promise.all([
    loadAIMenuSnapshot(tenant.id),
    prisma.branch.findFirst({
      where: { tenantId: tenant.id, isPrimary: true },
      select: { minOrder: true },
    }),
  ]);

  const { systemInstruction, idMap } = buildSystemPrompt({
    menu,
    recentOrders: body.recent_orders ?? [],
    currentCart: body.current_cart ?? [],
    customerName,
    minOrder: primaryBranch?.minOrder ?? 0,
    cartSubtotal: body.cart_subtotal,
  });

  const trimmedMessages = body.messages
    .filter((m) => m.text.trim().length > 0)
    .slice(-6);
  const firstUserIdx = trimmedMessages.findIndex((m) => m.role === "user");
  const conversation = firstUserIdx === -1 ? [] : trimmedMessages.slice(firstUserIdx);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        for await (const event of streamAdvisorChat({
          provider,
          apiKey,
          systemInstruction,
          messages: conversation,
          message: body.message,
          idMap,
        })) {
          // Defense-in-depth: even though the system prompt forbids Arabic,
          // strip any Arabic-script codepoints from streamed text before
          // forwarding to the client. Covers Arabic, Arabic Supplement,
          // Arabic Extended-A, Arabic Presentation Forms-A/B.
          const sanitized =
            event.kind === "text" && typeof event.text === "string"
              ? { ...event, text: stripArabic(event.text) }
              : event;
          write(sanitized);
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
