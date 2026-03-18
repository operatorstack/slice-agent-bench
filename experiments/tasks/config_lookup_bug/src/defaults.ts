export const DEFAULT_TIER = "free";

export const TIER_HIERARCHY = ["free", "pro", "enterprise"];

export function isValidTier(tier: string): boolean {
  return TIER_HIERARCHY.includes(tier);
}

export function getTierLevel(tier: string): number {
  const index = TIER_HIERARCHY.indexOf(tier);
  return index === -1 ? 0 : index;
}
