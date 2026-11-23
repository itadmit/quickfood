import assert from "node:assert/strict";
import test from "node:test";
import { kioskOrderLines } from "../lib/kiosk-order-lines";
import { buildReceiptLines, DEFAULT_RECEIPT_SETTINGS, type ReceiptOrder } from "../lib/receipt-print";

const TENANT = "11111111-1111-4111-8111-111111111111";
const BOWL = "22222222-2222-4222-8222-222222222222";
const DEAL = "44444444-4444-4444-8444-444444444444";
const SLOT = "55555555-5555-4555-8555-555555555555";

test("kiosk: each cart line sends its own note, blank notes go as null", () => {
  const out = kioskOrderLines([
    { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: "דנה" },
    { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: "  יוסי  " },
    { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: "   " },
    { itemId: BOWL, quantity: 2, sizeId: null, options: [{ optionId: "o1" }], notes: null },
  ]);
  assert.deepEqual(out.map((l) => l.notes), ["דנה", "יוסי", null, null]);
  assert.deepEqual(out[3].option_ids, ["o1"]);
  assert.equal(out[3].quantity, 2);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let current: any = null;
const stableDb: unknown = new Proxy({}, {
  get(_t, model: string) {
    if (model === "$extends") return () => stableDb;
    return new Proxy({}, { get: (_m, method: string) => (...args: unknown[]) => current[model][method](...args) });
  },
});

async function runOrder(lines: Array<{ item_id: string; quantity: number; notes?: string }>, extraInput: Record<string, unknown> = {}) {
  const item = {
    id: BOWL, tenantId: TENANT, name: "בול עוף", basePrice: 50, compareAtPrice: null, pricingMode: "fixed",
    pricePerKg: null, available: true, stockRemaining: null, availableFrom: null, availableTo: null,
    availableDays: null, category: null, sizes: [], optionGroups: [],
  };
  let created: { data: Record<string, unknown> } | null = null;
  current = {
    tenant: {
      findUnique: async () => ({
        id: TENANT, slug: "ran", name: "Ran", status: "active", scheduledOrdersEnabled: false,
        preordersWhenClosed: false, cutleryEnabled: false, cutleryPrice: 0, cutleryFreeAbove: null,
        loyaltyConfig: null, billingSuspendedAt: null, trialEndsAt: null, billingSetupCompletedAt: null,
        branches: [{
          id: "b1", status: "open", autoHours: false, pausedUntil: null, hours: {}, zones: [],
          minOrder: 0, deliveryFee: 0, serviceFee: 0, freeDeliveryMinOrder: null, freeDeliveryMinItems: null,
        }],
      }),
      update: async () => ({ nextOrderNumber: 8, slug: "ran" }),
    },
    menuItem: {
      findMany: async (args: { where: { id: { in: string[] } } }) => [item].filter((i) => args.where.id.in.includes(i.id)),
      updateMany: async () => ({ count: 1 }),
    },
    freeGiftRule: { findMany: async () => [] },
    deal: {
      findMany: async () => [{
        id: DEAL, tenantId: TENANT, name: "מבצע לחיילים", active: true, fixedPrice: 70, freeExtras: 0,
        availableFrom: null, availableTo: null, availableDays: null,
        slots: [{ id: SLOT, name: "מנה", quantity: 1, position: 0, choices: [{ itemId: BOWL, fixedSizeId: null }] }],
      }],
    },
    order: {
      create: async (args: { data: Record<string, unknown> }) => {
        created = args;
        const itemsData = (args.data.items as { createMany: { data: unknown[] } }).createMany.data;
        return { id: "o1", number: args.data.number, items: itemsData };
      },
    },
    orderEvent: { create: async () => ({}) },
  };
  const g = globalThis as unknown as { prisma?: unknown };
  const previous = g.prisma;
  g.prisma = stableDb;
  try {
    const { createOrder } = await import("../lib/orders-create");
    await createOrder({
      tenantSlug: "ran", method: "pickup", paymentMethod: "card", lines, ...extraInput,
    } as Parameters<typeof createOrder>[0]);
    return (created!.data.items as { createMany: { data: Array<Record<string, unknown>> } }).createMany.data;
  } finally {
    g.prisma = previous;
  }
}

for (const [label, extra] of [
  ["site", {}],
  ["kiosk", { kiosk: true, sourceOverride: "kiosk" }],
] as const) {
  test(`server (${label}): the same dish added three times keeps a separate note per line`, async () => {
    const lines = kioskOrderLines([
      { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: "דנה" },
      { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: "יוסי" },
      { itemId: BOWL, quantity: 1, sizeId: null, options: [], notes: null },
    ]).map((l) => ({ ...l, notes: l.notes ?? undefined }));
    const items = await runOrder(lines, extra);
    assert.equal(items.length, 3);
    assert.deepEqual(items.map((i) => i.notes), ["דנה", "יוסי", null]);
    assert.ok(items.every((i) => i.menuItemId === BOWL && i.quantity === 1));
  });
}

test("kitchen ticket prints the note under its own dish", () => {
  const order: ReceiptOrder = {
    number: "8", created_at: "2026-11-22T10:00:00Z", method: "pickup", total: 100, subtotal: 100,
    delivery_fee: 0, service_fee: 0, cutlery_count: 0, cutlery_fee: 0, tip: 0, discount: 0,
    payment_method: "cash", customer_notes: null, delivery_notes: null, customer: null, delivery_address: null,
    items: [
      { name: "בול עוף", quantity: 1, total_price: 50, size: null, options: [], notes: "דנה" },
      { name: "בול עוף", quantity: 1, total_price: 50, size: null, options: [], notes: "יוסי" },
    ],
  };
  const texts = buildReceiptLines(order, DEFAULT_RECEIPT_SETTINGS).map((l) =>
    "text" in l ? l.text : "right" in l ? l.right : "",
  );
  const first = texts.indexOf("1× בול עוף");
  assert.equal(texts[first + 1], "הערה: דנה");
  assert.equal(texts.lastIndexOf("הערה: יוסי"), texts.lastIndexOf("1× בול עוף") + 1);
});

test("cart: a line stops at 20 (web cart +, item screen, reorder) and stock still caps lower", async () => {
  const { clampToStock, MAX_LINE_QTY } = await import("../components/customer/CartProvider");
  const l = { lineId: "a", itemId: BOWL, quantity: 20, stockRemaining: null } as Parameters<typeof clampToStock>[1];
  assert.equal(MAX_LINE_QTY, 20);
  assert.equal(clampToStock([l], l, 21), 20);
  assert.equal(clampToStock([l], l, 19), 19);
  const stocked = { ...l, stockRemaining: 5 };
  assert.equal(clampToStock([stocked], stocked, 21), 5);
});

test("server: 25 deal lines go through and each keeps its own note", async () => {
  const deals = Array.from({ length: 25 }, (_, i) => ({
    deal_id: DEAL, quantity: 1, notes: i % 2 === 0 ? `חייל ${i + 1}` : undefined,
    units: [{ slot_id: SLOT, item_id: BOWL, size_id: null, option_ids: [] }],
  }));
  const items = await runOrder([], { deals });
  assert.equal(items.length, 25);
  assert.equal(items[0].notes, "חייל 1");
  assert.equal(items[1].notes, null);
  assert.equal(items[24].notes, "חייל 25");
  assert.ok(items.every((i) => i.nameSnapshot === "מבצע לחיילים"));
});
