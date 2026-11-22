/**
 * Deals active by days and hours (Imba sushi request, 2026-11-22).
 * A deal set to Sun-Tue 12:00-16:00 is hidden outside that window and the
 * server refuses to order it, even if it stayed in the cart. NULL = always.
 * Windows are read on the Israel clock even though Vercel runs in UTC.
 *
 * Run: node --test --import tsx tests/deal-time-window.test.ts
 */
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { isDealVisibleNow } from "../lib/menu-availability";
import { DealInputSchema } from "../lib/validate";

// Sun..Tue = bits 0,1,2. 12:00-16:00 in minutes since midnight.
const SUN_TUE = 0b0000111;
const WINDOW = { active: true, availableFrom: 12 * 60, availableTo: 16 * 60, availableDays: SUN_TUE };
const ALWAYS = { active: true, availableFrom: null, availableTo: null, availableDays: null };

// 2026-11-22 is a Sunday; Israel is UTC+2 in November.
const SUN_1300_IL = new Date("2026-11-22T11:00:00Z");
const SUN_1700_IL = new Date("2026-11-22T15:00:00Z");
const SUN_1000_IL = new Date("2026-11-22T08:00:00Z");
const WED_1300_IL = new Date("2026-11-25T11:00:00Z");
const TUE_1559_IL = new Date("2026-11-24T13:59:00Z");
const TUE_1600_IL = new Date("2026-11-24T14:00:00Z");

test("deal inside its days and hours is visible", () => {
  assert.equal(isDealVisibleNow(WINDOW, SUN_1300_IL), true);
  assert.equal(isDealVisibleNow(WINDOW, TUE_1559_IL), true);
});

test("deal outside its hours or days is hidden", () => {
  assert.equal(isDealVisibleNow(WINDOW, SUN_1700_IL), false);
  assert.equal(isDealVisibleNow(WINDOW, SUN_1000_IL), false);
  assert.equal(isDealVisibleNow(WINDOW, TUE_1600_IL), false, "end of window is exclusive");
  assert.equal(isDealVisibleNow(WINDOW, WED_1300_IL), false, "Wednesday is not in Sun-Tue");
});

test("deal with no window (NULL) is always visible; inactive never is", () => {
  for (const at of [SUN_1300_IL, SUN_1700_IL, WED_1300_IL, new Date("2026-11-28T22:30:00Z")]) {
    assert.equal(isDealVisibleNow(ALWAYS, at), true);
    assert.equal(isDealVisibleNow({ ...ALWAYS, active: false }, at), false);
  }
});

test("only days, only hours, and a window across midnight", () => {
  assert.equal(isDealVisibleNow({ ...ALWAYS, availableDays: SUN_TUE }, SUN_1700_IL), true);
  assert.equal(isDealVisibleNow({ ...ALWAYS, availableDays: SUN_TUE }, WED_1300_IL), false);
  const hoursOnly = { ...ALWAYS, availableFrom: 12 * 60, availableTo: 16 * 60 };
  assert.equal(isDealVisibleNow(hoursOnly, WED_1300_IL), true);
  assert.equal(isDealVisibleNow(hoursOnly, SUN_1700_IL), false);
  const lateNight = { ...ALWAYS, availableFrom: 22 * 60, availableTo: 2 * 60 };
  assert.equal(isDealVisibleNow(lateNight, new Date("2026-11-22T21:30:00Z")), true); // 23:30 IL
  assert.equal(isDealVisibleNow(lateNight, new Date("2026-11-22T23:30:00Z")), true); // 01:30 IL
  assert.equal(isDealVisibleNow(lateNight, SUN_1300_IL), false);
});

test("window is read on the Israel clock, not the runtime clock", () => {
  // 15:30 UTC on Sunday is 17:30 in Israel - outside 12:00-16:00 even
  // though a UTC runtime would read it as inside.
  assert.equal(isDealVisibleNow(WINDOW, new Date("2026-11-22T13:30:00Z")), true); // 15:30 IL
  assert.equal(isDealVisibleNow(WINDOW, new Date("2026-11-22T15:30:00Z")), false); // 17:30 IL
  // Summer (UTC+3): 09:30 UTC = 12:30 IL on Sunday 2026-07-05.
  assert.equal(isDealVisibleNow(WINDOW, new Date("2026-07-05T09:30:00Z")), true);
  assert.equal(isDealVisibleNow(WINDOW, new Date("2026-07-05T08:30:00Z")), false); // 11:30 IL
});

