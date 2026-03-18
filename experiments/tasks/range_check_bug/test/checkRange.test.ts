import { describe, it, expect } from "vitest";
import { checkRange } from "../src/checkRange";

describe("checkRange", () => {
  it("assigns a value in the middle of a tier", () => {
    expect(checkRange(50)).toEqual({ tier: "free", value: 50 });
  });

  it("assigns the lower boundary of a tier", () => {
    expect(checkRange(100)).toEqual({ tier: "standard", value: 100 });
  });

  it("assigns a high-value to the enterprise tier", () => {
    expect(checkRange(5000)).toEqual({ tier: "enterprise", value: 5000 });
  });

  it("assigns the exact upper boundary of a tier", () => {
    expect(checkRange(99)).toEqual({ tier: "free", value: 99 });
  });
});
