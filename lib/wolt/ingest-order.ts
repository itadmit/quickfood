import { OrderItemSource, OrderSource } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { WoltOrderItem, WoltOrderPayload } from "./types";

// Map an incoming Wolt order into a QuickFood Order + OrderItems and persist
// it, idempotently. Wolt money is in minor units (agorot); QuickFood stores
// integer shekels, so we round amount/100.
//
// Item matching: items imported from Wolt carry MenuItem.externalId = the
// Wolt catalogue item id, so we can link an incoming order line back to the
// merchant's menu item. Unmatched lines still import with a name snapshot.

const SOURCE = "wolt";

function toShekels(minor: number | undefined): number {
  if (!minor) return 0;
  return Math.round(minor / 100);
}

function mapOptions(item: WoltOrderItem) {
  return (item.options ?? []).map((o) => ({
    group_id: o.id ?? "",
    option_id: o.id ?? "",
    name: [o.name, o.value].filter(Boolean).join(": "),
    price_delta: toShekels(o.price?.amount),
  }));
}

export interface IngestResult {
  orderId: string;
  created: boolean;
}

/**
 * Idempotent on (tenantId, externalSource='wolt', externalId=payload.id).
 * A retried webhook delivery returns the existing order without duplicating.
 */
export async function ingestWoltOrder(tenantId: string, payload: WoltOrderPayload): Promise<IngestResult> {
  const existing = await prisma.order.findUnique({
    where: {
      tenantId_externalSource_externalId: {
        tenantId,
        externalSource: SOURCE,
        externalId: payload.id,
      },
    },
    select: { id: true },
  });
  if (existing) return { orderId: existing.id, created: false };

  const branch = await prisma.branch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!branch) throw new Error(`Tenant ${tenantId} has no branch to attach the Wolt order to`);

  // Resolve menu items by Wolt catalogue id for the lines we can match.
  const woltItemIds = payload.items.map((i) => i.id).filter((x): x is string => !!x);
  const matched = woltItemIds.length
    ? await prisma.menuItem.findMany({
        where: { tenantId, externalSource: SOURCE, externalId: { in: woltItemIds } },
        select: { id: true, externalId: true },
      })
    : [];
  const itemIdByExternal = new Map(matched.map((m) => [m.externalId!, m.id]));

  const lines = payload.items.map((item) => {
    const unit = toShekels(item.price?.amount ?? item.total_price?.amount);
    const quantity = item.count || 1;
    const optionsDelta = mapOptions(item).reduce((a, o) => a + o.price_delta, 0);
    const unitPrice = unit + optionsDelta;
    return {
      menuItemId: item.id ? itemIdByExternal.get(item.id) ?? null : null,
      nameSnapshot: item.name,
      quantity,
      unitPrice,
      totalPrice: item.total_price ? toShekels(item.total_price.amount) : unitPrice * quantity,
      selectedOptions: mapOptions(item) as unknown as object,
      source: OrderItemSource.wolt,
    };
  });

  const subtotal = lines.reduce((a, l) => a + l.totalPrice, 0);
  const deliveryFee = toShekels(payload.delivery?.fee?.amount);
  const total = payload.price ? toShekels(payload.price.amount) : subtotal + deliveryFee;
  const method = (payload.type ?? payload.delivery?.type) === "homedelivery" ? "delivery" : "pickup";

  const number = `WOLT-${payload.order_number ?? payload.id.slice(0, 8)}`;

  const order = await prisma.order.create({
    data: {
      number,
      tenantId,
      branchId: branch.id,
      status: "pending",
      method,
      source: OrderSource.wolt,
      subtotal,
      deliveryFee,
      serviceFee: 0,
      tip: 0,
      discount: 0,
      total,
      paymentMethod: "card", // Wolt collects payment; closest local method
      paymentStatus: "paid",
      externalSource: SOURCE,
      externalId: payload.id,
      customerFirstNameSnap: payload.consumer_name ?? null,
      customerPhoneSnap: payload.consumer_phone_number ?? null,
      customerNotes: payload.consumer_comment ?? null,
      deliveryNotes: payload.delivery?.location?.formatted_address ?? null,
      items: {
        createMany: {
          data: lines.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.nameSnapshot,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            totalPrice: l.totalPrice,
            selectedOptions: l.selectedOptions,
            source: l.source,
          })),
        },
      },
    },
    select: { id: true },
  });

  await prisma.woltConnection.updateMany({
    where: { tenantId, status: "active" },
    data: { lastOrderAt: new Date() },
  });

  return { orderId: order.id, created: true };
}