test("merchant input accepts days/hours and rejects out-of-range values", () => {
  const base = {
    name: "דיל צהריים",
    fixed_price: 59,
    slots: [{ name: "מנה", quantity: 1, item_ids: ["11111111-1111-4111-8111-111111111111"] }],
  };
  const parsed = DealInputSchema.parse({ ...base, available_from: 720, available_to: 960, available_days: SUN_TUE });
  assert.equal(parsed.available_from, 720);
  assert.equal(parsed.available_days, SUN_TUE);
  assert.equal(DealInputSchema.parse(base).available_from, undefined, "omitted = keep stored value");
  assert.equal(DealInputSchema.parse({ ...base, available_from: null }).available_from, null);
  assert.equal(DealInputSchema.safeParse({ ...base, available_to: 1440 }).success, false);
  assert.equal(DealInputSchema.safeParse({ ...base, available_days: 128 }).success, false);
});

// ─── Server refuses the order outside the window ───────────────────

const DEAL_ID = "22222222-2222-4222-8222-222222222222";
const SLOT_ID = "33333333-3333-4333-8333-333333333333";

// lib/db/client keeps the first client it sees for the whole process, so the
// fake reads the deal under test from this variable instead of a closure.
let dealUnderTest: typeof WINDOW | typeof ALWAYS = ALWAYS;

const fakeDb = {
  $extends(): unknown { return fakeDb; },
  tenant: {
    findUnique: async () => ({
      id: "imba",
      slug: "imba",
      status: "active",
      billingSuspendedAt: null,
      trialEndsAt: null,
      billingSetupCompletedAt: null,
      scheduledOrdersEnabled: false,
      preordersWhenClosed: false,
      branches: [{ id: "b1", status: "open", autoHours: false, pausedUntil: null, hours: {}, zones: [] }],
    }),
  },
  menuItem: { findMany: async () => [] },
  // Mirrors the real where-clause: only active deals of the tenant.
  deal: {
    findMany: async () =>
      dealUnderTest.active
        ? [{ id: DEAL_ID, name: "דיל צהריים", fixedPrice: 59, freeExtras: 0, ...dealUnderTest, slots: [{ id: SLOT_ID, name: "מנה", quantity: 1, choices: [] }] }]
        : [],
  },
};

async function orderDealAt(at: Date, window: typeof WINDOW | typeof ALWAYS): Promise<string> {
  const globalDb = globalThis as unknown as { prisma?: unknown };
  const previous = globalDb.prisma;
  dealUnderTest = window;
  globalDb.prisma = fakeDb;
  mock.timers.enable({ apis: ["Date"], now: at });
  try {
    const { createOrder } = await import("../lib/orders-create");
    await createOrder({
      tenantSlug: "imba",
      lines: [],
      // No units on purpose: passing the time gate surfaces the next check
      // (deal_slot_incomplete) without touching order writes.
      deals: [{ deal_id: DEAL_ID, quantity: 1, units: [] }],
    } as unknown as Parameters<typeof createOrder>[0]);
    return "created";
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  } finally {
    mock.timers.reset();
    globalDb.prisma = previous;
  }
}

test("order of a deal outside its window is refused (deal_unavailable)", async () => {
  assert.equal(await orderDealAt(SUN_1700_IL, WINDOW), "deal_unavailable");
  assert.equal(await orderDealAt(WED_1300_IL, WINDOW), "deal_unavailable");
});

test("order of a deal inside its window, or with no window, passes the time gate", async () => {
  assert.equal(await orderDealAt(SUN_1300_IL, WINDOW), "deal_slot_incomplete");
  assert.equal(await orderDealAt(SUN_1700_IL, ALWAYS), "deal_slot_incomplete");
  assert.equal(await orderDealAt(WED_1300_IL, ALWAYS), "deal_slot_incomplete");
});
