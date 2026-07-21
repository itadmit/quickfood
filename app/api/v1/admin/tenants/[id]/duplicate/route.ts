import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { TenantDuplicateSchema } from "@/lib/validate";
import { isValidSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Clone an existing tenant's catalog + settings into a brand-new store with
 * its own slug and owner. Built for "open another branch" - the new store is
 * an independent tenant with the same menu.
 *
 * Copied: all store settings, branch + delivery zones, modifier sets, menu
 * categories/items (sizes, option groups + options), bundles, notices.
 * NOT copied: payment provider config, custom domain, billing linkage, SMS
 * credit balance, order counter, and all runtime data (orders, customers,
 * reviews, payments, push subscriptions). Per-tenant secrets that ARE settings
 * (AI keys, WhatsApp token) are carried over.
 */
export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const body = TenantDuplicateSchema.parse(await req.json());

    if (!isValidSlug(body.slug)) {
      return apiError("validation_error", "slug לא תקין", 422, "slug");
    }

    const [slugTaken, emailTaken, source] = await Promise.all([
      prisma.tenant.findUnique({ where: { slug: body.slug }, select: { id: true } }),
      prisma.merchantUser.findUnique({
        where: { email: body.owner.email.toLowerCase() },
        select: { id: true },
      }),
      prisma.tenant.findUnique({
        where: { id },
        include: {
          branches: { where: { isPrimary: true }, take: 1, include: { zones: true } },
          modifierSets: { include: { options: true } },
          menuCategories: true,
          menuItems: {
            include: { sizes: true, optionGroups: { include: { options: true } } },
          },
          bundleOffers: { include: { triggers: true, addons: true } },
          notices: true,
        },
      }),
    ]);

    if (!source) return apiError("not_found", "מסעדת המקור לא נמצאה", 404);
    if (slugTaken) return apiError("validation_error", "ה-slug כבר תפוס", 409, "slug");
    if (emailTaken)
      return apiError("validation_error", "האימייל כבר בשימוש", 409, "owner.email");

    const passwordHash = await bcrypt.hash(body.owner.password, 10);
    const s = source;
    // WhatsApp review channel needs a token we may or may not be carrying;
    // it is carried over here, but a managed-WhatsApp subscription is billing
    // state that is not, so demote that channel to email.
    const reviewsChannel =
      s.reviewsChannel === "whatsapp_managed" ? "email" : s.reviewsChannel;

    const created = await prisma.$transaction(
      async (tx) => {
        // 1. Tenant - settings only. Payment/domain/billing/credits/runtime omitted.
        const t = await tx.tenant.create({
          data: {
            slug: body.slug,
            name: body.name?.trim() || s.name,
            logoLetter: s.logoLetter,
            logoUrl: s.logoUrl,
            coverImage: s.coverImage,
            themeId: s.themeId,
            businessType: s.businessType,
            cuisineType: s.cuisineType,
            about: s.about,
            vatNumber: s.vatNumber,
            status: "active",
            acceptsCash: s.acceptsCash,
            checkoutShowTracking: s.checkoutShowTracking,
            scheduledOrdersEnabled: s.scheduledOrdersEnabled,
            pickupEnabled: s.pickupEnabled,
            cutleryEnabled: s.cutleryEnabled,
            cutleryLabel: s.cutleryLabel,
            cutleryPrice: s.cutleryPrice,
            cutleryFreeAbove: s.cutleryFreeAbove,
            featuredBadgeLabel: s.featuredBadgeLabel,
            upsellSizeNudge: s.upsellSizeNudge,
            kioskEnabled: s.kioskEnabled,
            kioskWelcomeText: s.kioskWelcomeText,
            kioskIdleSeconds: s.kioskIdleSeconds,
            kioskCollectPhone: s.kioskCollectPhone,
            kioskRequirePhone: s.kioskRequirePhone,
            kioskStringOverrides: s.kioskStringOverrides ?? {},
            dashboardVersion: s.dashboardVersion,
            reviewsEnabled: s.reviewsEnabled,
            reviewsPublic: s.reviewsPublic,
            reviewsChannel,
            reviewsDelayMinutes: s.reviewsDelayMinutes,
            smsSender: s.smsSender,
            whatsappToken: s.whatsappToken,
            whatsappInstanceId: s.whatsappInstanceId,
            aiAdvisorEnabled: s.aiAdvisorEnabled,
            aiAdvisorPopupEnabled: s.aiAdvisorPopupEnabled,
            aiAdvisorSuggestions: s.aiAdvisorSuggestions,
            aiProvider: s.aiProvider,
            aiGeminiApiKey: s.aiGeminiApiKey,
            aiClaudeApiKey: s.aiClaudeApiKey,
            merchantUsers: {
              create: [
                {
                  email: body.owner.email.toLowerCase(),
                  passwordHash,
                  name: body.owner.name,
                  role: "owner",
                },
              ],
            },
          },
        });

        // 2. Primary branch + delivery zones.
        const ob = s.branches[0];
        if (ob) {
          await tx.branch.create({
            data: {
              tenantId: t.id,
              isPrimary: true,
              name: ob.name,
              address: ob.address,
              lat: ob.lat,
              lng: ob.lng,
              phone: ob.phone,
              email: ob.email,
              status: ob.status,
              busyEtaBoostMinutes: ob.busyEtaBoostMinutes,
              hours: ob.hours as object,
              minOrder: ob.minOrder,
              deliveryFee: ob.deliveryFee,
              serviceFee: ob.serviceFee,
              freeDeliveryMinOrder: ob.freeDeliveryMinOrder,
              freeDeliveryMinItems: ob.freeDeliveryMinItems,
              zones: {
                create: ob.zones.map((z) => ({
                  name: z.name,
                  radiusKm: z.radiusKm,
                  ...(z.geometry != null ? { geometry: z.geometry as object } : {}),
                  cities: z.cities,
                  deliveryFee: z.deliveryFee,
                  minOrder: z.minOrder,
                  freeDeliveryAbove: z.freeDeliveryAbove,
                  minEta: z.minEta,
                  maxEta: z.maxEta,
                  active: z.active,
                })),
              },
            },
          });
        }

        // 3. Modifier sets (template library). Build old->new id map for
        //    item option groups that reference a templateSetId.
        const setMap = new Map<string, string>();
        for (const set of s.modifierSets) {
          const ns = await tx.modifierSet.create({
            data: {
              tenantId: t.id,
              name: set.name,
              type: set.type,
              required: set.required,
              minSelect: set.minSelect,
              maxSelect: set.maxSelect,
              includedFree: set.includedFree,
              helpText: set.helpText,
              position: set.position,
              allowHalf: set.allowHalf,
              splitPrice: set.splitPrice,
              customHalfPrice: set.customHalfPrice,
              bundleCount: set.bundleCount,
              bundlePrice: set.bundlePrice,
              maxPerSide: set.maxPerSide,
              externalSource: set.externalSource,
              externalId: set.externalId,
              options: {
                create: set.options.map((o) => ({
                  name: o.name,
                  priceDelta: o.priceDelta,
                  halfPriceDelta: o.halfPriceDelta,
                  isDefault: o.isDefault,
                  available: o.available,
                  imageUrl: o.imageUrl,
                  maxQuantity: o.maxQuantity,
                  position: o.position,
                  externalId: o.externalId,
                })),
              },
            },
          });
          setMap.set(set.id, ns.id);
        }

        // 4. Categories.
        const catMap = new Map<string, string>();
        for (const c of s.menuCategories) {
          const nc = await tx.menuCategory.create({
            data: {
              tenantId: t.id,
              name: c.name,
              icon: c.icon,
              color: c.color,
              position: c.position,
              active: c.active,
              upsellInCart: c.upsellInCart,
              upsellBeforeCheckout: c.upsellBeforeCheckout,
              externalSource: c.externalSource,
              externalId: c.externalId,
            },
          });
          catMap.set(c.id, nc.id);
        }

        // 5. Items + sizes + option groups (+ inline options), remapping
        //    category and template-set references.
        const itemMap = new Map<string, string>();
        for (const it of s.menuItems) {
          const newCategoryId = catMap.get(it.categoryId);
          if (!newCategoryId) continue;
          const ni = await tx.menuItem.create({
            data: {
              tenantId: t.id,
              categoryId: newCategoryId,
              name: it.name,
              description: it.description,
              imageUrl: it.imageUrl,
              images: it.images,
              artType: it.artType,
              basePrice: it.basePrice,
              prepMinutes: it.prepMinutes,
              available: it.available,
              featured: it.featured,
              position: it.position,
              tags: it.tags,
              sku: it.sku,
              availableFrom: it.availableFrom,
              availableTo: it.availableTo,
              availableDays: it.availableDays,
              stockRemaining: it.stockRemaining,
              externalSource: it.externalSource,
              externalId: it.externalId,
              sizes: {
                create: it.sizes.map((sz) => ({
                  code: sz.code,
                  name: sz.name,
                  priceDelta: sz.priceDelta,
                  isDefault: sz.isDefault,
                  position: sz.position,
                })),
              },
              optionGroups: {
                create: it.optionGroups.map((g) => ({
                  name: g.name,
                  type: g.type,
                  required: g.required,
                  minSelect: g.minSelect,
                  maxSelect: g.maxSelect,
                  includedFree: g.includedFree,
                  helpText: g.helpText,
                  position: g.position,
                  allowHalf: g.allowHalf,
                  splitPrice: g.splitPrice,
                  customHalfPrice: g.customHalfPrice,
                  bundleCount: g.bundleCount,
                  bundlePrice: g.bundlePrice,
                  maxPerSide: g.maxPerSide,
                  templateSetId: g.templateSetId
                    ? (setMap.get(g.templateSetId) ?? null)
                    : null,
                  options: {
                    create: g.options.map((o) => ({
                      name: o.name,
                      priceDelta: o.priceDelta,
                      halfPriceDelta: o.halfPriceDelta,
                      isDefault: o.isDefault,
                      available: o.available,
                      imageUrl: o.imageUrl,
                      maxQuantity: o.maxQuantity,
                      position: o.position,
                    })),
                  },
                })),
              },
            },
          });
          itemMap.set(it.id, ni.id);
        }

        // 6. Bundles - remap linked/trigger/addon item ids.
        for (const b of s.bundleOffers) {
          await tx.bundleOffer.create({
            data: {
              tenantId: t.id,
              name: b.name,
              description: b.description,
              imageUrl: b.imageUrl,
              bundlePrice: b.bundlePrice,
              active: b.active,
              position: b.position,
              validFrom: b.validFrom,
              validUntil: b.validUntil,
              linkedItemId: b.linkedItemId
                ? (itemMap.get(b.linkedItemId) ?? null)
                : null,
              triggers: {
                create: b.triggers
                  .filter((tr) => itemMap.has(tr.itemId))
                  .map((tr) => ({ itemId: itemMap.get(tr.itemId)! })),
              },
              addons: {
                create: b.addons
                  .filter((a) => itemMap.has(a.itemId))
                  .map((a) => ({ itemId: itemMap.get(a.itemId)!, qty: a.qty })),
              },
            },
          });
        }

        // 7. Notices - remap category/item references.
        for (const n of s.notices) {
          await tx.notice.create({
            data: {
              tenantId: t.id,
              scope: n.scope,
              categoryId: n.categoryId ? (catMap.get(n.categoryId) ?? null) : null,
              itemId: n.itemId ? (itemMap.get(n.itemId) ?? null) : null,
              kind: n.kind,
              title: n.title,
              body: n.body,
              icon: n.icon,
              active: n.active,
              position: n.position,
            },
          });
        }

        return t;
      },
      { timeout: 55_000, maxWait: 15_000 },
    );

    return apiJson(
      {
        tenant: {
          id: created.id,
          slug: created.slug,
          name: created.name,
          status: created.status,
        },
      },
      201,
    );
  },
);
