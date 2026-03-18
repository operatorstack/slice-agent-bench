import type { User } from "./types.js";

export function formatDisplayName(user: User): string {
  return `${user.name} (${user.emailAddress})`;
}

export function formatUserID(user: User): string {
  return `user-${user.id}`;
}
