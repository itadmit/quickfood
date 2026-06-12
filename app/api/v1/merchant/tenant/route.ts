import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { TenantPatchSchema } from "@/lib/validate";

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
      checkoutShowTracking: body.checkout_show_tracking,
      scheduledOrdersEnabled: body.scheduled_orders_enabled,
      pickupEnabled: body.pickup_enabled,
      cutleryEnabled: body.cutlery_enabled,
      cutleryLabel: body.cutlery_label,
      cutleryPrice: body.cutlery_price,
      cutleryFreeAbove: body.cutlery_free_above,
      onboardingDismissedAt: body.onboarding_dismissed ? new Date() : undefined,
      dashboardVersion: body.dashboard_version,
      receiptPrinter: body.receipt_printer,
      kioskWelcomeText: body.kiosk_welcome_text,
      kioskIdleSeconds: body.kiosk_idle_seconds,
      kioskCollectPhone: body.kiosk_collect_phone,
      kioskRequirePhone: body.kiosk_require_phone,
      kioskStringOverrides: body.kiosk_string_overrides,
      featuredBadgeLabel: body.featured_badge_label,
      upsellSizeNudge: body.upsell_size_nudge,
    },
  });
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
