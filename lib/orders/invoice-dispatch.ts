/**
 * Invoice dispatch — once Grow's async invoice callback lands, send the
 * customer a link to download the tax invoice / receipt via SMS (phone
 * collected at the kiosk start) and/or email (collected later on the
 * PayPage fallback).
 *
 * Idempotent on a per-channel basis: we stamp `OrderEvent` rows so a
 * retry of the callback doesn't double-send. Safe to call multiple
 * times (e.g. when the customer adds an email AFTER the invoice has
 * already been generated — phone send may have already gone out, email
 * goes now).
 */

import { prisma } from "@/lib/db/client";
import { sendSms } from "@/lib/sms/send";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { sendEmail } from "@/lib/email/send";
import { renderRtlEmail } from "@/lib/email/templates";

export interface DispatchInvoiceResult {
  whatsapp?: "sent" | "skipped" | "failed";
  sms?: "sent" | "skipped" | "failed";
  email?: "sent" | "skipped" | "failed";
}

const WHATSAPP_EVENT = "invoice_whatsapp_sent";
const SMS_EVENT = "invoice_sms_sent";
const EMAIL_EVENT = "invoice_email_sent";

export async function dispatchInvoice(
  orderId: string,
): Promise<DispatchInvoiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      tenantId: true,
      invoiceUrl: true,
      invoiceNumber: true,
      customerPhoneSnap: true,
      customerEmailSnap: true,
      customerId: true,
      tenant: { select: { name: true } },
    },
  });
  if (!order) return {};
  if (!order.invoiceUrl) return {};

  const result: DispatchInvoiceResult = {};

  const bodyForPhone =
    `${order.tenant.name}: חשבונית מס/קבלה להזמנה #${order.number}` +
    (order.invoiceNumber ? ` (חשבונית ${order.invoiceNumber})` : "") +
    `: ${order.invoiceUrl}`;

  // Phone delivery — prefer WhatsApp (cheaper + richer link preview).
  // sendWhatsApp auto-falls-back to the platform-default iBot account
  // when the tenant hasn't connected one of their own, so we always
  // attempt it first. Only if WhatsApp returns not_configured / failed
  // do we drop to SMS via sms4free. Both paths are tracked under
  // separate OrderEvent types so a successful WhatsApp doesn't block
  // a later SMS retry (and vice versa).
  if (order.customerPhoneSnap) {
    const waAlready = await prisma.orderEvent.findFirst({
      where: { orderId, type: WHATSAPP_EVENT },
      select: { id: true },
    });
    const smsAlready = await prisma.orderEvent.findFirst({
      where: { orderId, type: SMS_EVENT },
      select: { id: true },
    });

    let waSent = false;
    if (!waAlready && !smsAlready) {
      try {
        const wa = await sendWhatsApp({
          tenantId: order.tenantId,
          to: order.customerPhoneSnap,
          body: bodyForPhone,
          kind: "invoice_delivery",
          refKind: "order",
          refId: orderId,
        });
        result.whatsapp =
          wa.status === "sent"
            ? "sent"
            : wa.status === "not_configured"
              ? "skipped"
              : wa.status === "failed"
                ? "failed"
                : "skipped";
        waSent = wa.status === "sent";
        await prisma.orderEvent.create({
          data: {
            orderId,
            type: WHATSAPP_EVENT,
            payload: {
              to_masked: maskPhone(order.customerPhoneSnap),
              status: wa.status,
              provider_msg: wa.providerMsg ?? null,
            },
          },
        });
      } catch (err) {
        console.error("[invoice-dispatch] whatsapp failed", err);
        result.whatsapp = "failed";
      }
    }

    // SMS fallback — runs when WhatsApp didn't actually deliver (not
    // configured, no balance, invalid recipient, or a transport error).
    if (!waSent && !smsAlready) {
      try {
        const sms = await sendSms({
          tenantId: order.tenantId,
          to: order.customerPhoneSnap,
          body: bodyForPhone,
          kind: "invoice_delivery",
          refKind: "order",
          refId: orderId,
        });
        result.sms = sms.status === "sent" ? "sent" : "skipped";
        await prisma.orderEvent.create({
          data: {
            orderId,
            type: SMS_EVENT,
            payload: {
              to_masked: maskPhone(order.customerPhoneSnap),
              status: sms.status,
              provider_msg: sms.providerMsg ?? null,
            },
          },
        });
      } catch (err) {
        console.error("[invoice-dispatch] sms failed", err);
        result.sms = "failed";
      }
    }
  }

  // Email path — first source of truth is what the customer typed on
  // PayPage (customerEmailSnap). If empty, try the linked Customer
  // row's email — they may have ordered from the website before and we
  // already have it on file (the kiosk lookup endpoint won't return it
  // to the client, but server-side dispatch may use it freely).
  let emailRecipient = order.customerEmailSnap;
  if (!emailRecipient && order.customerId) {
    const linked = await prisma.customer.findUnique({
      where: { id: order.customerId },
      select: { email: true },
    });
    emailRecipient = linked?.email ?? null;
  }
  if (emailRecipient) {
    const already = await prisma.orderEvent.findFirst({
      where: { orderId, type: EMAIL_EVENT },
      select: { id: true },
    });
    if (!already) {
      try {
        const { html, text } = renderRtlEmail({
          subject: `חשבונית מס/קבלה — הזמנה #${order.number}`,
          preheader: `${order.tenant.name} — קישור להורדת החשבונית`,
          heading: "החשבונית מוכנה",
          paragraphs: [
            `קיבלת חשבונית מס/קבלה עבור ההזמנה שלך ב${order.tenant.name} (הזמנה #${order.number}).`,
            "להורדה לחצו על הכפתור למטה.",
          ],
          button: {
            href: order.invoiceUrl,
            label: order.invoiceNumber
              ? `הורדת חשבונית ${order.invoiceNumber}`
              : "הורדת החשבונית",
          },
          footerNote: "קישור זה הונפק ע״י Grow Payments ואינו מוגן בסיסמה.",
        });
        const email = await sendEmail({
          tenantId: order.tenantId,
          to: emailRecipient,
          subject: `חשבונית מס/קבלה — הזמנה #${order.number}`,
          body: text,
          html,
          kind: "invoice_delivery",
          refKind: "order",
          refId: orderId,
        });
        result.email = email.status === "sent" ? "sent" : "skipped";
        await prisma.orderEvent.create({
          data: {
            orderId,
            type: EMAIL_EVENT,
            payload: {
              to_masked: maskEmail(emailRecipient),
              status: email.status,
              provider_msg: email.providerMsg ?? null,
            },
          },
        });
      } catch (err) {
        console.error("[invoice-dispatch] email failed", err);
        result.email = "failed";
      }
    }
  }

  return result;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-3)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const safeLocal =
    local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}
