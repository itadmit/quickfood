import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReplySchema = z.object({ text: z.string().min(1).max(1000) });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = ReplySchema.parse(await req.json());
  const review = await prisma.review.findUnique({ where: { id }, select: { tenantId: true } });
  if (!review) return apiError("not_found", "ביקורת לא נמצאה", 404);
  if (review.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  const updated = await prisma.review.update({
    where: { id },
    data: { replyText: body.text, replyAt: new Date() },
  });
  return apiJson({
    review: {
      id: updated.id,
      reply_text: updated.replyText,
      reply_at: updated.replyAt?.toISOString() ?? null,
    },
  });
});
