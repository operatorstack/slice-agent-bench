export interface Tier {
  name: string;
  min: number;
  max: number;
}

export interface TierResult {
  tier: string;
  value: number;
}
