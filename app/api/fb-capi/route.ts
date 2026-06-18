import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { sendCapiEvent, readFbCookies } from "@/lib/fb/capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  eventName: z.string().trim().min(1).max(60),
  eventId: z.string().trim().min(1).max(120).optional(),
  eventSourceUrl: z.string().trim().url().max(2000).optional(),
  params: z.record(z.string(), z.unknown()).optional().default({}),
  user: z
    .object({
      email: z.string().trim().email().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
});

export const POST = handler(async (req: Request) => {
  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") {
    throw apiError("bad_request", "invalid body", 400);
  }
  const body = BodySchema.parse(raw);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  const { fbp, fbc } = readFbCookies(req.headers.get("cookie"));

  const result = await sendCapiEvent({
    eventName: body.eventName,
    eventId: body.eventId,
    eventSourceUrl: body.eventSourceUrl,
    params: body.params,
    email: body.user?.email,
    phones: [body.user?.phone],
    fbp,
    fbc,
    clientIp: ip,
    clientUserAgent: ua,
  });

  if (result.skipped) return apiJson({ ok: false, skipped: result.skipped });
  if (!result.ok) throw apiError("capi_failed", "conversions api rejected", 502);
  return apiJson({ ok: true, fb: result.fb });
});
