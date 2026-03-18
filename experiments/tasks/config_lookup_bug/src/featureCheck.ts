import { getConfig } from "./configStore";

export function isFeatureEnabled(
  featureID: string,
  userTier: string,
): boolean {
  const config = getConfig();
  const feature = config.features[featureID];
  if (!feature) {
    return false;
  }
  return feature.enabledTiers.includes(userTier);
}

export function getEnabledFeatures(userTier: string): string[] {
  const config = getConfig();
  return Object.entries(config.features)
    .filter(([, feature]) => feature.enabledTiers.includes(userTier))
    .map(([featureID]) => featureID);
}
