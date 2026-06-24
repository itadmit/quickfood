import { handler, apiJson, apiError } from "@/lib/api-response";
import {
  issueBirthdayCoupons,
  purgeExpiredBirthdayCoupons,
} from "@/lib/loyalty/birthday";
import { verifySignature } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily birthday-coupon tick. Registered as a QStash schedule (see
 * scripts/register-qstash-schedules.ts). Same dual auth as the webhook
 * dispatcher:
 *   • POST with `upstash-signature` - verified against QSTASH_*_SIGNING_KEY.
 *   • GET/POST with `Authorization: Bearer <CRON_SECRET>` - manual trigger.
 */
async function run(req: Request, rawBody: string): Promise<Response> {
  const sigHeader = req.headers.get("upstash-signature");
  if (sigHeader) {
    const ok = await verifySignature(req, rawBody);
    if (!ok) return apiError("unauthorized", "invalid qstash signature", 401);
  } else {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return apiError("forbidden", "CRON_SECRET not set; refusing unsigned call", 403);
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return apiError("forbidden", "invalid cron secret", 403);
    }
  }

  const result = await issueBirthdayCoupons();
  const purged = await purgeExpiredBirthdayCoupons();
  return apiJson({ ok: true, ...result, purgedExpired: purged });
}

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  return run(req, rawBody);
});

export const GET = handler(async (req: Request) => run(req, ""));
