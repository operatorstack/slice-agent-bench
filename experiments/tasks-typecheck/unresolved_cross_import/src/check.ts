import { loadPolicy } from "./loader.js";

export function hasAccess(
  raw: string,
  resource: string,
  required: AccessTier,
): boolean {
  const policy = loadPolicy(raw);
  const rule = policy.rules.find((r) => r.resource === resource);
  if (!rule) {
    return policy.defaultTier === required;
  }
  return rule.allowed.includes(required);
}
