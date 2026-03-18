import { slugify } from "./slugify";
import type { IndexEntry } from "./types";

export function buildIndex(titles: string[]): IndexEntry[] {
  const usedSlugs = new Set<string>();
  
  return titles.map((title) => {
    let baseSlug = slugify(title);
    // Collapse multiple hyphens into single hyphens
    baseSlug = baseSlug.replace(/-+/g, '-');
    let finalSlug = baseSlug;
    let counter = 1;
    
    // If slug already exists, add a numeric suffix
    while (usedSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    usedSlugs.add(finalSlug);
    
    return {
      title,
      slug: finalSlug,
    };
  });
}