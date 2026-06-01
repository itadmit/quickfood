/**
 * POST /api/v1/customer/orders/[id]/invoice-contact
 *
 * Customer-facing "where should we send the invoice?" endpoint. Used by
 * the PayPage when the Grow invoice hasn't landed yet AND no phone was
 * collected upstream (e.g. kiosk skip). Accepts either an email or a
 * phone number; stores it on the order and — if the invoice has
 * already been generated — dispatches immediately.
 *
 * No auth: the orderId + tenant slug pair is unguessable enough for
 * MVP (same posture as the existing /pay/initiate guest path).
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";
import { dispatchInvoice } from "@/lib/orders/invoice-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  contact: z.string().min(3).max(120),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: orderId } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return apiError("invalid_body", "פרטי קשר לא תקינים", 422);
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerPhoneSnap: true,
        customerEmailSnap: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    const raw = parsed.data.contact.trim();
    const looksLikeEmail = raw.includes("@");

    if (looksLikeEmail) {
      if (!EMAIL_RE.test(raw)) {
        return apiError("invalid_email", "כתובת המייל אינה תקינה", 422, "contact");
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { customerEmailSnap: raw },
      });
    } else {
      const e164 = toE164(raw);
      if (!e164) {
        return apiError(
          "invalid_phone",
          "מספר הטלפון אינו תקין. דוגמה: 050-1234567",
          422,
          "contact",
        );
      }
      // Only overwrite the snap if it wasn't set already — phone collected
      // at the kiosk takes priority; the email fallback should never
      // silently swap their number out.
      if (!order.customerPhoneSnap) {
        await prisma.order.update({
          where: { id: orderId },
          data: { customerPhoneSnap: e164 },
        });
      }
    }

    // If Grow already shipped the invoice, send right away. If not, the
    // callback's own dispatchInvoice call will catch the new contact
    // when the invoice URL lands. (dispatchInvoice is a no-op when the
    // order has no invoiceUrl yet.)
    void dispatchInvoice(orderId).catch((err) => {
      console.error("[invoice-contact] dispatch failed", err);
    });

    return apiJson({ ok: true, channel: looksLikeEmail ? "email" : "sms" });
  },
);
