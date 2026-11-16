/**
 * Card payments are offered only with real clearing.
 * Incident S-8 (Smash Burger, 2026-11-07): Grow in test mode with no terminal
 * credentials took a real customer's 385 into a shared account.
 *
 * Run: node --test --import tsx tests/live-clearing.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardClearing, hasLiveClearing, isCardOffered } from "../lib/payments/live-clearing";

test("S-8 setup: Grow in test mode, empty credentials -> no card", () => {
  assert.equal(hasLiveClearing({ provider: "grow", testMode: true, credentials: {} }), false);
});

test("test mode blocks card even with full credentials", () => {
  assert.equal(
    hasLiveClearing({ provider: "grow", testMode: true, credentials: { userId: "u1" } }),
    false,
  );
});

test("live Grow without the merchant's userId -> no card", () => {
  assert.equal(hasLiveClearing({ provider: "grow", testMode: false, credentials: {} }), false);
  assert.equal(
    hasLiveClearing({ provider: "grow", testMode: false, credentials: { userId: "  " } }),
    false,
  );
  assert.equal(hasLiveClearing({ provider: "grow", testMode: false, credentials: null }), false);
});

test("live Grow with userId -> card offered", () => {
  assert.equal(
    hasLiveClearing({ provider: "grow", testMode: false, credentials: { userId: "u1" } }),
    true,
  );
});

test("CardCom and Hyp need all their terminal fields", () => {
  const cardcom = { terminalNumber: "1", apiName: "a", apiPassword: "p" };
  assert.equal(hasLiveClearing({ provider: "cardcom", testMode: false, credentials: cardcom }), true);
  assert.equal(
    hasLiveClearing({ provider: "cardcom", testMode: false, credentials: { ...cardcom, apiPassword: "" } }),
    false,
  );
  const hyp = { masof: "1", passP: "p", apiKey: "k" };
  assert.equal(hasLiveClearing({ provider: "hyp", testMode: false, credentials: hyp }), true);
  assert.equal(
    hasLiveClearing({ provider: "hyp", testMode: false, credentials: { masof: "1" } }),
    false,
  );
});

test("unknown provider -> no card", () => {
  assert.equal(hasLiveClearing({ provider: "cash", testMode: false, credentials: {} }), false);
});

test("CardCom test terminal is offered to the store owner only", () => {
  const row = { provider: "cardcom", testMode: true, credentials: {} };
  assert.equal(cardClearing(row), "owner_test");
  assert.equal(isCardOffered(row, false), false);
  assert.equal(isCardOffered(row, true), true);
});

test("Grow and Hyp test mode stay closed even for the owner", () => {
  for (const provider of ["grow", "hyp"]) {
    const row = { provider, testMode: true, credentials: { userId: "u1", masof: "1", passP: "p", apiKey: "k" } };
    assert.equal(cardClearing(row), "none");
    assert.equal(isCardOffered(row, true), false);
  }
});

test("live terminal is offered to everyone", () => {
  const row = {
    provider: "cardcom",
    testMode: false,
    credentials: { terminalNumber: "1", apiName: "a", apiPassword: "p" },
  };
  assert.equal(cardClearing(row), "live");
  assert.equal(isCardOffered(row, false), true);
});
