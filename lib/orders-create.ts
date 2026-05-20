import { prisma } from "@/lib/db/client";
import { generateOrderNumber } from "@/lib/format";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import type { Prisma } from "@prisma/client";

/**
 * Build an order from a customer-submitted cart payload.
 * Server-side validates every price; if anything mismatches we silently use
 * the server price (the customer cannot fabricate prices).
 */

export interface CartLineInput {
  item_id: string;
  quantity: number;
  size_id?: string | null;
  option_ids?: string[];
  notes?: string | null;
}

export interface CreateOrderInput {
  tenantSlug: string;
  customerId?: string;
  guestPhone?: string;
  guestFirstName?: string;
  guestLastName?: string;
  method: "delivery" | "pickup";
  addressId?: string | null;
  deliveryNotes?: string | null;
  customerNotes?: string | null;
  paymentMethod: "cash" | "card" | "apple_pay" | "google_pay" | "bit";
  tip?: number;
  scheduledFor?: Date | null;
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

  if (input.lines.length === 0) {
    throw new CartValidationError("cart_empty");
  }

  // Load all menu items + their sizes/options in one shot
  const itemIds = Array.from(new Set(input.lines.map((l) => l.item_id)));
  const items = await prisma.menuItem.findMany({
    where: { id: { in: itemIds }, tenantId: tenant.id, available: true },
    include: {
      sizes: true,
      optionGroups: { include: { options: true } },
    },
  });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  let subtotal = 0;
  const orderItemData: Prisma.OrderItemCreateManyOrderInput[] = [];

  for (const line of input.lines) {
    const item = itemsById.get(line.item_id);
    if (!item) throw new CartValidationError("item_unavailable", line.item_id);
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

    const selectedOptions: Array<{ group_id: string; option_id: string; name: string; price_delta: number }> = [];
    let optionsDelta = 0;
    const optionIds = new Set(line.option_ids ?? []);
    for (const group of item.optionGroups) {
      const picksInGroup = group.options.filter((o) => optionIds.has(o.id));
      if (group.type === "single" && picksInGroup.length > 1) {
        throw new CartValidationError("too_many_in_single_group", group.id);
      }
      if (group.required && picksInGroup.length < group.minSelect) {
        throw new CartValidationError("required_group_missing", group.id);
      }
      if (picksInGroup.length > group.maxSelect) {
        throw new CartValidationError("too_many_in_group", group.id);
      }
      for (const o of picksInGroup) {
        selectedOptions.push({
          group_id: group.id,
          option_id: o.id,
          name: o.name,
          price_delta: o.priceDelta,
        });
        optionsDelta += o.priceDelta;
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
    });
  }

  if (subtotal < branch.minOrder) {
    throw new CartValidationError("min_order_not_met");
  }

  const deliveryFee = input.method === "delivery" ? branch.deliveryFee : 0;
  const serviceFee = branch.serviceFee;
  const tip = input.tip ?? 0;
  const discount = 0;
  const total = subtotal + deliveryFee + serviceFee + tip - discount;

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

  const order = await prisma.order.create({
    data: {
      number,
      tenantId: tenant.id,
      branchId: branch.id,
      customerId: input.customerId ?? null,
      status: initialStatus,
      method: input.method,
      deliveryAddressId: input.addressId ?? null,
      deliveryNotes: input.deliveryNotes ?? null,
      customerNotes: input.customerNotes ?? null,
      customerPhoneSnap: input.guestPhone ?? null,
      customerFirstNameSnap: input.guestFirstName ?? null,
      customerLastNameSnap: input.guestLastName ?? null,
      subtotal,
      deliveryFee,
      serviceFee,
      tip,
      discount,
      total,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      scheduledFor: input.scheduledFor ?? null,
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
