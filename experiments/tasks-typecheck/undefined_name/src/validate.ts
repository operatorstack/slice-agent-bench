import { MIN_LENGTH } from "./constants.js";

export function validateUsername(input: string): boolean {
  const trimmed = sanitizeInput(input);
  if (trimmed.length < MIN_LENGTH) {
    return false;
  }
  return /^[a-zA-Z0-9_]+$/.test(trimmed);
}
