/**
 * Merchant-editable review SMS text + courier SMS switch (customer request,
 * 2026-11-08). Both live in Tenant.notifySettings and must default to the
 * exact pre-existing behaviour for tenants that never touch them.
 *
 * Run: node --test --import tsx tests/messaging-settings.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderReviewText,
  resolveReviewText,
  resolveCourierAssignedSettings,
} from "../lib/messaging/notify-settings";

const vars = { name: "דנה", business: "פיצה טובה", link: "https://x.test/r" };

test("no custom text -> same SMS as before the change", () => {
  assert.equal(resolveReviewText({}), null);
  assert.equal(
    renderReviewText(null, vars),
    "דנה, איך הייתה ההזמנה מ-פיצה טובה?\nדקה לדרג: https://x.test/r",
  );
});

test("custom text replaces tokens", () => {
  const t = resolveReviewText({ review_text: "היי {name}! תודה שהזמנת מ{business}: {link}" });
  assert.equal(renderReviewText(t, vars), "היי דנה! תודה שהזמנת מפיצה טובה: https://x.test/r");
});

test("custom text without {link} still carries the link", () => {
  assert.equal(renderReviewText("תודה {name}", vars), "תודה דנה\nhttps://x.test/r");
});

test("blank custom text falls back to the default", () => {
  assert.equal(resolveReviewText({ review_text: "   " }), null);
});

test("courier SMS defaults to on, can be switched off", () => {
  assert.deepEqual(resolveCourierAssignedSettings(null), { sms: true });
  assert.deepEqual(resolveCourierAssignedSettings({ confirmed: {} }), { sms: true });
  assert.deepEqual(resolveCourierAssignedSettings({ courier_assigned: { sms: false } }), { sms: false });
});
