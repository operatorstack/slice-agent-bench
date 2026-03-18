# range_check_bug — benchmark task

**Locality**: L2 (one-file bug, distracting nearby files)
**Observability**: O1 (test output clearly points to checkRange)

## Objective

Fix the failing test without modifying test files.

The bug is in one source file. The repo includes several nearby files
(`tiers.ts`, `formatTier.ts`, `validateInput.ts`) that look plausible
but are not involved in the bug.

## Expected agent behavior

| Agent | Expected |
|---|---|
| Baseline | May waste steps inspecting tiers.ts or validateInput.ts |
| ZCA (naive) | Should project checkRange.ts directly and fix quickly |
| ZCA (adaptive) | Same as naive — single-file fix, obvious projection |

## Running tests

```bash
npm install && npm test
```

Expected: **3 passing, 1 failing**.
