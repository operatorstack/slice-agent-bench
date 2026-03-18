import type { AccessPolicy } from "./types.js";

export function loadPolicy(raw: string): AccessPolicy {
  return JSON.parse(raw) as AccessPolicy;
}
