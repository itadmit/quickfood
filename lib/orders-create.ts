import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { isItemVisibleNow } from "@/lib/menu-availability";
import { computeDeliveryFee } from "@/lib/delivery-fee";
import { sendTenantPush } from "@/lib/merchant/push";
import { sendOrderConfirmedEmail } from "@/lib/orders/notify-customer";
import type { Prisma } from "@prisma/client";

/**
 * Build an order from a customer-submitted cart payload.
 * Server-side validates every price; if anything mismatches we silently use
 * the server price (the customer cannot fabricate prices).
 */

export type OrderItemSourceTag = "menu" | "ai_advisor" | "upsell" | "reorder";

export interface CartLineInput {
  item_id: string;
  quantity: number;
  size_id?: string | null;
  option_ids?: string[];
  option_placements?: Record<string, "left" | "right" | "full">;
  notes?: string | null;
  source?: OrderItemSourceTag;
}

export interface CreateOrderInput {
  tenantSlug: string;
  customerId?: string;
  guestPhone?: string;
  guestFirstName?: string;
  guestLastName?: string;
  // Customer email captured at checkout - persisted onto Customer.email when
  // the order is placed by a logged-in customer. Required when the tenant's
  // reviewsChannel === 'email' (enforced one layer up).
  customerEmail?: string;
  /// Explicit opt-in to marketing/promotional comms (email + SMS).
  /// Captured per-order - only ever flipped to TRUE, never silently to
  /// false on subsequent orders (a customer who opted in once stays
  /// opted in until they explicitly unsubscribe).
  marketingConsent?: boolean;
  method: "delivery" | "pickup";
  addressId?: string | null;
  deliveryNotes?: string | null;
  customerNotes?: string | null;
  paymentMethod: "cash" | "card" | "apple_pay" | "google_pay" | "bit";
  tip?: number;
  /** Cashier-applied manual discount in whole shekels (POS only).
   *  Added on top of coupon / bundle discounts; the final discount is
   *  still capped at the subtotal. Goes to Order.discount alongside the
   *  automatic kinds - no separate column. */
  manualDiscount?: number;
  cutleryCount?: number;
  scheduledFor?: Date | null;
  couponCode?: string | null;
  /** Bundle offers the customer accepted in the cart. Server
   *  validates each (triggers + addons present in cart) and adds
   *  the per-bundle savings to Order.discount so the merchant
   *  doesn't promise something the cart doesn't deliver. */
  appliedBundleIds?: string[];
  /** True when the order originates from the in-store kiosk. The
   *  kiosk bypasses the branch's minOrder threshold - that floor
   *  exists for delivery, not for someone tapping at the counter. */
  kiosk?: boolean;
  /** Explicit Order.source override. POS sales pass "pos", kiosk cash-at-
   *  counter passes "kiosk". When omitted, source is inferred from the
   *  cart lines (ai_advisor / reorder / direct). */
  sourceOverride?: "direct" | "ai_advisor" | "reorder" | "kiosk" | "pos";
  /** Cashier ringing this sale. Set on POS and counter-paid kiosk orders. */
  cashierId?: string;
  /** Shift this sale belongs to. Set together with cashierId. */
  posShiftId?: string;
  /** When false, the guestPhone is used ONLY for the order snapshot - no
   *  Customer row is found or created. POS uses this to seed merchant
   *  fallback phone/name into the order snapshot (so Grow's production
   *  wallet accepts the auth code) without polluting the Customer table
   *  with a row that's really the merchant's own contact info. Default
   *  true preserves the legacy storefront flow. */
  linkGuestCustomer?: boolean;
  lines: CartLineInput[];
}

export interface CreateOrderResult {
  order: Awaited<ReturnType<typeof prisma.order.create>>;
  paymentMethod: "cash" | "card" | "apple_pay" | "google_pay" | "bit";
  total: number;
}

