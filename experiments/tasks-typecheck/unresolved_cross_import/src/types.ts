export type AccessTier = "read" | "write" | "admin" | "audit";

export interface AccessRule {
  resource: string;
  allowed: AccessTier[];
}

export interface AccessPolicy {
  rules: AccessRule[];
  defaultTier: AccessTier;
}
