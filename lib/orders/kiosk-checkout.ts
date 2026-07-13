import { prisma } from "@/lib/db/client";
import { createOrder, CartValidationError, type CreateOrderInput } from "@/lib/orders-create";
import { priceGroupOptions } from "@/lib/option-pricing";
import { Prisma } from "@prisma/client";

const EXPIRY_MINUTES = 30;

// Prefix tucked onto the orderReference we ship to Grow (cField1) so the
// callback knows "this isn't a real Order, it's a kiosk checkout still
// waiting to become one." Short enough to fit Grow's 50-char limit.
export const KIOSK_CHECKOUT_REF_PREFIX = "KCO-";

export interface KioskCheckoutResult {
  ok: true;
  checkoutId: string;
  amount: number;
  expiresAt: Date;
}

export interface KioskCheckoutError {
  ok: false;
  code: string;
  field?: string;
}

// Server-side cart pricer - items + sizes + options + bundle discounts.
// Mirrors the subset of orders-create.ts pricing that kiosk orders use
// (no coupons / delivery / service / tip - kiosk is pickup-only).
async function priceKioskCart(input: CreateOrderInput): Promise<{
  total: number;
  error?: CartValidationError;
}> {
  if (input.lines.length === 0) {
    return { total: 0, error: new CartValidationError("cart_empty") };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true, status: true, kioskEnabled: true },
  });
  if (!tenant) return { total: 0, error: new CartValidationError("tenant_not_found") };
  if (tenant.status !== "active") {
    return { total: 0, error: new CartValidationError("tenant_inactive") };
  }
  if (!tenant.kioskEnabled) {
    return { total: 0, error: new CartValidationError("kiosk_disabled") };
  }

  const itemIds = Array.from(new Set(input.lines.map((l) => l.item_id)));
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, tenantId: tenant.id },
    include: {
      sizes: { select: { id: true, priceDelta: true } },
      optionGroups: {
        include: {
          options: true,
          templateSet: { include: { options: true } },
        },
      },
    },
  });
  const itemMap = new Map(items.map((it) => [it.id, it]));

  let subtotal = 0;
  for (const line of input.lines) {
    const item = itemMap.get(line.item_id);
    if (!item) {
      return { total: 0, error: new CartValidationError("item_not_found", line.item_id) };
    }
    if (!item.available) {
      return { total: 0, error: new CartValidationError("item_unavailable", line.item_id) };
    }
    let unit = item.basePrice;
    if (line.size_id) {
      const size = item.sizes.find((s) => s.id === line.size_id);
      if (!size) {
        return { total: 0, error: new CartValidationError("size_not_found", line.size_id) };
      }
      unit += size.priceDelta;
    }
    // Price options with the same engine createOrder uses (modifier-set
    // resolution, includedFree, bundles, repeated ids as quantities) so the
    // amount charged via Grow matches the order that materializes later.
    const optionCounts = new Map<string, number>();
    for (const id of line.option_ids ?? []) {
      optionCounts.set(id, (optionCounts.get(id) ?? 0) + 1);
    }
    let matchedUnits = 0;
    for (const grp of item.optionGroups) {
      const fromSet = grp.templateSet;
      const effectiveOptions = fromSet ? fromSet.options : grp.options;
      const allowQty = grp.allowQty || (fromSet?.allowQty ?? false);
      const picksInGroup = effectiveOptions.filter((o) => optionCounts.has(o.id));
      if (picksInGroup.length === 0) continue;
      matchedUnits += picksInGroup.reduce((n, o) => n + (optionCounts.get(o.id) ?? 0), 0);
      const units = picksInGroup.flatMap((o) =>
        Array.from({ length: allowQty ? (optionCounts.get(o.id) ?? 0) : 1 }, (_, i) => ({
          id: `${o.id}#${i}`,
          priceDelta: o.priceDelta,
          halfPriceDelta: o.halfPriceDelta,
          half: line.option_placements?.[o.id] ?? null,
        })),
      );
      const ownBundle = grp.bundleCount > 0;
      const charges = priceGroupOptions(units, {
        includedFree: fromSet?.includedFree ?? grp.includedFree,
        bundleCount: ownBundle ? grp.bundleCount : (fromSet?.bundleCount ?? 0),
        bundlePrice: ownBundle ? grp.bundlePrice : (fromSet?.bundlePrice ?? 0),
        splitPrice: grp.splitPrice || (fromSet?.splitPrice ?? false),
        customHalfPrice: grp.customHalfPrice || (fromSet?.customHalfPrice ?? false),
      });
      for (const charge of charges.values()) unit += charge;
    }
    const requestedUnits = (line.option_ids ?? []).length;
    if (matchedUnits < requestedUnits) {
      return { total: 0, error: new CartValidationError("option_not_found", line.item_id) };
    }
    subtotal += unit * line.quantity;
  }

  if (input.appliedBundleIds && input.appliedBundleIds.length > 0) {
    const bundles = await prisma.bundleOffer.findMany({
      where: {
        id: { in: input.appliedBundleIds },
        tenantId: tenant.id,
        active: true,
      },
      include: {
        triggers: { select: { itemId: true } },
        addons: { include: { item: { select: { basePrice: true } } } },
        linkedItem: { select: { basePrice: true } },
      },
    });
    const cartItemIds = new Set(input.lines.map((l) => l.item_id));
    let totalDiscount = 0;
    for (const b of bundles) {
      const triggerInCart = b.triggers.some((t) => cartItemIds.has(t.itemId));
      if (!triggerInCart) continue;
      if (b.linkedItem) {
        const linkedInCart = input.lines.some(
          (l) => l.item_id === b.triggers.find((t) => l.item_id === t.itemId)?.itemId,
        );
        if (!linkedInCart) continue;
        const triggerSum = b.triggers.reduce((acc, t) => {
          const item = itemMap.get(t.itemId);
          return cartItemIds.has(t.itemId) && item ? acc + item.basePrice : acc;
        }, 0);
        const saving = Math.max(0, triggerSum - b.linkedItem.basePrice);
        totalDiscount += saving;
      } else if (b.addons.length > 0) {
        const addonSum = b.addons.reduce(
          (acc, a) => acc + a.item.basePrice * a.qty,
          0,
        );
        const saving = Math.max(0, addonSum - b.bundlePrice);
        totalDiscount += saving;
      }
    }
    subtotal = Math.max(0, subtotal - totalDiscount);
  }

  return { total: subtotal };
}