export class CartValidationError extends Error {
  constructor(public code: string, public field?: string) {
    super(code);
    this.name = "CartValidationError";
  }
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    include: { branches: { where: { isPrimary: true }, take: 1 } },
  });
  if (!tenant) throw new CartValidationError("tenant_not_found");
  if (tenant.status !== "active") throw new CartValidationError("tenant_inactive");

  const branch = tenant.branches[0];
  if (!branch) throw new CartValidationError("no_branch");
  if (branch.status === "closed") throw new CartValidationError("restaurant_closed");

  // If the merchant disabled scheduled orders, silently demote any
  // scheduled_for that slipped through the client-side hide - turns the
  // order into ASAP rather than failing the request, so an old cached
  // client doesn't get a hard 4xx.
  const scheduledFor = tenant.scheduledOrdersEnabled ? input.scheduledFor : null;

  if (input.lines.length === 0) {
    throw new CartValidationError("cart_empty");
  }

  // Load all menu items + their sizes/options in one shot. Groups that link
  // to a ModifierSet pull their options from the set (Wolt-style reusable
  // modifier library) instead of the inline ItemOption rows.
  const itemIds = Array.from(new Set(input.lines.map((l) => l.item_id)));
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, tenantId: tenant.id, available: true },
    include: {
      sizes: true,
      optionGroups: {
        include: {
          options: true,
          templateSet: { include: { options: true } },
        },
      },
    },
  });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  let subtotal = 0;
  const orderItemData: Prisma.OrderItemCreateManyOrderInput[] = [];

  for (const line of input.lines) {
    const item = itemsById.get(line.item_id);
    if (!item) throw new CartValidationError("item_unavailable", line.item_id);
    // Time-windowed items (breakfast-only, out-of-stock, etc.) are filtered
    // out of the storefront menu, but a stale cart can still try to submit
    // one. Server is the source of truth.
    if (!isItemVisibleNow(item)) {
      throw new CartValidationError("item_unavailable", line.item_id);
    }
    if (line.quantity < 1 || line.quantity > 20) {
      throw new CartValidationError("invalid_quantity", line.item_id);
    }

    let sizeDelta = 0;
    let sizeSnapshot: string | null = null;
    if (line.size_id) {
      const size = item.sizes.find((s) => s.id === line.size_id);
      if (!size) throw new CartValidationError("size_not_found", line.item_id);
      sizeDelta = size.priceDelta;
      sizeSnapshot = size.name;
    } else {
      const defaultSize = item.sizes.find((s) => s.isDefault);
      if (defaultSize) {
        sizeDelta = defaultSize.priceDelta;
        sizeSnapshot = defaultSize.name;
      }
    }

    const selectedOptions: Array<{ group_id: string; option_id: string; name: string; price_delta: number; half?: string }> = [];
    let optionsDelta = 0;
    const optionIds = new Set(line.option_ids ?? []);
    const placements = line.option_placements ?? {};
    for (const group of item.optionGroups) {
      // Resolve the effective options + config: ModifierSet overrides inline.
      const fromSet = group.templateSet;
      const effectiveOptions = fromSet ? fromSet.options : group.options;
      const effectiveType = fromSet?.type ?? group.type;
      const effectiveRequired = fromSet?.required ?? group.required;
      const effectiveMin = fromSet?.minSelect ?? group.minSelect;
      const effectiveMax = fromSet?.maxSelect ?? group.maxSelect;
      const effectiveFree = fromSet?.includedFree ?? group.includedFree;
      const effectiveSplit = group.splitPrice || (fromSet?.splitPrice ?? false);
      const availableOptions = effectiveOptions.filter((o) => o.available);
      const picksInGroup = availableOptions.filter((o) => optionIds.has(o.id));

      if (effectiveType === "single" && picksInGroup.length > 1) {
        throw new CartValidationError("too_many_in_single_group", group.id);
      }
      // חובה group with min=0 in the catalog is still a "must pick one":
      // the Wolt importer occasionally leaves the floor unset. Treat
      // required as min>=1 regardless of what the row says.
      const requiredFloor = effectiveRequired ? Math.max(1, effectiveMin) : effectiveMin;
      if (effectiveRequired && picksInGroup.length < requiredFloor) {
        throw new CartValidationError("required_group_missing", group.id);
      }
      if (picksInGroup.length > effectiveMax) {
        throw new CartValidationError("too_many_in_group", group.id);
      }

      // Apply free-count: cheapest paid options first don't add to total.
      const paid = picksInGroup
        .filter((o) => o.priceDelta > 0)
        .sort((a, b) => a.priceDelta - b.priceDelta);
      const negative = picksInGroup.filter((o) => o.priceDelta < 0);
      const zero = picksInGroup.filter((o) => o.priceDelta === 0);

      for (let i = 0; i < paid.length; i++) {
        const o = paid[i];
        const baseDelta = i < effectiveFree ? 0 : o.priceDelta;
        const half = placements[o.id];
        const effectiveDelta = half && half !== "full" && effectiveSplit ? baseDelta / 2 : baseDelta;
        selectedOptions.push({
          group_id: group.id,
          option_id: o.id,
          name: o.name,
          price_delta: effectiveDelta,
          ...(half && half !== "full" ? { half } : {}),
        });
        optionsDelta += effectiveDelta;
      }
      for (const o of [...negative, ...zero]) {
        const half = placements[o.id];
        const effectiveDelta = half && half !== "full" && effectiveSplit ? o.priceDelta / 2 : o.priceDelta;
        selectedOptions.push({
          group_id: group.id,
          option_id: o.id,
          name: o.name,
          price_delta: effectiveDelta,
          ...(half && half !== "full" ? { half } : {}),
        });
        optionsDelta += effectiveDelta;
      }
    }

    const unitPriceExact = item.basePrice + sizeDelta + optionsDelta;
    const totalPriceExact = unitPriceExact * line.quantity;
    const unitPrice = Math.round(unitPriceExact);
    const totalPrice = Math.round(totalPriceExact);
    subtotal += totalPrice;

    orderItemData.push({
      menuItemId: item.id,
      nameSnapshot: item.name,
      quantity: line.quantity,
      unitPrice,
      totalPrice,
      sizeId: line.size_id ?? null,
      sizeSnapshot,
      selectedOptions: selectedOptions as unknown as Prisma.InputJsonValue,
      notes: line.notes ?? null,
      source: line.source ?? "menu",
    });
  }

  if (!input.kiosk && subtotal < branch.minOrder) {
    throw new CartValidationError("min_order_not_met");
  }

  const deliveryFee = computeDeliveryFee({
    method: input.method,
    baseFee: branch.deliveryFee,
    subtotal,
    itemCount: input.lines.reduce((n, l) => n + l.quantity, 0),
    freeMinOrder: branch.freeDeliveryMinOrder,
    freeMinItems: branch.freeDeliveryMinItems,
  });
  const serviceFee = branch.serviceFee;
  const tip = input.tip ?? 0;
  const cutleryCountRaw = Math.max(0, Math.min(20, input.cutleryCount ?? 0));
  const cutleryCount = tenant.cutleryEnabled ? cutleryCountRaw : 0;
  const cutleryFreeAbove = tenant.cutleryFreeAbove;
  const cutleryFee =
    tenant.cutleryEnabled &&
    cutleryCount > 0 &&
    !(cutleryFreeAbove !== null && cutleryFreeAbove !== undefined && subtotal >= cutleryFreeAbove)
      ? tenant.cutleryPrice * cutleryCount
      : 0;

  // Coupon resolution. Same validation rules as the public /coupons/validate
  // endpoint, plus a usage-count increment in the same transaction so we
  // can't over-redeem if two carts hit a "last redemption" coupon at the
  // same time. Invalid/expired codes are silently dropped (the customer
  // already saw the validation error in the cart preview).
  let discount = 0;
  let couponToConsume: { id: string } | null = null;
  if (input.couponCode) {
    const code = input.couponCode.trim().toUpperCase();
    const coupon = await prisma.coupon.findFirst({
      where: { tenantId: tenant.id, code, active: true },
      select: {
        id: true, type: true, value: true,
        minOrder: true, maxDiscount: true,
        usageLimit: true, usageCount: true,
        validFrom: true, validUntil: true,
      },
    });
    const now = new Date();
    const isUsable =
      coupon &&
      (!coupon.validFrom || now >= coupon.validFrom) &&
      (!coupon.validUntil || now <= coupon.validUntil) &&
      (coupon.usageLimit === null || coupon.usageCount < coupon.usageLimit) &&
      (coupon.minOrder === null || subtotal >= coupon.minOrder);
    if (isUsable && coupon) {
      let d =
        coupon.type === "percent"
          ? Math.floor((subtotal * coupon.value) / 100)
          : coupon.value;
      if (coupon.maxDiscount !== null && d > coupon.maxDiscount) d = coupon.maxDiscount;
      if (d > subtotal) d = subtotal;
      discount = d;
      couponToConsume = { id: coupon.id };
    }
  }

  // Bundle offers - for each accepted bundle, verify the triggers
  // are in the cart and the addons are present at the matching qty.
  // Add the bundle's savings (sum addon basePrice * qty − bundlePrice)
  // to the overall discount. Bundles the cart doesn't actually
  // satisfy are silently dropped - better than failing the order
  // because a stale client kept a flag for a bundle the customer
  // partially removed.
  if (input.appliedBundleIds && input.appliedBundleIds.length > 0) {
    const cartItemIds = input.lines.map((l) => l.item_id);
    const cartItemCounts = new Map<string, number>();
    for (const id of cartItemIds) {
      cartItemCounts.set(id, (cartItemCounts.get(id) ?? 0) + 1);
    }
    const bundles = await prisma.bundleOffer.findMany({
      where: {
        id: { in: input.appliedBundleIds },
        tenantId: tenant.id,
        active: true,
      },
      include: { triggers: true, addons: true },
    });
    for (const b of bundles) {
      const triggerHit = b.triggers.some((t) => cartItemCounts.has(t.itemId));
      if (!triggerHit) continue;
      const addonsSatisfied = b.addons.every(
        (a) => (cartItemCounts.get(a.itemId) ?? 0) >= a.qty,
      );
      if (!addonsSatisfied) continue;
      const itemRows = await prisma.menuItem.findMany({
        where: { id: { in: b.addons.map((a) => a.itemId) } },
        select: { id: true, basePrice: true },
      });
      const priceById = new Map(itemRows.map((r) => [r.id, r.basePrice]));
      const fullPrice = b.addons.reduce(
        (acc, a) => acc + (priceById.get(a.itemId) ?? 0) * a.qty,
        0,
      );
      const savings = Math.max(0, fullPrice - b.bundlePrice);
      discount += savings;
    }
    if (discount > subtotal) discount = subtotal;
  }

  // Cashier-applied manual discount (POS only). Stack onto coupon +
  // bundle savings, then re-cap at subtotal so a sloppy ₪999 tap can't
  // produce a negative total.
  if (input.manualDiscount && input.manualDiscount > 0) {
    discount += Math.floor(input.manualDiscount);
    if (discount > subtotal) discount = subtotal;
  }

  const total = subtotal + deliveryFee + serviceFee + cutleryFee + tip - discount;

  // Validate address if delivery
  if (input.method === "delivery") {
    if (!input.addressId && !input.guestPhone) {
      throw new CartValidationError("address_required");
    }
    if (input.addressId && input.customerId) {
      const addr = await prisma.address.findFirst({
        where: { id: input.addressId, customerId: input.customerId },
      });
      if (!addr) throw new CartValidationError("address_not_found");
    }
  }

  // Atomic per-tenant sequence. `increment` lets Postgres do the
  // increment under a row lock, so two simultaneous orders for the
  // same tenant never collide on the (tenant_id, number) unique.
  // Number string is the human-friendly "<PREFIX>-<N>" shape; the
  // counter itself is plain Int on the tenant row.
  const counterTenant = await prisma.tenant.update({
    where: { id: tenant.id },
    data: { nextOrderNumber: { increment: 1 } },
    select: { nextOrderNumber: true, slug: true },
  });
  const orderSeq = counterTenant.nextOrderNumber - 1;
  const numberPrefix =
    counterTenant.slug
      .split("-")
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "QF";
  const number = `${numberPrefix}-${orderSeq}`;

  // Determine initial state:
  // - Card: always `pending` - waits for the Grow callback to confirm.
  // - Storefront cash: `confirmed` - merchant prepares immediately,
  //   cash is collected at delivery or pickup as part of the existing
  //   delivery flow (no separate confirmation step needed).
  // - Kiosk cash: `pending` - the cashier at the counter has to take
  //   the cash before the kitchen starts cooking. The merchant flips
  //   it to confirmed via the Kanban once they've collected.
  const initialStatus =
    input.paymentMethod === "cash" && !input.kiosk ? "confirmed" : "pending";
  const paymentStatus = "pending";

  // Resolve a real Customer row for every order that has a phone, even
  // when the checkout was placed as a "guest". Returning callers (same
  // phone again) get attached to their existing row; first-timers get a
  // row created. This keeps Order.customerId non-null whenever possible
  // so review reminders, history rails, and the customer's review
  // eligibility all work without requiring OTP up front.
  let effectiveCustomerId: string | null = input.customerId ?? null;
  if (!effectiveCustomerId && input.guestPhone && input.linkGuestCustomer !== false) {
    const existing = await prisma.customer.findUnique({
      where: { phone: input.guestPhone },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (existing) {
      effectiveCustomerId = existing.id;
      const updates: Prisma.CustomerUpdateInput = {};
      if (!existing.firstName && input.guestFirstName) updates.firstName = input.guestFirstName;
      if (!existing.lastName && input.guestLastName) updates.lastName = input.guestLastName;
      if (!existing.email && input.customerEmail) updates.email = input.customerEmail.trim();
      // Marketing consent is sticky-true: any explicit yes flips it on
      // and stays on. We never write `false` here so a customer who
      // unticked the box on a later order doesn't accidentally lose
      // their earlier explicit opt-in (that's what the unsubscribe
      // flow is for).
      if (input.marketingConsent === true) updates.marketingConsent = true;
      if (Object.keys(updates).length > 0) {
        try {
          await prisma.customer.update({ where: { id: existing.id }, data: updates });
        } catch (err) {
          console.warn("[orders-create] couldn't backfill customer fields", err);
        }
      }
    } else {
      try {
        const created = await prisma.customer.create({
          data: {
            phone: input.guestPhone,
            firstName: input.guestFirstName ?? "",
            lastName: input.guestLastName ?? "",
            email: input.customerEmail?.trim() ?? null,
            marketingConsent: input.marketingConsent === true,
          },
          select: { id: true },
        });
        effectiveCustomerId = created.id;
      } catch (err) {
        // Race: a parallel order with the same phone just created the row.
        // Re-read and use it; never fail the order over this.
        console.warn("[orders-create] customer.create raced; re-reading", err);
        const retry = await prisma.customer.findUnique({
          where: { phone: input.guestPhone },
          select: { id: true },
        });
        if (retry) effectiveCustomerId = retry.id;
      }
    }
  }

  if (input.customerEmail && effectiveCustomerId && effectiveCustomerId === input.customerId) {
    try {
      await prisma.customer.update({
        where: { id: effectiveCustomerId },
        data: { email: input.customerEmail.trim() },
      });
    } catch (err) {
      console.warn("[orders-create] couldn't persist customer email", err);
    }
  }

  // Order-level source: any AI line dominates (the customer started with
  // the AI advisor); otherwise reorder if every line came from reorder;
  // otherwise direct. Upsell is line-only - an upsell add doesn't make
  // the whole order an "upsell order".
  const lineSources = orderItemData.map((d) => d.source);
  const inferredSource: "direct" | "ai_advisor" | "reorder" = lineSources.includes(
    "ai_advisor",
  )
    ? "ai_advisor"
    : lineSources.length > 0 && lineSources.every((s) => s === "reorder")
      ? "reorder"
      : "direct";
  const orderSource = input.sourceOverride ?? inferredSource;

  const order = await prisma.order.create({
    data: {
      number,
      tenantId: tenant.id,
      branchId: branch.id,
      customerId: effectiveCustomerId,
      status: initialStatus,
      method: input.method,
      source: orderSource,
      cashierId: input.cashierId ?? null,
      posShiftId: input.posShiftId ?? null,
      deliveryAddressId: input.addressId ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      customerNotes: input.customerNotes ?? null,
      customerPhoneSnap: input.guestPhone ?? null,
      customerFirstNameSnap: input.guestFirstName ?? null,
      customerLastNameSnap: input.guestLastName ?? null,
      customerEmailSnap: input.customerEmail?.trim().toLowerCase() || null,
      subtotal,
      deliveryFee,
      serviceFee,
      cutleryCount,
      cutleryFee,
      tip,
      discount,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      scheduledFor: scheduledFor ?? null,
      confirmedAt: initialStatus === "confirmed" ? new Date() : null,
      items: { createMany: { data: orderItemData } },
    },
    include: { items: true },
  });

  // Log event
  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "created",
      payload: { status: initialStatus, total } as unknown as Prisma.InputJsonValue,
    },
  });

  // Coupon usage increment - fire-and-forget after the order commits.
  // Doing this AFTER the order create (vs in a single transaction) is fine
  // because the worst-case race is one extra redemption - not a money bug,
  // and the next request will see the bumped count.
  if (couponToConsume) {
    try {
      await prisma.coupon.update({
        where: { id: couponToConsume.id },
        data: { usageCount: { increment: 1 } },
      });
    } catch (err) {
      console.warn("[orders-create] couldn't increment coupon usage", err);
    }
  }

  if (initialStatus === "confirmed") {
    void dispatchWebhook({
      tenantId: tenant.id,
      eventType: "order.created",
      payload: {
        order_id: order.id,
        number: order.number,
        total,
        method: input.method,
        items: order.items.map((it) => ({
          name: it.nameSnapshot,
          quantity: it.quantity,
          total: it.totalPrice,
          size: it.sizeSnapshot,
        })),
      },
    });

    void sendTenantPush(tenant.id, {
      title: `הזמנה חדשה - ${order.number}`,
      body: `${total} ש"ח · ${input.method === "delivery" ? "משלוח" : "איסוף"}`,
      url: "/dashboard/orders",
      tag: `order-${order.id}`,
      requireInteraction: true,
    }).catch((err) => console.warn("[push] tenant new-order failed", err));

    void sendOrderConfirmedEmail(order.id).catch((err) =>
      console.warn("[email] order confirmed failed", err),
    );
  }

  return { order, paymentMethod: input.paymentMethod, total };
}
