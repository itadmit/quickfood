/**
 * POST /api/v1/customer/orders/[id]/invoice-contact
 *
 * Customer-facing "email me the invoice" endpoint. Used by the PayPage
 * when the customer opts into a tax invoice. Stores the email on the
 * order and — if the invoice has already been generated — dispatches
 * immediately; otherwise the Grow callback's own dispatch picks it up.
 *
 * No auth: the orderId + tenant slug pair is unguessable enough for
 * MVP (same posture as the existing /pay/initiate guest path).
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { dispatchInvoice } from "@/lib/orders/invoice-dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().min(3).max(120),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: orderId } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return apiError("invalid_body", "כתובת מייל לא תקינה", 422);
    }

    const email = parsed.data.email.trim();
    if (!EMAIL_RE.test(email)) {
      return apiError("invalid_email", "כתובת המייל אינה תקינה", 422, "email");
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    await prisma.order.update({
      where: { id: orderId },
      data: { customerEmailSnap: email },
    });

    // If Grow already shipped the invoice, this sends it now; otherwise
    // it's a no-op and the Grow callback's own dispatch sends it when the
    // URL lands. Awaited so the Resend call finishes inside this request
    // (Vercel can freeze work that outlives the response); a send failure
    // is swallowed since the email is already stored for the callback.
    await dispatchInvoice(orderId).catch((err) => {
      console.error("[invoice-contact] dispatch failed", err);
    });

    return apiJson({ ok: true });
  },
);
