# CURRENT_STATE

## Goal
Benchmark whether slice-isolated coding agents generalize from test-driven repair to typecheck-driven repair using the same projection/edit loop.

## Status
Typecheck benchmark is implemented, run, and producing clean results across 6 tasks (3 L1 + 3 L2). Results are recorded in `results/benchmark-typecheck.json`.

mini-SWE-agent integration is wired end-to-end: adapter, runner, config, and CLI flags verified against v2.2.7. Ready for first benchmark run with `configs/benchmark-with-swe-agent.json`.

## Benchmark Tasks

### L1 (single-file, anchor file alone is sufficient)
- `wrong_return_type` (TS2322) — all ZCA agents pass in 1 step
- `missing_property` (TS2339) — all ZCA agents pass in 1 step
- `undefined_name` (TS2304) — all ZCA agents pass in 1 step

### L2 (cross-file, fix requires context beyond the anchor file)
- `cross_file_return_type` (TS2322) — both ZCA agents pass; naive may be guessing
- `wrong_method_call` (TS2339) — both ZCA agents pass; naive may be guessing
- `unresolved_cross_import` (TS2304) — **clean naive/adaptive split**: naive FAIL, adaptive PASS

## Latest Results (Sonnet 4)

| Agent | Pass rate | Input tokens |
|---|---|---|
| Baseline | 0/6 | 3.9M in / 13.7k out |
| ZCA Naive | 5/6 | 8.4k in / 4.0k out |
| ZCA Adaptive | 6/6 | 5.9k in / 2.0k out |

## Interpretation
- Projection vs baseline is strongly supported on the typecheck surface
- Typecheck generalization is strongly supported — same loops, same projectors, new signal
- Adaptive vs naive is cleanly supported by `unresolved_cross_import`
- Two of three L2 tasks are soft — naive passes by local guessing, not structural reasoning

## Bug Fixed This Iteration
The naive projector crashed with ENOENT on re-projection when `selectPrimaryAnchor` returned null (unsupported error code after model edit). The fallback path hit `inferSourceFile`, which is test-specific and defaults to `src/index.ts`. Fixed by:
1. Adding anchor fallback: `primary?.file ?? anchors[0]?.file` in `ZCAAgent.ts`
2. Adding `existsSync` guards in both `projectFailureSlice.ts` and `adaptiveProjector.ts`

## In Scope
- `src/runtime/tools/runTypeCheck.ts` — signal execution + anchor parsing + selection
- `src/agents/zca/ZCAAgent.ts` — signal routing, typecheck projector construction, anchor fallback
- `src/agents/baseline/BaselineAgent.ts` — signal routing for baseline
- `src/agents/zca/zcaLoop.ts` — parameterized verify/prompt (shared by both signals)
- `src/agents/baseline/baselineLoop.ts` — parameterized verify/prompt (shared by both signals)
- `src/agents/zca/projectFailureSlice.ts` — entryFile override + existsSync guard
- `src/agents/zca/adaptiveProjector.ts` — entryFile override + existsSync guard
- `src/agents/sweAgent/MiniSWEAgentAdapter.ts` — subprocess adapter for mini-SWE-agent CLI
- `experiments/tasks-typecheck/` — 6 fixtures (3 L1 + 3 L2)
- `configs/benchmark-typecheck.json` — separate config
- `configs/benchmark-with-swe-agent.json` — test benchmark with mini-SWE-agent baseline

## Out of Scope
- generic plugin/signal framework
- embeddings or learned projectors
- composite signals (test + typecheck combined)
- lint or runtime error support
- changes to existing test benchmark results

## Known Constraints
- existing test benchmark is untouched — all changes are backwards-compatible defaults
- supported error codes: TS2322, TS2339, TS2304 only
- anchor selection ignores node_modules, dist, .d.ts files
- one primary anchor per iteration (deterministic: sorted by file/line/code, first match)
- anchor fallback to first raw anchor when supported-code filter is empty
- projectors reused directly via entryFile override — no separate typecheck projector files
- loops reused directly via verify/prompt parameterization — no separate loop files

## Resolved Questions
- **Will the baseline agent handle tsc errors?** No — same exploration-without-editing pattern as tests.
- **Does adaptive projector's import-following help for type errors?** Yes — cleanly demonstrated on `unresolved_cross_import`.
- **Are 3 tasks enough to expose differences?** No — 3 L1 tasks showed no naive/adaptive split. After adding 3 L2 tasks, one (`unresolved_cross_import`) cleanly separates them.
- **Is `tsc --noEmit` startup time a problem?** No — each verification takes ~1s, negligible vs model latency.

## Open Questions
- How to design L2/L3 tasks where the naive projector reliably fails (not just sometimes)
- Whether `extractFailingSymbol` should be adapted for tsc output (currently test-oriented)
- Whether bounded parallel execution in the benchmark runner would meaningfully reduce wall-clock time

## Architecture Shape
```
                    ┌─────────────────┐
                    │ benchmark config │
                    │  signal: test    │
                    │  signal: typecheck│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  runBenchmark   │
                    │  (orchestrator) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
      ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
      │ BaselineAgent│ │ ZCA Naive│ │ ZCA Adaptive│
      └───────┬──────┘ └────┬─────┘ └──────┬──────┘
              │              │              │
              │         ┌────▼──────────────▼────┐
              │         │     signal routing      │
              │         │  test → runTests        │
              │         │  typecheck → runTypeCheck│
              │         │  typecheck → anchor →   │
              │         │    entryFile override    │
              │         └────────────┬────────────┘
              │                      │
      ┌───────▼──────────────────────▼────┐
      │         shared loop               │
      │  verify() → project() → edit →   │
      │  verify() → pass/fail             │
      └──────────────────────────────────┘
```

## Next Minimal Step
Run the SWE-agent benchmark with `npm run benchmark -- configs/benchmark-with-swe-agent.json` and record results. Then design harder L2/L3 typecheck tasks where the naive projector reliably fails.
