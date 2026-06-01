/**
 * Invoice dispatch — once Grow's async invoice callback lands, email the
 * customer a link to download the tax invoice / receipt. The email is
 * collected on the PayPage ("מעוניין בחשבונית מס?" opt-in).
 *
 * Idempotent: we stamp an `OrderEvent` row so a retry of the callback (or
 * a second dispatch after the customer adds their email) doesn't double
 * send. Safe to call multiple times — a no-op until both the invoice URL
 * and an email address are present.
 */

import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { renderRtlEmail } from "@/lib/email/templates";

export interface DispatchInvoiceResult {
  email?: "sent" | "skipped" | "failed";
}

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
      customerEmailSnap: true,
      tenant: { select: { name: true } },
    },
  });
  if (!order) return {};
  if (!order.invoiceUrl) return {};
  if (!order.customerEmailSnap) return {};

  const already = await prisma.orderEvent.findFirst({
    where: { orderId, type: EMAIL_EVENT },
    select: { id: true },
  });
  if (already) return {};

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
      to: order.customerEmailSnap,
      subject: `חשבונית מס/קבלה — הזמנה #${order.number}`,
      body: text,
      html,
      kind: "invoice_delivery",
      refKind: "order",
      refId: orderId,
    });
    await prisma.orderEvent.create({
      data: {
        orderId,
        type: EMAIL_EVENT,
        payload: {
          to_masked: maskEmail(order.customerEmailSnap),
          status: email.status,
          provider_msg: email.providerMsg ?? null,
        },
      },
    });
    return { email: email.status === "sent" ? "sent" : "skipped" };
  } catch (err) {
    console.error("[invoice-dispatch] email failed", err);
    return { email: "failed" };
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const safeLocal =
    local.length <= 2 ? `${local[0] ?? ""}*` : `${local.slice(0, 2)}***`;
  return `${safeLocal}@${domain}`;
}
