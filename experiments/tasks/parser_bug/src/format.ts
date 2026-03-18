import type { ParsedAmount } from "./types";

const SYMBOL_MAP: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

export function formatAmount(parsed: ParsedAmount): string {
  const code = parsed.currency ?? "USD";
  return `${code} ${parsed.amount.toFixed(2)}`;
}

export function formatAmountWithSymbol(parsed: ParsedAmount): string {
  const code = parsed.currency ?? "USD";
  const symbol = SYMBOL_MAP[code] ?? code;
  return `${symbol}${parsed.amount.toFixed(2)}`;
}

export function formatAmountCompact(parsed: ParsedAmount): string {
  const code = parsed.currency ?? "USD";
  const symbol = SYMBOL_MAP[code] ?? code;

  if (parsed.amount >= 1_000_000) {
    return `${symbol}${(parsed.amount / 1_000_000).toFixed(1)}M`;
  }
  if (parsed.amount >= 1_000) {
    return `${symbol}${(parsed.amount / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${parsed.amount.toFixed(2)}`;
}
