import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/merchant/tenant/reset
 *
 * "Reopen the store from scratch" — wipes all the editable content
 * (menu, marketing, branding visuals, reviews, etc.) and resets the
 * Tenant row back to its first-day defaults. After this call the
 * merchant lands on an empty dashboard with the onboarding welcome
 * overlay shown again, exactly as if they'd just signed up.
 *
 * Preserves:
 *   - Tenant identity (id, slug, name, logoLetter, dashboardVersion)
 *   - Billing setup (subscription, payment method, trial dates)
 *   - SMS credit balance the merchant already paid for
 *   - Team accounts (MerchantUser)
 *   - Order history (Order, OrderItem, OrderEvent) — accounting needs
 *   - Customers + addresses (so existing customers are recognised)
 *   - Branch records (the structure stays; data on each branch reset)
 *
 * Confirm token = the tenant's exact `name`. Forces a "type the name
 * to confirm" UX so a stray POST with `{}` can't nuke a store. Owner
 * role required.
 */

const BodySchema = z.object({
  confirm_name: z.string().min(1),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("bad_request", "אישור חסר", 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  if (!tenant) return apiError("not_found", "החנות לא נמצאה", 404);

  if (parsed.data.confirm_name.trim() !== tenant.name) {
    return apiError(
      "bad_confirm",
      "השם שהוקלד לא תואם לשם החנות",
      400,
    );
  }

  const tenantId = session.tenantId;

  // Transaction — every wipe + the Tenant field reset happen atomically
  // so a failure leaves the store in the prior state, not half-reset.
  // 60s timeout because deleting cascading menus on a large tenant can
  // take more than the default 5s.
  const summary = await prisma.$transaction(
    async (tx) => {
      // ── 1. Menu + everything that hangs off it ──
      const menuItems = await tx.menuItem.deleteMany({ where: { tenantId } });
      const categories = await tx.menuCategory.deleteMany({ where: { tenantId } });
      const modifierSets = await tx.modifierSet.deleteMany({ where: { tenantId } });

      // ── 2. Marketing ──
      const coupons = await tx.coupon.deleteMany({ where: { tenantId } });
      const campaigns = await tx.campaign.deleteMany({ where: { tenantId } });

      // ── 3. Operations data scoped to the tenant ──
      const reviews = await tx.review.deleteMany({ where: { tenantId } });
      const couriers = await tx.courier.deleteMany({ where: { tenantId } });
      const zones = await tx.deliveryZone.deleteMany({
        where: { branch: { tenantId } },
      });
      const webhooks = await tx.webhookEndpoint.deleteMany({
        where: { tenantId },
      });
      const woltImports = await tx.woltImport.deleteMany({
        where: { tenantId },
      });
      // Notifications use a polymorphic (recipientType, recipientId)
      // — they're addressed to specific users, not to the tenant.
      // We leave them be; the merchant can mark-as-read normally.

      // ── 4. Reset the Tenant row to "fresh store" defaults.
      //      Identity (id/slug/name/logoLetter), billing, dashboardVersion,
      //      smsCreditsRemaining are deliberately untouched. ──
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          logoUrl: null,
          coverImage: null,
          about: null,
          vatNumber: null,
          themeId: "fresh",
          businessType: "general",
          cuisineType: null,
          defaultPaymentMethod: null,
          allowedOrigins: [],
          checkoutShowTracking: false,
          scheduledOrdersEnabled: true,
          // Re-show the welcome overlay so the merchant lands in the
          // "import from Wolt / start from scratch" picker.
          onboardingDismissedAt: null,
          reviewsEnabled: true,
          reviewsPublic: true,
          reviewsChannel: "off",
          reviewsDelayMinutes: 60,
          smsSender: null,
          whatsappToken: null,
          whatsappInstanceId: null,
          acceptsCash: true,
        },
      });

      return {
        menuItems: menuItems.count,
        categories: categories.count,
        modifierSets: modifierSets.count,
        coupons: coupons.count,
        campaigns: campaigns.count,
        reviews: reviews.count,
        couriers: couriers.count,
        zones: zones.count,
        webhooks: webhooks.count,
        woltImports: woltImports.count,
      };
    },
    { timeout: 60_000 },
  );

  return apiJson({ ok: true, deleted: summary });
});
