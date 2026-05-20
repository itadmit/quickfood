import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const rating = url.searchParams.get("rating");
  const replied = url.searchParams.get("replied");

  const where: Prisma.ReviewWhereInput = { tenantId: session.tenantId, status: "visible" };
  if (rating) where.rating = parseInt(rating, 10);
  if (replied === "true") where.replyText = { not: null };
  if (replied === "false") where.replyText = null;

  const reviews = await prisma.review.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      order: { select: { number: true, total: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Summary stats
  const all = await prisma.review.findMany({
    where: { tenantId: session.tenantId, status: "visible" },
    select: { rating: true },
  });
  const distribution = [0, 0, 0, 0, 0]; // index 0 = 1 star, 4 = 5 stars
  for (const r of all) distribution[r.rating - 1]++;
  const avg = all.length > 0 ? all.reduce((a, b) => a + b.rating, 0) / all.length : 0;

  return apiJson({
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      reply_text: r.replyText,
      reply_at: r.replyAt?.toISOString() ?? null,
      created_at: r.createdAt.toISOString(),
      customer: r.customer,
      order: r.order ? {
        number: r.order.number,
        total: r.order.total,
        created_at: r.order.createdAt.toISOString(),
      } : null,
    })),
    summary: {
      count: all.length,
      average: Math.round(avg * 10) / 10,
      distribution,
    },
  });
});
