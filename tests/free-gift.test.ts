import assert from "node:assert/strict";
import test from "node:test";
import { isGiftRuleLive, nextGiftRule, pickGiftRule, giftLineName } from "../lib/free-gift";
import { deriveCartGift } from "../components/customer/cart-gift";

const NOW = new Date("2026-11-22T12:00:00Z");
const rule = (id: string, minSubtotal: number, extra: Record<string, unknown> = {}) => ({
  id, itemId: `item-${id}`, minSubtotal, active: true, validFrom: null, validUntil: null, ...extra,
});

// ── Pure rule logic (shared by cart + server) ──────────────────────────────

test("rule is live only while active, positive and inside its optional window", () => {
  assert.equal(isGiftRuleLive(rule("a", 150), NOW), true);
  assert.equal(isGiftRuleLive(rule("a", 150, { active: false }), NOW), false);
  assert.equal(isGiftRuleLive(rule("a", 0), NOW), false);
  assert.equal(isGiftRuleLive(rule("a", 150, { validFrom: "2026-11-23T00:00:00Z" }), NOW), false);
  assert.equal(isGiftRuleLive(rule("a", 150, { validUntil: new Date("2026-11-21T00:00:00Z") }), NOW), false);
  assert.equal(isGiftRuleLive(rule("a", 150, { validFrom: "2026-11-01T00:00:00Z", validUntil: "2026-12-01T00:00:00Z" }), NOW), true);
});

test("crossing the threshold earns the gift, dropping below loses it; highest tier wins", () => {
  const rules = [rule("roll", 150), rule("dessert", 250)];
  assert.equal(pickGiftRule(rules, 149, NOW), null);
  assert.equal(pickGiftRule(rules, 150, NOW)?.id, "roll");
  assert.equal(pickGiftRule(rules, 260, NOW)?.id, "dessert");
  assert.equal(pickGiftRule(rules, 120, NOW), null);
  assert.equal(nextGiftRule(rules, 120, NOW)?.id, "roll");
  assert.equal(nextGiftRule(rules, 200, NOW)?.id, "dessert");
  assert.equal(nextGiftRule(rules, 300, NOW), null);
});

// ── Cart (client mirror) ────────────────────────────────────────────────────

const cartRule = { ...rule("roll", 150), item: { id: "item-roll", name: "רול סלמון", imageUrl: null } };
const line = (price: number, quantity = 1) => ({
  basePrice: price, sizeDelta: 0, options: [] as Array<{ priceDelta: number }>, quantity,
});

test("cart adds the gift above the threshold and removes it below, measured without delivery", () => {
  const above = deriveCartGift([cartRule], [line(100), line(50)], NOW);
  assert.equal(above.gift?.itemId, "item-roll");
  assert.equal(above.gift?.price, 0);
  assert.equal(above.gift?.quantity, 1);
  assert.equal(above.next, null);

  const below = deriveCartGift([cartRule], [line(100), line(49)], NOW);
  assert.equal(below.gift, null);
  assert.deepEqual(below.next && { id: below.next.ruleId, missing: below.next.missing }, { id: "roll", missing: 1 });
});

test("cart gift quantity is always 1 even with many lines / big quantities", () => {
  const r = deriveCartGift([cartRule], [line(100, 5)], NOW);
  assert.equal(r.gift?.quantity, 1);
});

// ── Server: createOrder with a fake DB ──────────────────────────────────────

const TENANT = "11111111-1111-4111-8111-111111111111";
const SUSHI = "22222222-2222-4222-8222-222222222222"; // regular dish, 50 ₪
const ROLL = "33333333-3333-4333-8333-333333333333"; // the gift dish, 40 ₪

