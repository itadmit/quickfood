import assert from "node:assert/strict";
import test from "node:test";
import { purchaseEligible } from "../lib/fb/purchase";
import { purchaseToken, verifyPurchaseToken } from "../lib/fb/purchase-token";
import { setStorefrontPixel, sfPurchase, storefrontPixelReady } from "../lib/fb/storefront";

const base = { status: "confirmed", paymentMethod: "card", paymentStatus: "paid" } as const;

test("online purchase requires paid; cancelled/refunded/failed orders never qualify", () => {
  assert.equal(purchaseEligible(base), true);
  for (const paymentStatus of ["pending", "authorized", "failed", "refunded"] as const) {
    assert.equal(purchaseEligible({ ...base, paymentStatus }), false);
  }
  for (const status of ["cancelled", "refunded"] as const) {
    assert.equal(purchaseEligible({ ...base, status }), false);
  }
});

test("cash qualifies on merchant acceptance, including subsequent fulfillment", () => {
  for (const status of ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"] as const) {
    assert.equal(purchaseEligible({ ...base, status, paymentMethod: "cash", paymentStatus: "pending" }), true);
  }
  assert.equal(purchaseEligible({ ...base, status: "pending", paymentMethod: "cash", paymentStatus: "pending" }), false);
});

test("signed purchase authorization cannot be changed or used for another order", () => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  try {
    const token = purchaseToken("order-one");
    assert.equal(verifyPurchaseToken(token, "order-one"), true);
    assert.equal(verifyPurchaseToken(token, "order-two"), false);
    assert.equal(verifyPurchaseToken(`x${token}`, "order-one"), false);
    const now = Date.now;
    Date.now = () => now() + 86400001;
    try { assert.equal(verifyPurchaseToken(token, "order-one"), false); }
    finally { Date.now = now; }
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test("purchase waits for initialized store and library; failure remains retryable", () => {
  const calls: unknown[][] = [];
  const fbq = Object.assign((...args: unknown[]) => calls.push(args), { callMethod: undefined as unknown });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { fbq } });
  try {
    setStorefrontPixel("1116955261107075");
    assert.equal(sfPurchase("1116955261107075", "one", {}), false);
    assert.equal(calls.length, 0);
    fbq.callMethod = () => {};
    assert.equal(storefrontPixelReady("999999"), false);
    assert.equal(sfPurchase("1116955261107075", "one", { value: 42 }), true);
    assert.deepEqual(calls[0], ["trackSingle", "1116955261107075", "Purchase", { value: 42 }, { eventID: "purchase:one" }]);
    setStorefrontPixel(null);
    assert.equal(sfPurchase("1116955261107075", "one", {}), false);
  } finally {
    setStorefrontPixel(null);
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
