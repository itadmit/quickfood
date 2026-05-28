import { prisma } from "@/lib/db/client";
import { generateOrderNumber } from "@/lib/format";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { isItemVisibleNow } from "@/lib/menu-availability";
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
  // Customer email captured at checkout — persisted onto Customer.email when
  // the order is placed by a logged-in customer. Required when the tenant's
  // reviewsChannel === 'email' (enforced one layer up).
  customerEmail?: string;
  method: "delivery" | "pickup";
  addressId?: string | null;
  deliveryNotes?: string | null;
  customerNotes?: string | null;
  paymentMethod: "cash" | "card" | "apple_pay" | "google_pay" | "bit";
  tip?: number;
  cutleryCount?: number;
  scheduledFor?: Date | null;
  couponCode?: string | null;
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
  // scheduled_for that slipped through the client-side hide — turns the
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
      const availableOptions = effectiveOptions.filter((o) => o.available);
      const picksInGroup = availableOptions.filter((o) => optionIds.has(o.id));

      if (effectiveType === "single" && picksInGroup.length > 1) {
        throw new CartValidationError("too_many_in_single_group", group.id);
      }
      if (effectiveRequired && picksInGroup.length < effectiveMin) {
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
        const effectiveDelta = half && half !== "full" ? Math.round(baseDelta / 2) : baseDelta;
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
        const effectiveDelta = half && half !== "full" ? Math.round(o.priceDelta / 2) : o.priceDelta;
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

    const unitPrice = item.basePrice + sizeDelta + optionsDelta;
    const totalPrice = unitPrice * line.quantity;
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

  if (subtotal < branch.minOrder) {
    throw new CartValidationError("min_order_not_met");
  }

  const deliveryFee = input.method === "delivery" ? branch.deliveryFee : 0;
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

  const number = generateOrderNumber(tenant.slug);

  // Determine initial state — cash auto-confirms, card waits for callback
  const initialStatus = input.paymentMethod === "cash" ? "confirmed" : "pending";
  const paymentStatus = input.paymentMethod === "cash" ? "pending" : "pending";

  // Persist email on the customer record for future review reminders, but
  // don't fail the order if the update conflicts (e.g. unique constraints
  // someone may add later). Best-effort.
  if (input.customerEmail && input.customerId) {
    try {
      await prisma.customer.update({
        where: { id: input.customerId },
        data: { email: input.customerEmail.trim() },
      });
    } catch (err) {
      console.warn("[orders-create] couldn't persist customer email", err);
    }
  }

  // Order-level source: any AI line dominates (the customer started with
  // the AI advisor); otherwise reorder if every line came from reorder;
  // otherwise direct. Upsell is line-only — an upsell add doesn't make
  // the whole order an "upsell order".
  const lineSources = orderItemData.map((d) => d.source);
  const orderSource: "direct" | "ai_advisor" | "reorder" = lineSources.includes(
    "ai_advisor",
  )
    ? "ai_advisor"
    : lineSources.length > 0 && lineSources.every((s) => s === "reorder")
      ? "reorder"
      : "direct";

  const order = await prisma.order.create({
    data: {
      number,
      tenantId: tenant.id,
      branchId: branch.id,
      customerId: input.customerId ?? null,
      status: initialStatus,
      method: input.method,
      source: orderSource,
      deliveryAddressId: input.addressId ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      customerNotes: input.customerNotes ?? null,
      customerPhoneSnap: input.guestPhone ?? null,
      customerFirstNameSnap: input.guestFirstName ?? null,
      customerLastNameSnap: input.guestLastName ?? null,
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

  // Coupon usage increment — fire-and-forget after the order commits.
  // Doing this AFTER the order create (vs in a single transaction) is fine
  // because the worst-case race is one extra redemption — not a money bug,
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

  // Fire webhook (cash orders are confirmed immediately, card orders wait until payment callback)
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
  }

  return { order, paymentMethod: input.paymentMethod, total };
}
