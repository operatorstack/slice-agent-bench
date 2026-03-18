import { describe, it, expect } from "vitest";
import { buildIndex } from "../src/buildIndex";

describe("buildIndex", () => {
  it("builds a simple index from unique titles", () => {
    const result = buildIndex(["Hello World", "Getting Started"]);
    expect(result).toEqual([
      { title: "Hello World", slug: "hello-world" },
      { title: "Getting Started", slug: "getting-started" },
    ]);
  });

  it("slugifies titles with special characters", () => {
    const result = buildIndex(["What's New?"]);
    expect(result).toEqual([
      { title: "What's New?", slug: "whats-new" },
    ]);
  });

  it("deduplicates slugs and collapses hyphens for repeated titles", () => {
    const result = buildIndex([
      "Hello - World",
      "Hello - World",
      "Getting Started",
    ]);
    expect(result).toEqual([
      { title: "Hello - World", slug: "hello-world" },
      { title: "Hello - World", slug: "hello-world-1" },
      { title: "Getting Started", slug: "getting-started" },
    ]);
  });
});
