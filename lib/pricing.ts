/**
 * Pricing engine — pure functions. All amounts in integer shekels.
 */

export interface PriceLine {
  item_id: string;
  name: string;
  quantity: number;
  base_price: number;
  size_delta: number;
  options_delta: number;
  unit_price: number;
  total_price: number;
}

export interface CartSummary {
  lines: PriceLine[];
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  discount: number;
  tip: number;
  total: number;
}

export interface PriceInput {
  base_price: number;
  size_delta?: number;
  options_delta?: number;
  quantity: number;
}

export function unitPrice(input: PriceInput): number {
  return input.base_price + (input.size_delta ?? 0) + (input.options_delta ?? 0);
}

export function lineTotal(input: PriceInput): number {
  return unitPrice(input) * input.quantity;
}

export interface SummaryInput {
  lines: PriceLine[];
  delivery_fee: number;
  service_fee: number;
  discount?: number;
  tip?: number;
}

export function summarize(input: SummaryInput): CartSummary {
  const subtotal = input.lines.reduce((acc, l) => acc + l.total_price, 0);
  const discount = input.discount ?? 0;
  const tip = input.tip ?? 0;
  const total = subtotal + input.delivery_fee + input.service_fee + tip - discount;
  return {
    lines: input.lines,
    subtotal,
    delivery_fee: input.delivery_fee,
    service_fee: input.service_fee,
    discount,
    tip,
    total: Math.max(0, total),
  };
}
