import { describe, it, expect } from "vitest";
import { parseAmount } from "../src/parseAmount";

describe("parseAmount", () => {
  it("parses a plain numeric amount with no currency", () => {
    const result = parseAmount("Amount: 42.00");
    expect(result.amount).toBe(42.0);
    expect(result.currency).toBeNull();
  });

  it("parses a dollar-sign prefixed amount", () => {
    const result = parseAmount("Total amount due: $83.20");
    expect(result.amount).toBe(83.2);
    expect(result.currency).toBe("USD");
  });

  it("parses an amount with comma-separated thousands", () => {
    const result = parseAmount("USD 1,242.50");
    expect(result.amount).toBe(1242.5);
    expect(result.currency).toBe("USD");
  });
});
