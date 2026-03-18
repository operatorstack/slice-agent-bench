import type { ParsedAmount } from "./types";
import { normalizeWhitespace } from "./normalize";

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

const CURRENCY_CODES = ["USD", "EUR", "GBP", "CAD", "AUD"];

export function parseAmount(input: string): ParsedAmount {
  const cleaned = normalizeWhitespace(input);

  let currency: string | null = null;

  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (cleaned.includes(symbol)) {
      currency = code;
      break;
    }
  }

  if (!currency) {
    for (const code of CURRENCY_CODES) {
      if (cleaned.toUpperCase().includes(code)) {
        currency = code;
        break;
      }
    }
  }

  const numericMatch = cleaned.match(/(\d+\.?\d*)/);

  if (!numericMatch) {
    throw new Error(`Unable to parse amount from: "${input}"`);
  }

  const amount = parseFloat(numericMatch[1]);

  return { currency, amount };
}
