import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { reviewReplyEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReplySchema = z.object({ text: z.string().min(1).max(1000) });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = ReplySchema.parse(await req.json());
  const review = await prisma.review.findUnique({
    where: { id },
    select: {
      tenantId: true,
      rating: true,
      text: true,
      customer: { select: { firstName: true, email: true } },
      tenant: { select: { name: true, slug: true } },
    },
  });
  if (!review) return apiError("not_found", "ביקורת לא נמצאה", 404);
  if (review.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  const updated = await prisma.review.update({
    where: { id },
    data: { replyText: body.text, replyAt: new Date() },
  });

  // Best-effort notification: tell the customer the merchant replied.
  // Only when we have an email — silently skip otherwise. Failures
  // never propagate (the reply itself is the source of truth in DB).
  if (review.customer?.email) {
    const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://quickfood.co.il";
    const hello = review.customer.firstName?.trim() || "שלום";
    const { html, text } = reviewReplyEmail({
      hello,
      businessName: review.tenant.name,
      customerRating: review.rating,
      customerText: review.text ?? null,
      replyText: body.text,
      viewUrl: `${base}/s/${review.tenant.slug}/reviews`,
    });
    try {
      await sendEmail({
        tenantId: review.tenantId,
        to: review.customer.email,
        subject: `${review.tenant.name} השיב/ה לדירוג שלך`,
        body: text,
        html,
        fromName: review.tenant.name,
        kind: "review_reply",
        refKind: "review",
        refId: id,
      });
    } catch (err) {
      console.warn("[review-reply] failed to email customer", err);
    }
  }

  return apiJson({
    review: {
      id: updated.id,
      reply_text: updated.replyText,
      reply_at: updated.replyAt?.toISOString() ?? null,
    },
  });
});
