import type { OrderSummary } from "./types.js";

export function calculateOrder(
  prices: number[],
  taxRate: number,
): OrderSummary {
  const subtotal = prices.reduce((sum, p) => sum + p, 0);
  const tax = subtotal * taxRate;
  const total = `${(subtotal + tax).toFixed(2)}`;
  return { subtotal, tax, total };
}
