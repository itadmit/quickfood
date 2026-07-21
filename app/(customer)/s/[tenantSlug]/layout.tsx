import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { storefrontCanonical } from "@/lib/storefront-url";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { CartProvider } from "@/components/customer/CartProvider";
import { CartBundleProvider } from "@/components/customer/CartBundleProvider";
import type { BusinessType } from "@/components/shared/MenuItemImage";
import { MenuSearchProvider } from "@/components/customer/MenuSearchProvider";
import type { BranchHours } from "@/lib/branch-hours";
import { CustomerTopNav } from "@/components/customer/CustomerTopNav";
import { ReviewPromptModal } from "@/components/customer/ReviewPromptModal";
import { MerchantPreviewBar } from "@/components/customer/MerchantPreviewBar";
import { AIAdvisorFAB } from "@/components/customer/ai-advisor/AIAdvisorFAB";
import { AIAdvisorPromoPopup } from "@/components/customer/ai-advisor/AIAdvisorPromoPopup";
import { FloatingCartCTA } from "@/components/customer/FloatingCartCTA";
import { CampaignPopup } from "@/components/customer/CampaignPopup";
import { CustomerChromeGate } from "@/components/customer/CustomerChromeGate";
import { CustomerFooter } from "@/components/customer/CustomerFooter";
import { StoreSuspended } from "@/components/customer/StoreSuspended";
import { VisitBeacon } from "@/components/customer/VisitBeacon";
import { QrLandingModal } from "@/components/customer/QrLandingModal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return { title: "QuickFood" };

  const title = `${tenant.name} · הזמנות אונליין`;
  const description =
    tenant.about?.trim() ||
    tenant.cuisineType ||
    `הזמינו אונליין מ${tenant.name}`;
  const previewImage = tenant.logoUrl || tenant.coverImage || null;
  const url = storefrontCanonical(tenant);

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(tenant.logoUrl
      ? { icons: { icon: tenant.logoUrl, apple: tenant.logoUrl } }
      : {}),
    openGraph: {
      type: "website",
      locale: "he_IL",
      url,
      siteName: tenant.name,
      title: tenant.name,
      description,
      images: previewImage ? [{ url: previewImage, alt: tenant.name }] : [],
    },
    twitter: {
      card: previewImage ? "summary_large_image" : "summary",
      title: tenant.name,
      description,
      images: previewImage ? [previewImage] : [],
    },
  };
}

export default async function CustomerLayout({
  children,
  modal,
  params,
}: {
  children: React.ReactNode;
  // Parallel slot for the intercepting routes (the item-detail modal
  // opened from the menu list). Empty `<ModalDefault />` when no
  // interceptor is active. See app/(customer)/[tenantSlug]/@modal/.
  modal: React.ReactNode;
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
  // merchant owns *this* tenant - a manager of a different store browsing
  // here shouldn't see a "manage" CTA that lands them somewhere unrelated.
  const isOwnMerchant =
    session?.type === "merchant" && session.tenantId === tenant.id;

  // Storefront closed for billing (hub cancelled the base subscription for
  // non-payment) or an admin suspension. Replace the whole storefront with a
  // neutral "temporarily closed" page - the owner gets a link to fix payment.
  if (tenant.billingSuspendedAt || tenant.status === "suspended") {
    return (
      <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg">
        <StoreSuspended
          tenantName={tenant.name}
          tenantLogoUrl={tenant.logoUrl}
          isOwner={isOwnMerchant}
        />
      </ThemeProvider>
    );
  }

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
          tipEnabled: tenant.tipEnabled,
          cutleryEnabled: tenant.cutleryEnabled,
          cutleryLabel: tenant.cutleryLabel,
          cutleryPrice: tenant.cutleryPrice,
          cutleryFreeAbove: tenant.cutleryFreeAbove,
          reviewsPublic: tenant.reviewsEnabled && tenant.reviewsPublic,
          upsellSizeNudge: tenant.upsellSizeNudge,
        }}
        branch={
          branch
            ? {
                deliveryFee: branch.deliveryFee,
                serviceFee: branch.serviceFee,
                minOrder: branch.minOrder,
                status: branch.status,
                busyEtaBoostMinutes: branch.busyEtaBoostMinutes,
                freeDeliveryMinOrder: branch.freeDeliveryMinOrder,
                freeDeliveryMinItems: branch.freeDeliveryMinItems,
                hours: (branch.hours ?? null) as BranchHours | null,
              }
            : null
        }
        zones={(branch?.zones ?? []).map((z) => ({
          name: z.name,
          cities: z.cities,
          deliveryFee: z.deliveryFee,
          minOrder: z.minOrder,
          freeDeliveryAbove: z.freeDeliveryAbove,
          minEta: z.minEta,
          maxEta: z.maxEta,
        }))}
      >
        <CartBundleProvider tenantSlug={tenant.slug} businessType={tenant.businessType as BusinessType}>
        <MenuSearchProvider>
          {/* Mobile = phone-sized column with shadow (max-w-md).
              Desktop (lg+) = top nav appears, the wrapper widens and screens
              handle their own multi-column layouts internally. */}
          <CustomerChromeGate>
            <CustomerTopNav
              tenantSlug={tenant.slug}
              tenantName={tenant.name}
              logoLetter={tenant.logoLetter}
              logoUrl={tenant.logoUrl}
            />
          </CustomerChromeGate>
          <div className="max-w-md mx-auto bg-qf-bg min-h-screen relative shadow-md lg:max-w-none lg:mx-0 lg:shadow-none">
            {!isOwnMerchant && <VisitBeacon tenantSlug={tenant.slug} />}
            {!isOwnMerchant && <QrLandingModal tenantSlug={tenant.slug} />}
            {children}
            {pendingReview && (
              <CustomerChromeGate>
                <ReviewPromptModal
                  tenantSlug={tenant.slug}
                  orderId={pendingReview.id}
                  orderNumber={pendingReview.number}
                />
              </CustomerChromeGate>
            )}
            <CustomerChromeGate>
              <CustomerFooter tenantSlug={tenant.slug} tenantName={tenant.name} />
            </CustomerChromeGate>
          </div>
          {modal}
          <CustomerChromeGate>
            <CampaignPopup tenantSlug={tenant.slug} />
            <FloatingCartCTA />
            {tenant.aiAdvisorEnabled &&
              ((tenant.aiProvider === "claude" && tenant.aiClaudeApiKey) ||
                (tenant.aiProvider === "gemini" && tenant.aiGeminiApiKey)) && (
                <>
                  <AIAdvisorFAB
                    tenantSlug={tenant.slug}
                    suggestions={tenant.aiAdvisorSuggestions}
                  />
                  {tenant.aiAdvisorPopupEnabled && (
                    <AIAdvisorPromoPopup
                      tenantSlug={tenant.slug}
                      tenantName={tenant.name}
                      suggestions={tenant.aiAdvisorSuggestions}
                    />
                  )}
                </>
              )}
            {isOwnMerchant && <MerchantPreviewBar tenantName={tenant.name} />}
          </CustomerChromeGate>
        </MenuSearchProvider>
        </CartBundleProvider>
      </CartProvider>
    </ThemeProvider>
  );
}
