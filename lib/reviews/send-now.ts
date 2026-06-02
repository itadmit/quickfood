/**
 * Shared review-reminder send.
 *
 * Used by:
 *   1. The QStash job (`/api/internal/jobs/send-review-reminder`) on the
 *      scheduled delay after `delivered`.
 *   2. The manual "שלח ביקורת עכשיו" button in the merchant's Orders →
 *      History page (`/api/v1/merchant/orders/[id]/send-review-now`).
 *
 * Same skip checks for both paths so the manual button doesn't double-send
 * if the customer was already reminded.
 */

import { prisma } from "@/lib/db/client";
import { sendSms } from "@/lib/sms/send";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { sendEmail } from "@/lib/email/send";
import { reviewReminderEmail } from "@/lib/email/templates";
import { signReviewToken } from "@/lib/reviews/token";

export type SendReviewResult =
  | { ok: true; channel: "email" | "sms" | "whatsapp"; providerStatus?: string }
  | { ok: false; reason: string };

interface SendOpts {
  /** Force-skip the "already-reminded" check. Always false for QStash
   *  (idempotent at the QStash dedup layer). True from the manual
   *  button after the merchant confirms the resend. */
  allowResend?: boolean;
}

export async function sendReviewReminderNow(
  orderId: string,
  opts: SendOpts = {},
): Promise<SendReviewResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      reviewPromptDismissedAt: true,
      review: { select: { id: true } },
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          reviewsEnabled: true,
          reviewsChannel: true,
        },
      },
      customer: {
        select: { id: true, phone: true, email: true, firstName: true },
      },
    },
  });

  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "delivered") return { ok: false, reason: "not_delivered" };
  if (order.review) return { ok: false, reason: "already_reviewed" };
  if (order.reviewPromptDismissedAt && !opts.allowResend) {
    return { ok: false, reason: "dismissed" };
  }
  if (!order.tenant.reviewsEnabled) return { ok: false, reason: "reviews_disabled" };
  if (order.tenant.reviewsChannel === "off") {
    return { ok: false, reason: "channel_off" };
  }
  if (!order.customer) return { ok: false, reason: "guest_order" };

  if (!opts.allowResend) {
    // QStash path: bail if a successful reminder was already logged.
    const sent = await prisma.smsLog.findFirst({
      where: {
        tenantId: order.tenant.id,
        kind: "review_reminder",
        refKind: "order",
        refId: order.id,
        status: "sent",
      },
      select: { id: true },
    });
    if (sent) return { ok: false, reason: "already_sent" };
    const emailSent = await prisma.emailLog.findFirst({
      where: {
        tenantId: order.tenant.id,
        kind: "review_reminder",
        refKind: "order",
        refId: order.id,
        status: "sent",
      },
      select: { id: true },
    });
    if (emailSent) return { ok: false, reason: "already_sent" };
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const token = signReviewToken(order.id);
  const link = `${base}/s/${order.tenant.slug}/orders/${order.id}?t=${encodeURIComponent(token)}#review`;
  const hello = order.customer.firstName?.trim() || "שלום";

  if (order.tenant.reviewsChannel === "email") {
    if (!order.customer.email) {
      return { ok: false, reason: "no_email_on_customer" };
    }
    const { html, text } = reviewReminderEmail({
      hello,
      businessName: order.tenant.name,
      reviewUrl: link,
    });
    const result = await sendEmail({
      tenantId: order.tenant.id,
      to: order.customer.email,
      subject: `איך הייתה ההזמנה מ-${order.tenant.name}?`,
      body: text,
      html,
      fromName: order.tenant.name,
      kind: "review_reminder",
      refKind: "order",
      refId: order.id,
    });
    return { ok: true, channel: "email", providerStatus: result.status };
  }

  const shortBody = `${hello}, איך הייתה ההזמנה מ-${order.tenant.name}?
דקה לדרג: ${link}`;

  if (order.tenant.reviewsChannel === "whatsapp") {
    const result = await sendWhatsApp({
      tenantId: order.tenant.id,
      to: order.customer.phone,
      body: shortBody,
      kind: "review_reminder",
      refKind: "order",
      refId: order.id,
    });
    return { ok: true, channel: "whatsapp", providerStatus: result.status };
  }

  const result = await sendSms({
    tenantId: order.tenant.id,
    to: order.customer.phone,
    body: shortBody,
    kind: "review_reminder",
    refKind: "order",
    refId: order.id,
  });
  return { ok: true, channel: "sms", providerStatus: result.status };
}
