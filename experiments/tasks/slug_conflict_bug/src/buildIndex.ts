import { slugify } from "./slugify";
import type { IndexEntry } from "./types";

export function buildIndex(titles: string[]): IndexEntry[] {
  return titles.map((title) => ({
    title,
    slug: slugify(title),
  }));
}
