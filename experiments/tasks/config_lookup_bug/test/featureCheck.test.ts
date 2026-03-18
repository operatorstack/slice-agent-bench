import { describe, it, expect } from "vitest";
import { isFeatureEnabled } from "../src/featureCheck";

describe("isFeatureEnabled", () => {
  it("grants dark mode to free tier", () => {
    expect(isFeatureEnabled("darkMode", "free")).toBe(true);
  });

  it("denies analytics to pro tier", () => {
    expect(isFeatureEnabled("analytics", "pro")).toBe(false);
  });

  it("grants export PDF to enterprise tier", () => {
    expect(isFeatureEnabled("exportPdf", "enterprise")).toBe(true);
  });

  it("grants custom branding to enterprise tier", () => {
    expect(isFeatureEnabled("customBranding", "enterprise")).toBe(true);
  });
});
