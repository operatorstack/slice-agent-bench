import { TIERS } from "./tiers";
import type { TierResult } from "./types";

export function checkRange(value: number): TierResult {
  for (const tier of TIERS) {
    if (value >= tier.min && value < tier.max) {
      return { tier: tier.name, value };
    }
  }
  return { tier: "unknown", value };
}
