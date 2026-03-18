export function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function stripControlCharacters(input: string): string {
  return input.replace(/[\x00-\x1F\x7F]/g, "");
}

export function collapseSpacesAroundSymbols(input: string): string {
  return input.replace(/\s*([.$€£])\s*/g, "$1");
}
