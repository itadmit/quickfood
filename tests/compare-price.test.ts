import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuItemInputSchema } from "../lib/validate";
import { originalPrice, comparisonSnapshot } from "../lib/compare-price";
import { weightPrice } from "../lib/pricing";
import { Price } from "../components/shared/Price";
import { orderConfirmedEmail, merchantNewOrderEmail } from "../lib/email/templates";
import { buildPassPrntHtml, type ReceiptOrder } from "../lib/receipt-print";

const item = { name: "בדיקה", category_id: "12345678-1234-4234-8234-123456789abc", base_price: 89 };
test("comparison must be a whole price strictly greater than the effective current price", () => {
  for (const compare_at_price of [null, undefined, 90, 120]) assert.equal(MenuItemInputSchema.safeParse({ ...item, compare_at_price }).success, true);
  for (const compare_at_price of [0, -1, 88, 89, 89.9, NaN, Infinity]) assert.equal(MenuItemInputSchema.safeParse({ ...item, compare_at_price }).success, false);
  assert.equal(MenuItemInputSchema.safeParse({ ...item, pricing_mode: "weight", price_per_kg: 100, compare_at_price: 99 }).success, false);
  assert.equal(MenuItemInputSchema.safeParse({ ...item, pricing_mode: "weight", price_per_kg: 100, compare_at_price: 120 }).success, true);
});
test("snapshots preserve size/option charges and quantity without double-applying discount", () => {
  assert.equal(originalPrice(104, 89, 120), 135);
  assert.deepEqual(comparisonSnapshot(104.5, 89, 120, 3), { originalUnitPrice: 136, originalTotalPrice: 407 });
  assert.deepEqual(comparisonSnapshot(104, 89, null, 3), { originalUnitPrice: null, originalTotalPrice: null });
  assert.equal(originalPrice(104, 89, 80), null);
  assert.deepEqual(comparisonSnapshot(weightPrice(89, 350) + 5, weightPrice(89, 350), weightPrice(120, 350), 1), { originalUnitPrice: 47, originalTotalPrice: 47 });
});
test("shared price renders accessible strikethrough only for a higher original price", () => {
  assert.match(renderToStaticMarkup(createElement(Price, { amount: 89, originalAmount: 120 })), /<del.*מחיר לפני הנחה/);
  for (const originalAmount of [null, undefined, 89, 80]) assert.doesNotMatch(renderToStaticMarkup(createElement(Price, { amount: 89, originalAmount })), /<del/);
});
test("customer and merchant email show immutable original line totals", () => {
  const props = { businessName: "בדיקה", customerName: "בדיקה", orderNumber: "1", method: "pickup" as const, paymentMethod: "cash", items: [{ name: "מוצר", quantity: 2, unitPrice: 89, totalPrice: 178, originalTotalPrice: 240 }], subtotal: 178, deliveryFee: 0, serviceFee: 0, cutleryFee: 0, tip: 0, discount: 0, total: 178, trackingUrl: "https://example.com/order", dashboardUrl: "https://example.com/dashboard" };
  for (const result of [orderConfirmedEmail(props), merchantNewOrderEmail(props)]) {
    assert.match(result.html, /<del[^>]*>[^<]*240[^<]*<\/del>/);
    assert.match(result.html, /178/);
  }
});
test("print receipts use the stored comparison instead of querying current catalog prices", () => {
  const order = { number: "1", created_at: new Date().toISOString(), method: "pickup", payment_method: "cash", payment_status: "pending", subtotal: 178, total: 178, delivery_fee: 0, service_fee: 0, discount: 0, tip: 0, items: [{ name: "מוצר", quantity: 2, total_price: 178, original_total_price: 240, options: [] }] } as unknown as ReceiptOrder;
  const html = buildPassPrntHtml(order);
  assert.match(html, /<del[^>]*>[^<]*240[^<]*<\/del>/);
  assert.match(html, /178/);
});
