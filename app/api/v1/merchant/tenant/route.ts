import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { TenantPatchSchema } from "@/lib/validate";
import { createCustomer } from "@/lib/billing-hub/client";

/**
 * Push the tenant's billing identity (name / ח.פ / phone) to the billing hub
 * customer so future invoices carry it. Best-effort: the hub upserts by email
 * and this must never fail the settings save. No-op if the tenant has no
 * billing customer yet (it'll be created with these values at setup time).
 */
async function syncBillingCustomer(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      vatNumber: true,
      billingCustomerId: true,
      merchantUsers: {
        where: { role: "owner" },
        select: { email: true, phone: true },
        take: 1,
      },
    },
  });
  const owner = tenant?.merchantUsers[0];
  if (!tenant?.billingCustomerId || !owner?.email) return;
  await createCustomer({
    email: owner.email,
    name: tenant.name,
    phone: owner.phone ?? undefined,
    vat_number: tenant.vatNumber ?? undefined,
    external_id: tenant.id,
    external_slug: tenant.slug,
    metadata: { tenant_id: tenant.id },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const [tenant, primaryBranch] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: session.tenantId } }),
    prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true, name: true, deliveryFee: true, serviceFee: true, minOrder: true },
    }),
  ]);
  return apiJson({
    tenant,
    primary_branch: primaryBranch
      ? {
          id: primaryBranch.id,
          name: primaryBranch.name,
          delivery_fee: primaryBranch.deliveryFee,
          service_fee: primaryBranch.serviceFee,
          min_order: primaryBranch.minOrder,
        }
      : null,
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = TenantPatchSchema.parse(await req.json());
  const tenant = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      name: body.name,
      logoLetter: body.logo_letter,
      logoUrl: body.logo_url,
      coverImage: body.cover_image,
      themeId: body.theme_id,
      businessType: body.business_type,
      cuisineType: body.cuisine_type,
      about: body.about,
      vatNumber: body.vat_number,
      termsText: body.terms_text,
      termsAcknowledgedAt: body.terms_acknowledged ? new Date() : undefined,
      checkoutShowTracking: body.checkout_show_tracking,
      checkoutRequireEmail: body.checkout_require_email,
      checkoutShowAttribution: body.checkout_show_attribution,
      scheduledOrdersEnabled: body.scheduled_orders_enabled,
      pickupEnabled: body.pickup_enabled,
      cutleryEnabled: body.cutlery_enabled,
      cutleryLabel: body.cutlery_label,
      cutleryPrice: body.cutlery_price,
      cutleryFreeAbove: body.cutlery_free_above,
      tipEnabled: body.tip_enabled,
      onboardingDismissedAt: body.onboarding_dismissed ? new Date() : undefined,
      dashboardVersion: body.dashboard_version,
      receiptPrinter: body.receipt_printer,
      receiptSettings: body.receipt_settings,
      printerSettings: body.printer_settings,
      kioskWelcomeText: body.kiosk_welcome_text,
      kioskIdleSeconds: body.kiosk_idle_seconds,
      kioskCollectPhone: body.kiosk_collect_phone,
      kioskRequirePhone: body.kiosk_require_phone,
      kioskStringOverrides: body.kiosk_string_overrides,
      featuredBadgeLabel: body.featured_badge_label,
      upsellSizeNudge: body.upsell_size_nudge,
      cartUpsellTitle: body.cart_upsell_title,
    },
  });

  // When the business identity changed, propagate it to the billing customer
  // so future invoices show the correct ח.פ / name. Fire-and-forget so a hub
  // hiccup never blocks saving settings.
  if (body.vat_number !== undefined || body.name !== undefined) {
    void syncBillingCustomer(tenant.id).catch((e) =>
      console.error("[tenant.patch] billing customer sync failed:", e),
    );
  }

  return apiJson({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logo_letter: tenant.logoLetter,
      theme_id: tenant.themeId,
    },
  });
});
