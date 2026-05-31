import { handler, apiJson, apiError } from "@/lib/api-response";
import { processPending } from "@/lib/webhooks/dispatcher";
import { verifySignature } from "@/lib/qstash/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook dispatcher tick.
 *
 * Triggered by a QStash schedule (registered via `scripts/register-qstash-schedules.ts`)
 * that POSTs here every minute. Two auth paths:
 *
 *   • POST with `upstash-signature` — verified against QSTASH_*_SIGNING_KEY.
 *   • GET/POST with `Authorization: Bearer <CRON_SECRET>` — manual ping for
 *     local dev or one-off retries. CRON_SECRET must be set to enable this path.
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

  const result = await processPending();
  return apiJson({ ok: true, ...result });
}

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  return run(req, rawBody);
});

// Keep GET working for manual curl tests with CRON_SECRET.
export const GET = handler(async (req: Request) => run(req, ""));
