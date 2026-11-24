import assert from "node:assert/strict";
import test from "node:test";
import {
  BASE_PLAN_CODE,
  NO_COMMISSION_PLAN_CODE,
  NO_COMMISSION_PLAN_ID,
  REVIEWS_WHATSAPP_PLAN_CODE,
  isPlatformPlanCode,
  parsePlatformPlan,
  platformPlanCode,
  platformPlanOf,
  platformPlanPrice,
} from "../lib/billing-hub/plans";

test("tenant plan: only the zero-commission row maps to no_commission", () => {
  assert.equal(platformPlanOf({ planId: NO_COMMISSION_PLAN_ID }), "no_commission");
  assert.equal(platformPlanOf({ planId: null }), "base");
  // Legacy Starter/Growth rows stay on base billing.
  assert.equal(platformPlanOf({ planId: "00000000-0000-0000-0000-000000000001" }), "base");
});

test("plan code and month-one price follow the chosen plan", () => {
  assert.equal(platformPlanCode("base"), BASE_PLAN_CODE);
  assert.equal(platformPlanCode("no_commission"), NO_COMMISSION_PLAN_CODE);
  assert.equal(platformPlanPrice("base"), 299);
  assert.equal(platformPlanPrice("no_commission"), 450);
});

test("both platform codes count as the base subscription, add-ons do not", () => {
  assert.equal(isPlatformPlanCode(BASE_PLAN_CODE), true);
  assert.equal(isPlatformPlanCode(NO_COMMISSION_PLAN_CODE), true);
  assert.equal(isPlatformPlanCode(REVIEWS_WHATSAPP_PLAN_CODE), false);
  assert.equal(isPlatformPlanCode(undefined), false);
});

test("plan input from the client is whitelisted", () => {
  assert.equal(parsePlatformPlan("base"), "base");
  assert.equal(parsePlatformPlan("no_commission"), "no_commission");
  for (const bad of ["", "quickfood_no_commission", 450, null, undefined, {}]) {
    assert.equal(parsePlatformPlan(bad), null);
  }
});
