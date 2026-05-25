import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { CustomerReviews } from "@/components/customer/screens/CustomerReviews";

export const dynamic = "force-dynamic";

export default async function CustomerReviewsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const settings = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { reviewsEnabled: true, reviewsPublic: true },
  });
  if (!settings?.reviewsEnabled || !settings.reviewsPublic) notFound();

  const [reviews, distRows] = await Promise.all([
    prisma.review.findMany({
      where: { tenantId: tenant.id, status: "visible" },
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.review.findMany({
      where: { tenantId: tenant.id, status: "visible" },
      select: { rating: true },
    }),
  ]);

  const distribution = [0, 0, 0, 0, 0];
  for (const r of distRows) distribution[r.rating - 1]++;
  const avg =
    distRows.length > 0 ? distRows.reduce((a, b) => a + b.rating, 0) / distRows.length : 0;

  // CTA: if the logged-in customer has a delivered order that hasn't been
  // reviewed yet, point the "write a review" button straight at it.
  const session = await getSession();
  let pendingOrderId: string | null = null;
  if (session?.type === "customer") {
    const pending = await prisma.order.findFirst({
      where: {
        tenantId: tenant.id,
        customerId: session.userId,
        status: "delivered",
        review: null,
      },
      orderBy: { deliveredAt: "desc" },
      select: { id: true },
    });
    pendingOrderId = pending?.id ?? null;
  }

  return (
    <CustomerReviews
      tenantSlug={tenant.slug}
      summary={{
        count: distRows.length,
        average: Math.round(avg * 10) / 10,
        distribution,
      }}
      reviews={reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        replyText: r.replyText,
        replyAt: r.replyAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        customerName: fullName(r.customer.firstName, r.customer.lastName) || "אורח",
      }))}
      pendingOrderId={pendingOrderId}
    />
  );
}
