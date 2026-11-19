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
import { activePauseUntil, effectiveBranchStatus, type BranchHours } from "@/lib/branch-hours";
import { CustomerTopNav } from "@/components/customer/CustomerTopNav";
import { ReviewPromptModal } from "@/components/customer/ReviewPromptModal";
import { MerchantPreviewBar } from "@/components/customer/MerchantPreviewBar";
import { AIAdvisorFAB } from "@/components/customer/ai-advisor/AIAdvisorFAB";
import { AIAdvisorPromoPopup } from "@/components/customer/ai-advisor/AIAdvisorPromoPopup";
import { FloatingCartCTA } from "@/components/customer/FloatingCartCTA";
import { StorefrontWhatsAppFAB } from "@/components/customer/StorefrontWhatsAppFAB";
import { CampaignPopup } from "@/components/customer/CampaignPopup";
import { CustomerChromeGate } from "@/components/customer/CustomerChromeGate";
import { CustomerFooter } from "@/components/customer/CustomerFooter";
import { StoreSuspended } from "@/components/customer/StoreSuspended";
import { storefrontBlock } from "@/lib/tenant-billing";
import { VisitBeacon } from "@/components/customer/VisitBeacon";
import { StorefrontPixel } from "@/components/customer/StorefrontPixel";
import { QrLandingModal } from "@/components/customer/QrLandingModal";
import { LocaleProvider } from "@/components/customer/LocaleProvider";
import { cookies } from "next/headers";
import { dirFor, LANG_COOKIE, resolveLang, type Lang } from "@/lib/i18n/langs";
import { cityEntityId, contentKey, loadStorefrontContent, tagEntityId } from "@/lib/i18n/content";
import { findTag } from "@/lib/dietary-tags";
import type { TransItem } from "@/lib/i18n/translate";

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

  // Keep blocked stores (trial-ended / suspended) out of Google; active stores
  // stay fully indexable.
  const blocked = storefrontBlock(tenant) !== null;

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(blocked ? { robots: { index: false, follow: false } } : {}),
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

  // Opt-in storefront language: the enabled set always includes Hebrew; the
  // visitor's cookie choice is honoured only if the tenant enabled it. Drives
  // the UI-string dictionary + page direction (en/ru are LTR).
  const enabledLangs = (tenant.storefrontLanguages ?? ["he"]) as Lang[];
  const lang = resolveLang(
    (await cookies()).get(LANG_COOKIE)?.value,
    tenant.storefrontLanguages,
  );

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

  // Storefront closed: billing suspension (hub cancelled for non-payment / admin
  // suspend) OR the trial lapsed with no payment method. Replace the whole
  // storefront with a neutral "closed" page - the owner gets a link to fix it.
  const block = storefrontBlock(tenant);
  if (block) {
    return (
      <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg">
        <StoreSuspended
          tenantName={tenant.name}
          tenantLogoUrl={tenant.logoUrl}
          isOwner={isOwnMerchant}
          reason={block}
        />
      </ThemeProvider>
    );
  }

  const cities = Array.from(new Set((branch?.zones ?? []).flatMap((z) => z.cities)));
  // Free-text tags the merchant typed themselves have no static dictionary
  // entry, so they go through the same cached auto-translation as other
  // merchant content. Skipped for Hebrew (source language).
  const customTags =
    lang === "he"
      ? []
      : Array.from(
          new Set(
            (
              await prisma.menuItem.findMany({
                where: { tenantId: tenant.id, available: true, NOT: { tags: { isEmpty: true } } },
                select: { tags: true },
              })
            ).flatMap((i) => i.tags),
          ),
        ).filter((t) => t.trim() && !findTag(t));
  const tenantTexts: TransItem[] = [
    { entityType: "tenant", entityId: tenant.id, field: "cutleryLabel", text: tenant.cutleryLabel ?? "" },
    { entityType: "tenant", entityId: tenant.id, field: "preUpsellTitle", text: tenant.preCheckoutUpsellTitle ?? "" },
    { entityType: "tenant", entityId: tenant.id, field: "preUpsellSubtitle", text: tenant.preCheckoutUpsellSubtitle ?? "" },
    { entityType: "branch", entityId: branch?.id ?? tenant.id, field: "address", text: branch?.address ?? "" },
    ...cities.map((c) => ({ entityType: "city", entityId: cityEntityId(tenant.id, c), field: "name", text: c })),
    ...customTags.map((t) => ({ entityType: "item_tag", entityId: tagEntityId(tenant.id, t), field: "label", text: t })),
  ];
  const rawContent = await loadStorefrontContent(tenant.id, lang, tenantTexts);
  const content: Record<string, string> = { ...rawContent };
  for (const c of cities) {
    const k = contentKey("city", cityEntityId(tenant.id, c), "name");
    if (rawContent[k]) content[`city:${c}`] = rawContent[k];
    delete content[k];
  }
  for (const t of customTags) {
    const k = contentKey("item_tag", tagEntityId(tenant.id, t), "label");
    if (rawContent[k]) content[`tag:${t}`] = rawContent[k];
    delete content[k];
  }
  const addrKey = contentKey("branch", branch?.id ?? tenant.id, "address");
  if (rawContent[addrKey]) content["store:address"] = rawContent[addrKey];
  delete content[addrKey];
  const tenantText = <T extends string | null>(field: string, source: T): T =>
    source ? ((content[contentKey("tenant", tenant.id, field)] ?? source) as T) : source;

  return (
    <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg" dir={dirFor(lang)}>
      <LocaleProvider lang={lang} enabled={enabledLangs} content={content}>
      <CartProvider
        tenant={{
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          logoLetter: tenant.logoLetter,
          themeId: tenant.themeId,
          businessType: tenant.businessType,
          scheduledOrdersEnabled: tenant.scheduledOrdersEnabled,
          preordersWhenClosed: tenant.preordersWhenClosed,
          tipEnabled: tenant.tipEnabled,
          customerNotesEnabled: tenant.customerNotesEnabled,
          cutleryEnabled: tenant.cutleryEnabled,
          cutleryLabel: tenantText("cutleryLabel", tenant.cutleryLabel),
          cutleryPrice: tenant.cutleryPrice,
          cutleryFreeAbove: tenant.cutleryFreeAbove,
          reviewsPublic: tenant.reviewsEnabled && tenant.reviewsPublic,
          upsellSizeNudge: tenant.upsellSizeNudge,
          preCheckoutUpsellTitle: tenantText("preUpsellTitle", tenant.preCheckoutUpsellTitle),
          preCheckoutUpsellSubtitle: tenantText("preUpsellSubtitle", tenant.preCheckoutUpsellSubtitle),
        }}
        branch={
          branch
            ? {
                name: branch.name,
                address: branch.address,
                deliveryFee: branch.deliveryFee,
                serviceFee: branch.serviceFee,
                minOrder: branch.minOrder,
                status: effectiveBranchStatus(branch),
                busyEtaBoostMinutes: branch.busyEtaBoostMinutes,
                freeDeliveryMinOrder: branch.freeDeliveryMinOrder,
                freeDeliveryMinItems: branch.freeDeliveryMinItems,
                etaUnit: branch.etaUnit,
                hours: (branch.hours ?? null) as BranchHours | null,
                pausedUntil: activePauseUntil(branch)?.toISOString() ?? null,
              }
            : null
        }
        zones={(branch?.zones ?? []).map((z) => ({
          name: z.name,
          cities: z.cities,
          nationwide: z.nationwide,
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
            {!isOwnMerchant && tenant.facebookPixelId && (
              <StorefrontPixel pixelId={tenant.facebookPixelId} />
            )}
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
              <CustomerFooter tenantSlug={tenant.slug} tenantName={tenant.name} lang={lang} />
            </CustomerChromeGate>
          </div>
          {modal}
          <CustomerChromeGate>
            <CampaignPopup tenantSlug={tenant.slug} />
            <FloatingCartCTA />
            {tenant.whatsappButtonPhone && (
              <StorefrontWhatsAppFAB phone={tenant.whatsappButtonPhone} />
            )}
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
      </LocaleProvider>
    </ThemeProvider>
  );
}
