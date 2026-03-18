# slug_conflict_bug — benchmark task

**Locality**: L3 (two-file dependency bug)
**Observability**: O2 (test output points to buildIndex, not both root causes)

## Objective

Fix the failing test without modifying test files.

This task requires fixing **two files** simultaneously:

1. `src/slugify.ts` — does not collapse consecutive hyphens
   (`"Hello - World"` → `"hello---world"` instead of `"hello-world"`)
2. `src/buildIndex.ts` — does not deduplicate slug collisions
   (duplicate titles get identical slugs instead of `slug-1`, `slug-2`)

Fixing only one file is not enough to pass the test.

## Expected agent behavior

| Agent | Expected |
|---|---|
| Baseline | May find both files through search, but costs more steps |
| ZCA (naive) | Will project only buildIndex.ts — likely fails |
| ZCA (adaptive) | Should follow imports from buildIndex → slugify and include both |

## Running tests

```bash
npm install && npm test
```

Expected: **2 passing, 1 failing**.
