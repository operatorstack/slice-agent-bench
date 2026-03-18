export function logFeatureAccess(
  featureID: string,
  userTier: string,
  granted: boolean,
): void {
  const status = granted ? "GRANTED" : "DENIED";
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] Feature ${featureID} ${status} for tier ${userTier}`,
  );
}
