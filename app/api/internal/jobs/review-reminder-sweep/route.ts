import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifySignature } from "@/lib/qstash/client";
import { sweepMissedReviewReminders } from "@/lib/reviews/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run(req: Request, rawBody: string): Promise<Response> {
  if (req.headers.get("upstash-signature")) {
    const ok = await verifySignature(req, rawBody);
    if (!ok) return apiError("unauthorized", "invalid qstash signature", 401);
  } else {
    const secret = process.env.CRON_SECRET;
    if (!secret) return apiError("forbidden", "CRON_SECRET not set; refusing unsigned call", 403);
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return apiError("forbidden", "invalid cron secret", 403);
    }
  }
  const result = await sweepMissedReviewReminders();
  return apiJson({ ok: true, ...result });
}

export const POST = handler(async (req: Request) => run(req, await req.text()));
export const GET = handler(async (req: Request) => run(req, ""));
