import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { CartProvider } from "@/components/customer/CartProvider";
import { CustomerTopNav } from "@/components/customer/CustomerTopNav";
import { ReviewPromptModal } from "@/components/customer/ReviewPromptModal";
import { MerchantPreviewBar } from "@/components/customer/MerchantPreviewBar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return { title: "QuickFood" };
  return {
    title: `${tenant.name} · הזמנות אונליין`,
    description: tenant.cuisineType ?? "הזמנות אונליין דרך QuickFood",
  };
}

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();
  const branch = tenant.branches[0];

  // Pull the customer's most recent delivered + un-reviewed + un-dismissed
  // order so we can pop the rating modal across all customer pages. Skipped
  // for guests, and when the tenant disabled reviews.
  const session = await getSession();
  const pendingReview =
    session?.type === "customer" && tenant.reviewsEnabled
      ? await prisma.order.findFirst({
          where: {
            tenantId: tenant.id,
            customerId: session.userId,
            status: "delivered",
            review: null,
            reviewPromptDismissedAt: null,
          },
          orderBy: { deliveredAt: "desc" },
          select: { id: true, number: true },
        })
      : null;

  // Show the "you're viewing your own storefront" bar only when the logged-in
  // merchant owns *this* tenant — a manager of a different store browsing
  // here shouldn't see a "manage" CTA that lands them somewhere unrelated.
  const isOwnMerchant =
    session?.type === "merchant" && session.tenantId === tenant.id;

  return (
    <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg">
      <CartProvider
        tenant={{
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          logoLetter: tenant.logoLetter,
          themeId: tenant.themeId,
          businessType: tenant.businessType,
          scheduledOrdersEnabled: tenant.scheduledOrdersEnabled,
        }}
        branch={
          branch
            ? {
                deliveryFee: branch.deliveryFee,
                serviceFee: branch.serviceFee,
                minOrder: branch.minOrder,
              }
            : null
        }
      >
        {/* Mobile = phone-sized column with shadow (max-w-md).
            Desktop (lg+) = top nav appears, the wrapper widens and screens
            handle their own multi-column layouts internally. */}
        <CustomerTopNav
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          logoLetter={tenant.logoLetter}
          logoUrl={tenant.logoUrl}
          branchAddress={branch?.address ?? null}
        />
        <div className="max-w-md mx-auto bg-qf-bg min-h-screen relative shadow-md lg:max-w-none lg:mx-0 lg:shadow-none">
          {children}
          {pendingReview && (
            <ReviewPromptModal
              tenantSlug={tenant.slug}
              orderId={pendingReview.id}
              orderNumber={pendingReview.number}
            />
          )}
        </div>
        {isOwnMerchant && <MerchantPreviewBar tenantName={tenant.name} />}
      </CartProvider>
    </ThemeProvider>
  );
}
