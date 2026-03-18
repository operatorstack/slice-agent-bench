import type { TierResult } from "./types";

export function formatTierResult(result: TierResult): string {
  if (result.tier === "unknown") {
    return `Value ${result.value} does not match any tier`;
  }
  return `${result.tier.charAt(0).toUpperCase()}${result.tier.slice(1)} tier (value: ${result.value})`;
}

export function formatTierBadge(tierName: string): string {
  const badges: Record<string, string> = {
    free: "[FREE]",
    standard: "[STD]",
    premium: "[PRO]",
    enterprise: "[ENT]",
  };
  return badges[tierName] ?? "[???]";
}
