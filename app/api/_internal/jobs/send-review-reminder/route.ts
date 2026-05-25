/**
 * QStash-invoked job: send a review reminder for a delivered order.
 *
 * Flow:
 *  1. QStash POSTs here with `{ orderId }` after the tenant's configured delay.
 *  2. We verify the QStash signature on the raw request body.
 *  3. Skip if the order was already reviewed, the prompt was dismissed, the
 *     tenant disabled reviews, or the channel is `off`.
 *  4. Send via email, SMS, or WhatsApp depending on `tenant.reviewsChannel`.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { verifySignature } from "@/lib/qstash/client";
import { sendSms } from "@/lib/sms/send";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { sendEmail } from "@/lib/email/send";

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

  if (!order) return apiJson({ ok: true, skipped: "order_not_found" });
  if (order.status !== "delivered") return apiJson({ ok: true, skipped: "not_delivered" });
  if (order.review) return apiJson({ ok: true, skipped: "already_reviewed" });
  if (order.reviewPromptDismissedAt) return apiJson({ ok: true, skipped: "dismissed" });
  if (!order.tenant.reviewsEnabled) return apiJson({ ok: true, skipped: "reviews_disabled" });
  if (order.tenant.reviewsChannel === "off") {
    return apiJson({ ok: true, skipped: "channel_off" });
  }
  if (!order.customer) return apiJson({ ok: true, skipped: "guest_order" });

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const link = `${base}/s/${order.tenant.slug}/orders/${order.id}#review`;
  const hello = order.customer.firstName?.trim() || "שלום";

  if (order.tenant.reviewsChannel === "email") {
    if (!order.customer.email) {
      return apiJson({ ok: true, skipped: "no_email_on_customer" });
    }
    const subject = `איך הייתה ההזמנה מ-${order.tenant.name}?`;
    const body = `${hello}, תודה שהזמנת מ-${order.tenant.name}.

נשמח לשמוע איך היה — דקה אחת:
${link}

ב-תיאבון!
${order.tenant.name}`;
    const result = await sendEmail({
      tenantId: order.tenant.id,
      to: order.customer.email,
      subject,
      body,
      fromName: order.tenant.name,
      kind: "review_reminder",
      refKind: "order",
      refId: order.id,
    });
    return apiJson({ ok: true, channel: "email", result });
  }

  // SMS / WhatsApp share the same short body and tenant credit pool. The
  // only difference is which provider relays it to the customer.
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
    return apiJson({ ok: true, channel: "whatsapp", result });
  }

  // SMS (default)
  const result = await sendSms({
    tenantId: order.tenant.id,
    to: order.customer.phone,
    body: shortBody,
    kind: "review_reminder",
    refKind: "order",
    refId: order.id,
  });
  return apiJson({ ok: true, channel: "sms", result });
});