function menuItem(id: string, name: string, basePrice: number, extra: Record<string, unknown> = {}) {
  return {
    id, tenantId: TENANT, name, basePrice, compareAtPrice: null, pricingMode: "fixed", pricePerKg: null,
    available: true, stockRemaining: null, availableFrom: null, availableTo: null, availableDays: null,
    category: null, sizes: [], optionGroups: [], ...extra,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let current: any = null;
const stableDb: unknown = new Proxy({}, {
  get(_t, model: string) {
    if (model === "$extends") return () => stableDb;
    return new Proxy({}, { get: (_m, method: string) => (...args: unknown[]) => current[model][method](...args) });
  },
});

interface FakeOpts {
  rules?: Array<Record<string, unknown>>;
  rollExtra?: Record<string, unknown>;
  stockClaimFails?: boolean;
}

async function runOrder(
  lines: Array<{ item_id: string; quantity: number }>,
  opts: FakeOpts = {},
  extraInput: Record<string, unknown> = {},
) {
  const roll = menuItem(ROLL, "רול סלמון", 40, opts.rollExtra);
  const items = [menuItem(SUSHI, "סושי", 50), roll];
  const rules = opts.rules ?? [
    { id: "r1", tenantId: TENANT, itemId: ROLL, minSubtotal: 150, active: true, validFrom: null, validUntil: null },
  ];
  let created: { data: Record<string, unknown> } | null = null;
  const updateMany: unknown[] = [];
  // lib/db/client captures globalThis.prisma once on first import, so every
  // run swaps the handlers behind one stable proxy object.
  current = {
    tenant: {
      findUnique: async () => ({
        id: TENANT, slug: "imba-sushi", name: "Imba", status: "active", scheduledOrdersEnabled: false,
        preordersWhenClosed: false, cutleryEnabled: false, cutleryPrice: 0, cutleryFreeAbove: null,
        loyaltyConfig: null, billingSuspendedAt: null, trialEndsAt: null, billingSetupCompletedAt: null,
        branches: [{
          id: "b1", status: "open", autoHours: false, pausedUntil: null, hours: {}, zones: [],
          minOrder: 0, deliveryFee: 0, serviceFee: 0, freeDeliveryMinOrder: null, freeDeliveryMinItems: null,
        }],
      }),
      update: async () => ({ nextOrderNumber: 8, slug: "imba-sushi" }),
    },
    menuItem: {
      findMany: async (args: { where: { id: { in: string[] } } }) =>
        items.filter((i) => args.where.id.in.includes(i.id) && i.available),
      updateMany: async (args: unknown) => {
        updateMany.push(args);
        return { count: opts.stockClaimFails ? 0 : 1 };
      },
    },
    freeGiftRule: {
      findMany: async (args: { where: { minSubtotal: { lte: number }; active: boolean } }) =>
        rules
          .filter((r) => (r.active as boolean) === args.where.active && (r.minSubtotal as number) <= args.where.minSubtotal.lte)
          .map((r) => ({ ...r, item: items.find((i) => i.id === r.itemId) ?? null })),
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
    const result = await createOrder({
      tenantSlug: "imba-sushi", method: "pickup", paymentMethod: "card", lines, ...extraInput,
    } as Parameters<typeof createOrder>[0]);
    const data = created!.data;
    return {
      total: result.total,
      subtotal: data.subtotal as number,
      items: (data.items as { createMany: { data: Array<Record<string, unknown>> } }).createMany.data,
      source: data.source,
      updateMany,
    };
  } finally {
    g.prisma = previous;
  }
}

test("server: above the threshold the gift line is recorded at 0, quantity 1, labelled", async () => {
  const r = await runOrder([{ item_id: SUSHI, quantity: 3 }]); // 150
  assert.equal(r.subtotal, 150);
  assert.equal(r.total, 150);
  const gift = r.items.find((i) => i.source === "free_gift");
  assert.ok(gift, "gift line expected");
  assert.equal(gift.menuItemId, ROLL);
  assert.equal(gift.unitPrice, 0);
  assert.equal(gift.totalPrice, 0);
  assert.equal(gift.quantity, 1);
  assert.equal(gift.nameSnapshot, giftLineName("רול סלמון"));
  assert.equal(r.source, "direct");
});

test("server: below the threshold there is no gift", async () => {
  const r = await runOrder([{ item_id: SUSHI, quantity: 2 }]); // 100
  assert.equal(r.items.some((i) => i.source === "free_gift"), false);
  assert.equal(r.total, 100);
});

test("server: a forged gift (the gift dish sent as a line) is charged in full and never makes the cart qualify", async () => {
  // 100 of real food + the gift dish sent by the client "for free".
  const r = await runOrder([{ item_id: SUSHI, quantity: 2 }, { item_id: ROLL, quantity: 1 }]);
  const forged = r.items.find((i) => i.menuItemId === ROLL && i.source !== "free_gift");
  assert.equal(forged?.unitPrice, 40);
  // 140 < 150 → still no gift, and the customer pays for the roll.
  assert.equal(r.items.some((i) => i.source === "free_gift"), false);
  assert.equal(r.total, 140);
});

test("server: extra client fields cannot request or enlarge a gift", async () => {
  const r = await runOrder(
    [{ item_id: SUSHI, quantity: 2 }],
    {},
    { free_gift_rule_id: "r1", freeGift: { item_id: ROLL, quantity: 5 }, gift_quantity: 5 },
  );
  assert.equal(r.items.some((i) => i.source === "free_gift"), false);
  const above = await runOrder(
    [{ item_id: SUSHI, quantity: 4 }],
    {},
    { gift_quantity: 5, freeGift: { item_id: ROLL, quantity: 5 } },
  );
  const gifts = above.items.filter((i) => i.source === "free_gift");
  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].quantity, 1);
  assert.equal(above.total, 200);
});

test("server: inactive / expired rule and unavailable or sold-out gift dish give no gift but the order passes", async () => {
  const base = { id: "r1", tenantId: TENANT, itemId: ROLL, minSubtotal: 150, validFrom: null, validUntil: null };
  for (const opts of [
    { rules: [{ ...base, active: false }] },
    { rules: [{ ...base, active: true, validUntil: new Date(Date.now() - 60_000) }] },
    { rollExtra: { available: false } },
    { rollExtra: { stockRemaining: 0 } },
  ] as FakeOpts[]) {
    const r = await runOrder([{ item_id: SUSHI, quantity: 3 }], opts);
    assert.equal(r.items.some((i) => i.source === "free_gift"), false, JSON.stringify(opts));
    assert.equal(r.total, 150);
  }
});

test("server: a stock race on the gift drops the gift, not the order", async () => {
  const r = await runOrder([{ item_id: SUSHI, quantity: 3 }], { rollExtra: { stockRemaining: 1 }, stockClaimFails: true });
  assert.equal(r.items.some((i) => i.source === "free_gift"), false);
  assert.equal(r.updateMany.length, 1);
  assert.equal(r.total, 150);
});

test("server: kiosk orders get the gift too, POS / staff-entered orders do not", async () => {
  const kiosk = await runOrder([{ item_id: SUSHI, quantity: 3 }], {}, { kiosk: true, sourceOverride: "kiosk" });
  assert.equal(kiosk.items.filter((i) => i.source === "free_gift").length, 1);
  assert.equal(kiosk.total, 150);
  const pos = await runOrder([{ item_id: SUSHI, quantity: 3 }], {}, { sourceOverride: "pos" });
  assert.equal(pos.items.some((i) => i.source === "free_gift"), false);
});
