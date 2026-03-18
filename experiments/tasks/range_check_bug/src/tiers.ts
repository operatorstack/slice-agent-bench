import type { Tier } from "./types";

export const TIERS: Tier[] = [
  { name: "free", min: 0, max: 99 },
  { name: "standard", min: 100, max: 499 },
  { name: "premium", min: 500, max: 999 },
  { name: "enterprise", min: 1000, max: Infinity },
];
