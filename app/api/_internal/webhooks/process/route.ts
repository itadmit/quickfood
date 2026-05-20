import { handler, apiJson, apiError } from "@/lib/api-response";
import { processPending } from "@/lib/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron entrypoint — runs every minute (configured in vercel.json).
 * Also callable manually with CRON_SECRET in Authorization header for testing.
 */
export const GET = handler(async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return apiError("forbidden", "invalid cron secret", 403);
    }
  }
  const result = await processPending();
  return apiJson({ ok: true, ...result });
});