export async function createKioskCheckout(
  input: CreateOrderInput,
): Promise<KioskCheckoutResult | KioskCheckoutError> {
  if (!input.kiosk) {
    return { ok: false, code: "kiosk_only" };
  }
  if (input.paymentMethod === "cash") {
    return { ok: false, code: "card_only" };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true, kioskEnabled: true },
  });
  if (!tenant) return { ok: false, code: "tenant_not_found" };
  if (!tenant.kioskEnabled) return { ok: false, code: "kiosk_disabled" };

  const priced = await priceKioskCart(input);
  if (priced.error) {
    return { ok: false, code: priced.error.code, field: priced.error.field };
  }
  if (priced.total <= 0) {
    return { ok: false, code: "amount_zero" };
  }

  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
  const checkout = await prisma.kioskPendingCheckout.create({
    data: {
      tenantId: tenant.id,
      cartData: input as unknown as Prisma.InputJsonValue,
      amount: priced.total,
      expiresAt,
    },
    select: { id: true, amount: true, expiresAt: true },
  });

  return {
    ok: true,
    checkoutId: checkout.id,
    amount: checkout.amount,
    expiresAt: checkout.expiresAt,
  };
}

// Called from the Grow callback when payment for a checkout-prefixed
// reference confirms. Idempotent - returns the existing orderId if the
// checkout was already materialized.
export async function materializeKioskCheckout(
  checkoutId: string,
): Promise<{ ok: true; orderId: string } | { ok: false; code: string }> {
  const checkout = await prisma.kioskPendingCheckout.findUnique({
    where: { id: checkoutId },
    select: { id: true, status: true, orderId: true, cartData: true },
  });
  if (!checkout) return { ok: false, code: "checkout_not_found" };
  if (checkout.status === "completed" && checkout.orderId) {
    return { ok: true, orderId: checkout.orderId };
  }
  if (checkout.status === "abandoned") {
    return { ok: false, code: "checkout_abandoned" };
  }

  try {
    const input = checkout.cartData as unknown as CreateOrderInput;
    // Stamp the source so the POS queue + analytics know the order came
    // through the kiosk even when the cart was hydrated from JSON.
    const result = await createOrder({ ...input, sourceOverride: "kiosk" });

    await prisma.kioskPendingCheckout.update({
      where: { id: checkoutId },
      data: { status: "completed", orderId: result.order.id },
    });

    return { ok: true, orderId: result.order.id };
  } catch (err) {
    if (err instanceof CartValidationError) {
      console.error("[kiosk-checkout] materialize failed", err);
      return { ok: false, code: err.code };
    }
    throw err;
  }
}

export function checkoutRefToId(ref: string | null | undefined): string | null {
  if (!ref || !ref.startsWith(KIOSK_CHECKOUT_REF_PREFIX)) return null;
  return ref.slice(KIOSK_CHECKOUT_REF_PREFIX.length);
}

export function idToCheckoutRef(checkoutId: string): string {
  return `${KIOSK_CHECKOUT_REF_PREFIX}${checkoutId}`;
}
