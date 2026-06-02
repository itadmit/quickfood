/**
 * QStash-invoked job: send a review reminder for a delivered order.
 *
 * The actual send is in `lib/reviews/send-now.ts` so the manual
 * merchant-side "שלח ביקורת עכשיו" button reuses the exact same
 * skip checks + channel routing.
 *
 * Flow:
 *  1. QStash POSTs here with `{ orderId }` after the tenant's delay.
 *  2. We verify the QStash signature on the raw request body.
 *  3. Delegate to sendReviewReminderNow() — with allowResend=false so
 *     the helper bails if the row was already sent (e.g. the merchant
 *     hit the manual button before the timer fired).
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifySignature } from "@/lib/qstash/client";
import { sendReviewReminderNow } from "@/lib/reviews/send-now";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const rawBody = await req.text();
  const ok = await verifySignature(req, rawBody);
  if (!ok) {
    return apiError("unauthorized", "invalid qstash signature", 401);
  }

  const { orderId } = JSON.parse(rawBody) as { orderId: string };
  if (!orderId) return apiError("bad_request", "missing orderId", 400);

  const result = await sendReviewReminderNow(orderId, { allowResend: false });
  if (!result.ok) {
    return apiJson({ ok: true, skipped: result.reason });
  }
  return apiJson({ ok: true, channel: result.channel, status: result.providerStatus });
});
