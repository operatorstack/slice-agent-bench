export function validateInput(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error("Value must be a number");
  }
  if (!Number.isFinite(value)) {
    throw new Error("Value must be finite");
  }
  if (value < 0) {
    throw new Error("Value must be non-negative");
  }
  return value;
}
