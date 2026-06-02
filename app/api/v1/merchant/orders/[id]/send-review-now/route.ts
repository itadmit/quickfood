/**
 * POST /api/v1/merchant/orders/[id]/send-review-now
 *
 * Manual "send the review reminder now" button on the Orders History page.
 * Uses the same `sendReviewReminderNow()` helper as the QStash-scheduled
 * job — so the skip checks (not delivered, already reviewed, channel off,
 * guest order, no email on customer) stay aligned between the two paths.
 *
 * `allowResend: true` lets the merchant retry an order whose first
 * delivery was dismissed or never landed — we already bail on `review`
 * being set, so they can't spam someone who has already rated.
 */

import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { sendReviewReminderNow } from "@/lib/reviews/send-now";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HUMAN_REASONS: Record<string, string> = {
  order_not_found: "הזמנה לא נמצאה",
  not_delivered: "ניתן לשלוח רק להזמנה שנמסרה",
  already_reviewed: "כבר התקבלה ביקורת על ההזמנה",
  reviews_disabled: "ביקורות לקוחות כבויות בהגדרות",
  channel_off: "ערוץ הביקורות כבוי בהגדרות",
  whatsapp_managed_inactive: "מנוי ווטסאפ ביקורות אינו פעיל — הפעל את המנוי כדי לשלוח",
  guest_order: "אין ללקוח טלפון/חשבון — לא ניתן לשלוח",
  no_email_on_customer: "אין מייל ללקוח — בחר ערוץ SMS/וואטסאפ או בקש מייל",
  dismissed: "הלקוח דחה את הבקשה לדרג",
  already_sent: "כבר נשלחה ביקורת על ההזמנה",
};

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    const { id: orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { tenantId: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    const result = await sendReviewReminderNow(orderId, { allowResend: true });
    if (!result.ok) {
      const msg = HUMAN_REASONS[result.reason] ?? result.reason;
      return apiError("send_skipped", msg, 422);
    }

    return apiJson({
      ok: true,
      channel: result.channel,
      provider_status: result.providerStatus ?? null,
    });
  },
);
