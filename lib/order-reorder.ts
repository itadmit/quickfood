import { prisma } from "@/lib/db/client";
import { splitDeliveryNotes, type CheckoutPrefill } from "@/lib/checkout-prefill";

/** Snapshot of an option as stored on OrderItem.selectedOptions. */
export interface StoredOption {
  group_id: string;
  option_id: string;
  name: string;
  price_delta: number;
}

interface OrderItemLike {
  menuItemId: string | null;
  nameSnapshot: string;
  quantity: number;
  sizeId: string | null;
  selectedOptions: unknown;
  notes: string | null;
}

/**
 * Stable, content-only fingerprint for an order's line-items. Two orders
 * with the same fingerprint should render as visually duplicate "previous
 * orders" so we filter the later one out.
 *
 * Includes: menuItemId, sizeId, quantity, normalized option ids, and notes.
 * Ignores: order date, totals (because prices can drift), pricing snapshots.
 */
export function fingerprintOrderItems(items: OrderItemLike[]): string {
  const parts = items
    .map((it) => {
      const opts = Array.isArray(it.selectedOptions)
        ? (it.selectedOptions as unknown as StoredOption[])
            .map((o) => o.option_id)
            .sort()
            .join(",")
        : "";
      return [
        it.menuItemId ?? `del:${it.nameSnapshot}`,
        it.sizeId ?? "-",
        it.quantity,
        opts,
        it.notes ?? "",
      ].join("|");
    })
    .sort();
  return parts.join(";");
}

export type RebuildIssue =
  | { kind: "item_missing"; name: string }
  | { kind: "item_unavailable"; name: string }
  | { kind: "size_missing"; name: string }
  | { kind: "option_missing"; name: string };

export interface RebuildLine {
  itemId: string;
  name: string;
  basePrice: number;
  artType: string | null;
  imageUrl: string | null;
  quantity: number;
  sizeId: string | null;
  sizeName: string | null;
  sizeDelta: number;
  options: Array<{ groupId: string; optionId: string; name: string; groupName?: string; priceDelta: number }>;
  notes: string | null;
}

/**
 * Old / new subtotal (item-level totals only — delivery + service + tip
 * are recomputed at checkout, so we don't compare them here). When old
 * and new differ, the UI should ask the customer to confirm the price
 * change before adding everything to the cart.
 */
export interface RebuildPricing {
  oldSubtotal: number;
  newSubtotal: number;
  delta: number;
}

export interface RebuildResult {
  lines: RebuildLine[];
  issues: RebuildIssue[];
  pricing: RebuildPricing;
  /** Checkout fields the client should pre-fill on /checkout. */
  prefill: CheckoutPrefill;
}

/**
 * Walk every line of an order and check that each menu-item, size, and
 * option still exists and is currently available. Items that no longer
 * resolve are reported in `issues` and dropped from the returned `lines`.
 * Returned lines use *current* prices, not the historical snapshot.
 */
