export interface FeatureFlag {
  enabledTiers: string[];
  description?: string;
}

export interface AppConfig {
  features: Record<string, FeatureFlag>;
}
