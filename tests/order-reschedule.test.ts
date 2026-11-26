/**
 * Moving an open order to another time from the dashboard (Michelle, 2026-11-26).
 * The new time must be in the future, within the preorder horizon and inside
 * the branch's opening hours, read on the Israel clock.
 *
 * Run: node --test --import tsx tests/order-reschedule.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { validateRescheduleTime, rescheduleDeltaMs } from "../lib/orders/reschedule";
import { fromIsraelInputValue, toIsraelInputValue } from "../lib/israel-datetime-input";
import type { BranchHours } from "../lib/branch-hours";

const DAY = { open: "11:00", close: "23:00", active: true };
const HOURS: BranchHours = {
  sunday: DAY,
  monday: DAY,
  tuesday: DAY,
  wednesday: DAY,
  thursday: DAY,
  friday: { ...DAY, active: false },
  saturday: DAY,
};

const NOW = new Date("2026-11-26T10:00:00Z");

test("moving back to now is always allowed", () => {
  assert.equal(validateRescheduleTime(null, HOURS, NOW), null);
});

test("a later time today inside opening hours is accepted", () => {
  assert.equal(validateRescheduleTime(new Date("2026-11-26T17:30:00Z"), HOURS, NOW), null);
});

test("a time that already passed is rejected", () => {
  assert.equal(validateRescheduleTime(new Date("2026-11-26T09:59:00Z"), HOURS, NOW), "in_past");
  assert.equal(validateRescheduleTime(NOW, HOURS, NOW), "in_past");
});

test("a time after closing is rejected", () => {
  assert.equal(
    validateRescheduleTime(new Date("2026-11-26T21:15:00Z"), HOURS, NOW),
    "outside_hours",
  );
});

test("a closed day is rejected", () => {
  assert.equal(
    validateRescheduleTime(new Date("2026-11-27T12:00:00Z"), HOURS, NOW),
    "outside_hours",
  );
});

test("beyond the preorder horizon is rejected", () => {
  assert.equal(
    validateRescheduleTime(new Date("2026-12-20T12:00:00Z"), HOURS, NOW),
    "too_far",
  );
});

test("estimate shift follows the move from created time or previous slot", () => {
  const createdAt = new Date("2026-11-26T09:50:00Z");
  const to = new Date("2026-11-26T16:50:00Z");
  assert.equal(rescheduleDeltaMs({ scheduledFor: null, createdAt }, to, NOW), 7 * 3_600_000);
  assert.equal(
    rescheduleDeltaMs({ scheduledFor: to, createdAt }, null, NOW),
    NOW.getTime() - to.getTime(),
  );
});

test("datetime-local value is read and written on the Israel clock", () => {
  assert.equal(fromIsraelInputValue("2026-11-26T19:30")?.toISOString(), "2026-11-26T17:30:00.000Z");
  assert.equal(fromIsraelInputValue("2026-07-01T19:30")?.toISOString(), "2026-07-01T16:30:00.000Z");
  assert.equal(toIsraelInputValue("2026-11-26T17:30:00.000Z"), "2026-11-26T19:30");
  assert.equal(toIsraelInputValue("2026-07-01T16:30:00.000Z"), "2026-07-01T19:30");
  assert.equal(fromIsraelInputValue("bad"), null);
});
