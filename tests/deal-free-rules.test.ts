/**
 * Soldier deal at Smash Burger (Ran, 2026-11-24): fixed ₪70.
 *  - Regular chips included (₪0); sweet potato / onion rings +₪4 always paid.
 *  - One pick from "תוספות בתשלום" + the vegan cheddar slice is included,
 *    every extra one paid (Ran, 2026-11-25: cheddar shares the slot).
 *  - Double cheddar, kebab and pulled meat are always paid.
 *
 * Run: node --test --import tsx tests/deal-free-rules.test.ts
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { dealGiftedIndexes, parseDealFreeRules, type GiftablePick } from "../lib/deal-free-rules";

const TOPPINGS = ["coleslaw", "jalapeno", "onion-jam", "chili-jam", "fried-onion", "egg", "mushrooms", "garlic", "cheddar"];
const RULES = parseDealFreeRules([{ label: "תוספת מעל אחת", optionIds: TOPPINGS, count: 1 }]);
const PRICE: Record<string, number> = {
  "double-smash": 0, chips: 0, "sweet-potato": 4, "onion-rings": 4,
  coleslaw: 5, jalapeno: 4, "onion-jam": 4, "chili-jam": 4, "fried-onion": 6, egg: 6, mushrooms: 6, garlic: 6,
  cheddar: 6, "double-cheddar": 10, kebab: 14, "pulled-meat": 14, cola: 0,
};

function total(ids: string[], freeExtras = 0): number {
  const picks: GiftablePick[] = ids.map((id) => ({ optionId: id, charge: PRICE[id] }));
  const gifted = dealGiftedIndexes(picks, RULES, freeExtras);
  return 70 + picks.reduce((s, p, i) => s + (gifted.has(i) ? 0 : p.charge), 0);
}

test("double smash + chips + jalapeño (+₪4) + drink = ₪70", () => {
  assert.equal(total(["double-smash", "chips", "jalapeno", "cola"]), 70);
});

test("regular chips and nothing else = ₪70", () => {
  assert.equal(total(["double-smash", "chips", "cola"]), 70);
});

test("sweet potato / onion rings are charged +₪4", () => {
  assert.equal(total(["double-smash", "sweet-potato", "cola"]), 74);
  assert.equal(total(["double-smash", "onion-rings", "jalapeno", "cola"]), 74);
});

test("second topping is charged, the cheaper one is the free one", () => {
  assert.equal(total(["double-smash", "chips", "jalapeno", "egg"]), 76);
  assert.equal(total(["double-smash", "chips", "coleslaw", "onion-jam", "egg"]), 81);
});

test("one cheddar slice free, a second slice is charged", () => {
  assert.equal(total(["double-smash", "chips", "cheddar"]), 70);
  assert.equal(total(["double-smash", "chips", "cheddar", "cheddar"]), 76);
});

test("double cheddar, kebab and pulled meat are always charged", () => {
  assert.equal(total(["double-smash", "chips", "double-cheddar"]), 80);
  assert.equal(total(["double-smash", "chips", "kebab"]), 84);
  assert.equal(total(["double-smash", "chips", "pulled-meat"]), 84);
});

test("cheddar shares the topping slot: cheddar alone free, a second pick is charged", () => {
  assert.equal(total(["double-smash", "chips", "cheddar"]), 70);
  assert.equal(total(["double-smash", "chips", "cheddar", "chili-jam"]), 76);
  assert.equal(total(["double-smash", "chips", "cheddar", "jalapeno", "egg"]), 82);
});

test("full order from the bug screenshot: rings + double cheddar + coleslaw", () => {
  // 4 (rings) + 10 (double cheddar) + 0 (coleslaw is the included topping)
  assert.equal(total(["double-smash", "onion-rings", "double-cheddar", "coleslaw", "cola"]), 84);
});

test("no rules + freeExtras keeps the old deal-wide behaviour", () => {
  const picks: GiftablePick[] = [
    { optionId: "a", charge: 6 },
    { optionId: "b", charge: 4 },
    { optionId: "size", charge: 3, isSize: true },
  ];
  assert.deepEqual([...dealGiftedIndexes(picks, [], 1)], [1]);
});

test("malformed stored rules are ignored", () => {
  assert.deepEqual(parseDealFreeRules(null), []);
  assert.deepEqual(parseDealFreeRules([{ optionIds: [], count: 1 }, { optionIds: ["x"], count: 0 }]), []);
});
