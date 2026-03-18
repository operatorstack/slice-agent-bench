import type { IndexEntry } from "./types";

export function formatAsLink(entry: IndexEntry): string {
  return `[${entry.title}](#${entry.slug})`;
}

export function formatAsList(entries: IndexEntry[]): string {
  return entries
    .map((entry, i) => `${i + 1}. ${formatAsLink(entry)}`)
    .join("\n");
}
