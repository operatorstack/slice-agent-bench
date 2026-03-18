# slice-agent-bench

A benchmark for comparing coding agent execution architectures — specifically, whether **slice-isolated execution with fresh projection** outperforms **context accumulation via long conversation history** on bug-fix tasks of varying difficulty.

## Motivation

Traditional coding agents accumulate a growing conversation history as they explore, read files, and attempt fixes. This mirrors how most agent frameworks work: the model sees everything it has done so far and decides what to do next.

The problem — observed first in browser automation, then generalized — is that **accumulated context becomes a liability in non-deterministic environments**. The model carries forward stale observations, repeats failed strategies, and wastes steps exploring files it has already read.

ZCA (Zero-Context Architecture) is the alternative: re-observe the environment fresh each iteration, project a minimal slice of the current state, and let the model operate only on that. No history, no exploration — just the current failure and the relevant code.

This connects to LeCun's objective-driven AI framework for non-deterministic world models: the projector is the perception module, the canonical state is the world state representation, and re-projection each step replaces reliance on predicted state from accumulated history.

## The research question

> When does projection help, and when does projection become the bottleneck?

The benchmark tests this across two axes:

### Axis 1: Task locality

How many files need to change?

| Level | Description |
|---|---|
| **L1** | Single-file bug, no distractors |
| **L2** | Single-file bug, plausible distractors nearby |
| **L3** | Two-file dependency bug |
| **L4** | Multi-file architectural bug |

### Axis 2: Projection observability

How easy is it to infer the right slice from the failure?

| Level | Description |
|---|---|
| **O1** | Failure output clearly points to file/function |
| **O2** | Failure output points to component, not exact file |
| **O3** | Failure output is ambiguous |
| **O4** | Failure output does not reveal the source at all |

## Benchmark tasks

| Task | Locality | Observability | Bug |
|---|---|---|---|
| `parser_bug` | L1 | O1 | Regex doesn't handle comma-separated thousands |
| `range_check_bug` | L2 | O1 | Off-by-one boundary (`<` vs `<=`), distractors in tiers/validation files |
| `slug_conflict_bug` | L3 | O2 | Two files need fixing: slugify (consecutive hyphens) + buildIndex (no dedup) |
| `config_lookup_bug` | L2 | O3 | Test calls correct code — actual bug is a typo in config data in a different file |

Each task is a self-contained TypeScript + Vitest project with exactly 1 failing test.

## Agents compared

### A. Baseline — long-context loop

Traditional agent with full tool access (`readFile`, `searchRepo`, `editFile`, `runTests`). Accumulates conversation history across steps. The model decides what to explore and when to edit.

### B. ZCA with naive projector

Maps the failing test filename to a single source file. Stateless per step — each iteration sends only the current test output and projected source code. The model can only call `editFile`.

### C. ZCA with adaptive projector

Extends the naive projector with a bounded exploration budget:
1. Parse the primary file's imports
2. Run one `grep` search for a key symbol from the failure
3. Include up to 3 files in the slice

This keeps the agent slice-isolated while recovering coverage on multi-file and ambiguous-source tasks.

## Initial results (Claude Sonnet 4)

| Task | Baseline | ZCA Naive | ZCA Adaptive |
|---|---|---|---|
| parser_bug (L1/O1) | FAIL — 10 steps, 27s | **PASS** — 1 step, 8s | **PASS** — 1 step, 8s |
| range_check_bug (L2/O1) | FAIL — 10 steps, 26s | **PASS** — 1 step, 6s | **PASS** — 1 step, 6s |
| slug_conflict_bug (L3/O2) | FAIL — 10 steps, 32s | **PASS** — 2 steps, 15s | **PASS** — 1 step, 8s |
| config_lookup_bug (L2/O3) | FAIL — 10 steps, 33s | FAIL — 5 steps, 50s | **PASS** — 1 step, 8s |
| **Pass rate** | **0/4** | **3/4** | **4/4** |

**Key finding**: naive ZCA fails on `config_lookup_bug` because the projector serves the wrong file (`featureCheck.ts` has no bug — the typo is in `configStore.ts`). The adaptive projector follows the import chain and includes `configStore.ts`, fixing it in one step.

**Note**: The baseline loop currently has a structural issue — it re-runs tests after every tool call (including reads) and never reaches `editFile` within its step budget. This needs improvement for a fair efficiency comparison. The ZCA results are the validated finding.

## The thesis

Not "ZCA always beats normal agents" — but:

> **Slice-isolated execution with fresh projection outperforms context accumulation on localizable tasks. Performance on non-local tasks is determined by projector quality, not model quality.**

The adaptive projector demonstrates that improving the perception layer restores ZCA's advantage without turning back into a full long-context agent.

## Running the benchmark

```bash
# Install harness dependencies
npm install

# Install task dependencies
cd experiments/tasks/parser_bug && npm install && cd ../../..
cd experiments/tasks/range_check_bug && npm install && cd ../../..
cd experiments/tasks/slug_conflict_bug && npm install && cd ../../..
cd experiments/tasks/config_lookup_bug && npm install && cd ../../..

# Run individual agents
export ANTHROPIC_API_KEY=sk-...
npm run baseline -- parser_bug
npm run zca -- range_check_bug
npm run zca -- config_lookup_bug configs/zca-adaptive.json

# Run full benchmark matrix
npm run benchmark

# Typecheck
npm run typecheck
```

Results are saved to `results/benchmark-latest.json`.

## Repository layout

```
slice-agent-bench/
├── experiments/tasks/         # Benchmark task projects (each self-contained)
│   ├── parser_bug/            # L1/O1 — local obvious
│   ├── range_check_bug/       # L2/O1 — local misleading
│   ├── slug_conflict_bug/     # L3/O2 — two-file dependency
│   └── config_lookup_bug/     # L2/O3 — ambiguous source
├── src/
│   ├── agents/baseline/       # Baseline long-context agent
│   ├── agents/zca/            # ZCA agent (naive + adaptive projectors)
│   ├── model/                 # Model client abstraction (Anthropic, stub)
│   ├── runtime/tools/         # Shared tools (readFile, searchRepo, editFile, runTests)
│   ├── runtime/execution/     # Task path resolution, logger
│   ├── analysis/metrics/      # Benchmark result types
│   └── scripts/               # CLI entrypoints (runBaseline, runZCA, runBenchmark)
├── configs/                   # Agent and benchmark configurations
└── results/                   # Run outputs (git-ignored)
```

## Known limitations

- 4 tasks is a small benchmark — demonstrates the pattern but doesn't prove generality
- L4 (multi-file architectural) and O4 (opaque failure) tasks are not yet represented
- The baseline agent needs loop improvements before efficiency comparisons are fair
- Token usage, irrelevant file edits, and oscillation metrics are not yet captured
- The adaptive projector is simple (import-following + grep) — a production projector would need static analysis or call graph tracing
