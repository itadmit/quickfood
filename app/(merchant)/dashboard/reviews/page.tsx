import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { fullName } from "@/lib/format";
import { ReviewsView } from "./ReviewsView";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [reviews, all] = await Promise.all([
    prisma.review.findMany({
      where: { tenantId: session.tenantId, status: "visible" },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        order: { select: { number: true, total: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.review.findMany({
      where: { tenantId: session.tenantId, status: "visible" },
      select: { rating: true },
    }),
  ]);

  const distribution = [0, 0, 0, 0, 0];
  for (const r of all) distribution[r.rating - 1]++;
  const avg = all.length > 0 ? all.reduce((a, b) => a + b.rating, 0) / all.length : 0;

  return (
    <ReviewsView
      summary={{ count: all.length, average: Math.round(avg * 10) / 10, distribution }}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text ?? "",
        replyText: r.replyText,
        replyAt: r.replyAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        customerName: fullName(r.customer.firstName, r.customer.lastName) || "אורח",
        orderNumber: r.order?.number ?? null,
      }))}
    />
  );
}
