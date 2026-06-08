import crypto from "node:crypto";
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { FB_PIXEL_ID, FB_GRAPH_VERSION } from "@/lib/fb/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
const TEST_CODE = process.env.FB_CAPI_TEST_EVENT_CODE;

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

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export const POST = handler(async (req: Request) => {
  if (!TOKEN || !FB_PIXEL_ID) {
    return apiJson({ ok: false, skipped: "not_configured" });
  }

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

  const cookie = req.headers.get("cookie") ?? "";
  const fbp = /(?:^|;\s*)_fbp=([^;]+)/.exec(cookie)?.[1];
  const fbc = /(?:^|;\s*)_fbc=([^;]+)/.exec(cookie)?.[1];

  const user_data: Record<string, unknown> = {};
  if (body.user?.email) user_data.em = [sha256(body.user.email.toLowerCase())];
  if (body.user?.phone) {
    const p = normalizePhone(body.user.phone);
    if (p) user_data.ph = [sha256(p)];
  }
  if (ip) user_data.client_ip_address = ip;
  if (ua) user_data.client_user_agent = ua;
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: body.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId,
        event_source_url: body.eventSourceUrl,
        action_source: "website",
        user_data,
        custom_data: body.params,
      },
    ],
  };
  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  const res = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${FB_PIXEL_ID}/events?access_token=${TOKEN}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const fb = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw apiError("capi_failed", "conversions api rejected", 502);
  return apiJson({ ok: true, fb });
});
