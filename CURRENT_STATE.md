# CURRENT_STATE

## Goal
Benchmark whether slice-isolated coding agents generalize from test-driven repair to typecheck-driven repair using the same projection/edit loop.

## Active Slice
Typecheck benchmark surface is implemented and wired end-to-end. Three plumbing fixtures pass `tsc --noEmit` failure through existing projectors, and results save separately. Awaiting first live benchmark run.

## Inputs
- `tsc --noEmit` output from task directory
- benchmark config at `configs/benchmark-typecheck.json`

## Expected Output
- parsed `TypeErrorAnchor` with file/line/column/code/message
- deterministic primary anchor selection
- separate typecheck benchmark results at `results/benchmark-typecheck.json`

## In Scope
- `src/runtime/tools/runTypeCheck.ts` — signal execution + anchor parsing + selection
- `src/agents/zca/ZCAAgent.ts` — signal routing, typecheck projector construction
- `src/agents/baseline/BaselineAgent.ts` — signal routing for baseline
- `src/agents/zca/zcaLoop.ts` — parameterized verify/prompt (shared by both signals)
- `src/agents/baseline/baselineLoop.ts` — parameterized verify/prompt (shared by both signals)
- `src/agents/zca/projectFailureSlice.ts` — entryFile override (no new projector)
- `src/agents/zca/adaptiveProjector.ts` — entryFile override (no new projector)
- `experiments/tasks-typecheck/` — 3 plumbing fixtures
- `configs/benchmark-typecheck.json` — separate config

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
- projectors reused directly via entryFile override — no separate typecheck projector files
- loops reused directly via verify/prompt parameterization — no separate loop files
- 3 fixture tasks are plumbing-quality, not published benchmark coverage

## Unknown Constraints
- whether Sonnet/Haiku can reliably fix type errors with the current prompt framing
- whether adaptive projector's import-following helps for type errors (may already be single-file)
- whether 3 tasks are enough to expose architectural differences between agents
- whether `tsc --noEmit` startup time affects duration metrics meaningfully

## Verification
- Command: `npm run benchmark -- configs/benchmark-typecheck.json`
- Success condition: all 3 tasks run for all 3 agents, results save to `results/benchmark-typecheck.json`

## Current Owners
- signal execution + anchor parsing → `src/runtime/tools/runTypeCheck.ts`
- anchor → projector routing → `src/agents/zca/ZCAAgent.ts`
- naive projection → `src/agents/zca/projectFailureSlice.ts`
- adaptive projection → `src/agents/zca/adaptiveProjector.ts`
- ZCA loop → `src/agents/zca/zcaLoop.ts`
- baseline loop → `src/agents/baseline/baselineLoop.ts`
- benchmark orchestration → `src/scripts/runBenchmark.ts`
- task sandboxing → `src/runtime/execution/sandbox.ts`
- result types → `src/analysis/metrics/types.ts`

## Files Changed (this iteration)
- **new:** `src/runtime/tools/runTypeCheck.ts`
- **new:** `configs/benchmark-typecheck.json`
- **new:** `experiments/tasks-typecheck/wrong_return_type/` (TS2322)
- **new:** `experiments/tasks-typecheck/missing_property/` (TS2339)
- **new:** `experiments/tasks-typecheck/undefined_name/` (TS2304)
- **modified:** `src/agents/zca/ZCAAgent.ts` — signal routing, typecheck projector builder
- **modified:** `src/agents/zca/zcaLoop.ts` — optional verify/systemPrompt/goal/failureLabel
- **modified:** `src/agents/zca/projectFailureSlice.ts` — optional entryFile parameter
- **modified:** `src/agents/zca/adaptiveProjector.ts` — options object with entryFile
- **modified:** `src/agents/zca/canonicalizeState.ts` — optional goal/failureLabel
- **modified:** `src/agents/zca/zcaPrompt.ts` — uses failureLabel from state
- **modified:** `src/agents/baseline/BaselineAgent.ts` — signal routing
- **modified:** `src/agents/baseline/baselineLoop.ts` — optional verify/prompt/messages
- **modified:** `src/runtime/tools/index.ts` — signal-aware tool registry
- **modified:** `src/runtime/execution/taskPaths.ts` — optional tasksDir
- **modified:** `src/runtime/execution/sandbox.ts` — propagate tasksDir
- **modified:** `src/scripts/runBenchmark.ts` — parse signal/tasksDir from config
- **modified:** `src/analysis/metrics/types.ts` — typecheck task classifications
- **modified:** `src/runtime/execution/logger.ts` — verbose logging (from earlier)
- **modified:** `src/scripts/runZCA.ts` — --verbose flag (from earlier)

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

## Open Questions
- will the baseline agent's exploration loop handle `tsc` errors as effectively as test errors?
- should the typecheck prompt include the specific error code and line for better targeting?
- is `npx tsc --noEmit` startup latency acceptable or should we cache the compiler?
- should future tasks include multi-file type errors (L2/L3 locality)?

## Next Minimal Step
Run the typecheck benchmark end-to-end with `npm run benchmark -- configs/benchmark-typecheck.json` and record results. Then assess whether the projection architecture holds or needs adjustment before adding more tasks.