export async function rebuildCartFromOrder(orderId: string): Promise<RebuildResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      method: true,
      paymentMethod: true,
      tip: true,
      customerNotes: true,
      deliveryNotes: true,
      customerPhoneSnap: true,
      customerFirstNameSnap: true,
      customerLastNameSnap: true,
      customer: {
        select: { firstName: true, lastName: true, phone: true },
      },
      items: {
        select: {
          menuItemId: true,
          nameSnapshot: true,
          quantity: true,
          totalPrice: true,
          sizeId: true,
          selectedOptions: true,
          notes: true,
        },
      },
    },
  });
  if (!order) {
    return {
      lines: [],
      issues: [],
      pricing: { oldSubtotal: 0, newSubtotal: 0, delta: 0 },
      prefill: {},
    };
  }

  const lines: RebuildLine[] = [];
  const issues: RebuildIssue[] = [];
  let oldSubtotal = 0;
  let newSubtotal = 0;

  const itemIds = order.items
    .map((it) => it.menuItemId)
    .filter((id): id is string => id !== null);

  const menuItemRows = await prisma.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      sizes: true,
      optionGroups: { include: { options: true } },
    },
  });
  const menuItemsById = new Map(menuItemRows.map((m) => [m.id, m]));

  for (const it of order.items) {
    if (!it.menuItemId) {
      issues.push({ kind: "item_missing", name: it.nameSnapshot });
      continue;
    }

    const menuItem = menuItemsById.get(it.menuItemId) ?? null;

    if (!menuItem) {
      issues.push({ kind: "item_missing", name: it.nameSnapshot });
      continue;
    }
    if (!menuItem.available) {
      issues.push({ kind: "item_unavailable", name: menuItem.name });
      continue;
    }

    let sizeId: string | null = null;
    let sizeName: string | null = null;
    let sizeDelta = 0;
    if (it.sizeId) {
      const size = menuItem.sizes.find((s) => s.id === it.sizeId);
      if (!size) {
        issues.push({ kind: "size_missing", name: menuItem.name });
        continue;
      }
      sizeId = size.id;
      sizeName = size.name;
      sizeDelta = size.priceDelta;
    }

    const storedOptions = Array.isArray(it.selectedOptions)
      ? (it.selectedOptions as unknown as StoredOption[])
      : [];
    // Resolve each stored selection to its live menu definition first,
    // then apply the includedFree allowance per group so the cheapest N
    // picks come back free — same rule the storefront uses on first add.
    interface Resolved {
      group: typeof menuItem.optionGroups[number];
      opt: typeof menuItem.optionGroups[number]["options"][number];
    }
    const resolved: Resolved[] = [];
    let optionsMissing = false;
    for (const stored of storedOptions) {
      const group = menuItem.optionGroups.find((g) => g.id === stored.group_id);
      const opt = group?.options.find((o) => o.id === stored.option_id);
      if (!opt || !group) {
        issues.push({ kind: "option_missing", name: menuItem.name });
        optionsMissing = true;
        break;
      }
      resolved.push({ group, opt });
    }
    if (optionsMissing) continue;

    const byGroup = new Map<string, Resolved[]>();
    for (const r of resolved) {
      const arr = byGroup.get(r.group.id) ?? [];
      arr.push(r);
      byGroup.set(r.group.id, arr);
    }
    const freedOptIds = new Set<string>();
    for (const arr of byGroup.values()) {
      const free = arr[0].group.includedFree ?? 0;
      const paidSorted = arr
        .filter((r) => r.opt.priceDelta > 0)
        .sort((a, b) => a.opt.priceDelta - b.opt.priceDelta);
      for (const r of paidSorted.slice(0, free)) freedOptIds.add(r.opt.id);
    }

    const liveOptions: RebuildLine["options"] = resolved.map((r) => ({
      groupId: r.group.id,
      optionId: r.opt.id,
      name: r.opt.name,
      groupName: r.group.name,
      priceDelta: freedOptIds.has(r.opt.id) ? 0 : r.opt.priceDelta,
    }));

    lines.push({
      itemId: menuItem.id,
      name: menuItem.name,
      basePrice: menuItem.basePrice,
      artType: menuItem.artType,
      imageUrl: menuItem.images?.[0] ?? menuItem.imageUrl ?? null,
      quantity: it.quantity,
      sizeId,
      sizeName,
      sizeDelta,
      options: liveOptions,
      notes: it.notes,
    });

    // Only count items that actually made it into the rebuilt cart toward
    // the comparison subtotals — comparing snapshots of items we couldn't
    // restore would inflate the "old" side and confuse the customer.
    const optsDelta = liveOptions.reduce((a, o) => a + o.priceDelta, 0);
    const newUnit = menuItem.basePrice + sizeDelta + optsDelta;
    newSubtotal += newUnit * it.quantity;
    oldSubtotal += it.totalPrice;
  }

  // Prefer the snapshot the customer used on this particular order
  // (that's what they last typed) and fall back to their live profile.
  const firstName =
    order.customerFirstNameSnap?.trim() ||
    order.customer?.firstName?.trim() ||
    "";
  const lastName =
    order.customerLastNameSnap?.trim() ||
    order.customer?.lastName?.trim() ||
    "";
  const phone =
    order.customerPhoneSnap?.trim() ||
    order.customer?.phone?.trim() ||
    "";
  const { address, floor, apartment, notes: deliveryHandoff } = splitDeliveryNotes(
    order.deliveryNotes,
  );

  const prefill: CheckoutPrefill = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    ...(phone && { phone }),
    method: order.method,
    paymentMethod: order.paymentMethod,
    ...(order.tip > 0 && { tip: order.tip }),
    ...(order.customerNotes && { customerNotes: order.customerNotes }),
    ...(address && { address }),
    ...(floor && { floor }),
    ...(apartment && { apartment }),
    ...(deliveryHandoff && { deliveryNotes: deliveryHandoff }),
  };

  return {
    lines,
    issues,
    pricing: {
      oldSubtotal,
      newSubtotal,
      delta: newSubtotal - oldSubtotal,
    },
    prefill,
  };
}
