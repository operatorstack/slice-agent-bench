# config_lookup_bug — benchmark task

**Locality**: L2 (one-file fix, but the file is not the one the test names)
**Observability**: O3 (test output points at featureCheck.ts, actual bug is in configStore.ts)

## Objective

Fix the failing test without modifying test files.

The test calls `isFeatureEnabled("customBranding", "enterprise")` from
`featureCheck.ts` and expects `true`. The function is correct — the bug
is a typo (`"enterpise"` instead of `"enterprise"`) in the config data
inside `configStore.ts`.

A naive projector that maps `test/featureCheck.test.ts` to
`src/featureCheck.ts` will serve the wrong file — `featureCheck.ts`
has no bug.

## Expected agent behavior

| Agent | Expected |
|---|---|
| Baseline | Can grep for "customBranding" and find the typo in configStore.ts |
| ZCA (naive) | Projects featureCheck.ts — wrong file, will fail |
| ZCA (adaptive) | Should follow imports from featureCheck → configStore and include it |

## Running tests

```bash
npm install && npm test
```

Expected: **3 passing, 1 failing**.
