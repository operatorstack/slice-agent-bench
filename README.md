# Slice-Agent-Bench

**Does a coding agent need to explore a repo, or can it operate on a projected slice?**

Slice-Agent-Bench explores an alternative runtime design for coding agents based on **slice-isolated execution**.

Instead of accumulating a growing context while exploring a repository, the agent repeatedly **re-observes the environment and operates on a minimal projected slice of the codebase**.

The goal of the benchmark is to isolate a simple question:

> When debugging code, how much of the repository does an agent actually need to see?

The repository contains a small set of controlled bug-fix tasks designed to evaluate how different execution architectures behave when solving the same problems.

---

# Motivation

Most coding agents follow a **context accumulation loop**:

```text
search → read files → search → read more → edit → run tests
````

Each step adds more information to the conversation history.

Over time the model sees:

* previously read files
* earlier reasoning steps
* intermediate edits
* tool outputs

This leads to **very large contexts and high token usage**.

Slice-Agent-Bench evaluates an alternative execution architecture called **Zero Context Architecture (ZCA)**.

Instead of accumulating context, the agent **re-observes the environment each iteration** and only sends a **minimal slice of relevant files** to the model.

```text
run tests → project slice → edit → run tests → re-project
```

No conversation history is retained between iterations.

---

# What is ZCA?

**Zero-Context Architecture (ZCA)** is a runtime pattern for agent design where the model does not carry forward a growing interaction history.

Instead, each iteration follows a bounded loop:

```text
observe current failure
→ project a minimal relevant slice
→ apply the model as a local operator
→ verify
→ re-observe
```

The idea is to replace **context accumulation** with **fresh state projection**.

In this benchmark, ZCA is applied to coding agents: the runtime isolates a small slice of the repository relevant to the current failure, and the model only operates on that slice.

The design is loosely inspired by feedback loops in control systems, where the system is repeatedly re-observed and corrected from current state rather than relying on accumulated internal history.

---

# Benchmark design

The repository currently contains two benchmark surfaces:

1. **Test-driven repair**
2. **TypeScript compiler-driven repair**

Both are designed to evaluate the same architectural question: how much code does an agent actually need to see in order to resolve a verifier-backed failure?

Tasks vary along two axes:

## Task locality

How many files are required to fix the bug.

| Level | Description             |
| ----- | ----------------------- |
| L1    | Single file bug         |
| L2    | Two files involved      |
| L3    | Multiple files involved |

## Projection observability

How obvious the bug source is from the failure signal.

| Level | Description                                             |
| ----- | ------------------------------------------------------- |
| O1    | Directly observable from stack trace or compiler output |
| O2    | Requires reasoning across files                         |
| O3    | Ambiguous failure location                              |

---

# Agents compared

Four agents are evaluated.

## Baseline agent

Traditional coding agent loop.

```text
search
read file
search
read more files
edit
run verifier
repeat
```

Context grows across iterations. A "step" is counted only when the agent makes an edit and re-runs verification. Read-only tool calls (search, read) are free sub-iterations within each step, so the agent has room to explore before committing a change.

---

## mini-SWE-agent (external baseline)

An external coding agent used as a second baseline for comparison. [mini-SWE-agent](https://github.com/SWE-agent/mini-swe-agent) is a compact autonomous software-engineering agent from the SWE-bench ecosystem.

It runs the same tasks, in the same sandboxes, evaluated by the same verifiers. The benchmark harness invokes it as a subprocess and collects metrics externally. This provides a recognizable external reference point without changing the benchmark architecture.

---

## ZCA Naive

Slice-isolated execution with a simple projector.

The failing signal identifies a candidate file which is sent to the model.

---

## ZCA Adaptive

Slice-isolated execution with a multi-file projector.

Candidate files are selected using heuristics such as:

* stack trace files
* compiler anchors
* imports
* dependency relationships

This allows the agent to include the correct files even when the failure source is ambiguous.

---

# Experimental results

Three benchmark configurations were run.

---

# Experiment 1 — Same model comparison

All agents use **Claude Sonnet 4**.

| Task                      | Baseline (Sonnet)                 | ZCA Naive (Sonnet)               | ZCA Adaptive (Sonnet)            |
| ------------------------- | --------------------------------- | -------------------------------- | -------------------------------- |
| parser_bug (L1/O1)        | FAIL — 10 steps, 71s, 159k tokens | PASS — 1 step, 8s, 2.2k tokens   | PASS — 1 step, 8s, 2.5k tokens   |
| range_check_bug (L2/O1)   | FAIL — 10 steps, 82s, 1.2M tokens | PASS — 1 step, 5s, 1.8k tokens   | PASS — 1 step, 7s, 2.2k tokens   |
| slug_conflict_bug (L3/O2) | FAIL — 10 steps, 89s, 167k tokens | PASS — 1 step, 12s, 2.1k tokens  | PASS — 2 steps, 14s, 4.4k tokens |
| config_lookup_bug (L2/O3) | FAIL — 10 steps, 73s, 242k tokens | FAIL — 5 steps, 42s, 9.9k tokens | PASS — 1 step, 7s, 2.2k tokens   |

| Agent        | Pass rate | Input tokens |
| ------------ | --------- | ------------ |
| Baseline     | 0 / 4     | 1.7M         |
| ZCA Naive    | 3 / 4     | 11.8k        |
| ZCA Adaptive | 4 / 4     | 9.1k         |

### Observation

With the **same model**, execution architecture dramatically changes behavior.

The baseline agent has 10 edit-steps, but Sonnet consistently explores without committing edits, exhausting its budget. The same baseline architecture passes 4/4 when given Opus (see Experiment 2), suggesting that stronger models cope better with open-ended exploration loops while weaker models benefit more from architectural guardrails.

The ZCA agents sidestep this entirely. They receive a pre-projected slice and edit immediately.

---

# Experiment 2 — Cross model comparison

Baseline uses **Claude Opus 4**.
ZCA agents use **Claude Haiku 4.5**.

| Task                      | Baseline (Opus 4)                 | ZCA Naive (Haiku 4.5)             | ZCA Adaptive (Haiku 4.5)        |
| ------------------------- | --------------------------------- | --------------------------------- | ------------------------------- |
| parser_bug (L1/O1)        | PASS — 8 steps, 103s, 164k tokens | PASS — 1 step, 5s, 2.4k tokens    | PASS — 1 step, 5s, 2.8k tokens  |
| range_check_bug (L2/O1)   | PASS — 4 steps, 38s, 34k tokens   | PASS — 1 step, 4s, 2.0k tokens    | PASS — 1 step, 4s, 2.4k tokens  |
| slug_conflict_bug (L3/O2) | PASS — 6 steps, 51s, 45k tokens   | PASS — 2 steps, 11s, 4.9k tokens  | PASS — 2 steps, 9s, 4.9k tokens |
| config_lookup_bug (L2/O3) | PASS — 5 steps, 40s, 34k tokens   | FAIL — 5 steps, 27s, 13.7k tokens | PASS — 1 step, 4s, 2.4k tokens  |

| Agent              | Pass rate | Input tokens |
| ------------------ | --------- | ------------ |
| Baseline Opus      | 4 / 4     | 270k         |
| ZCA Naive Haiku    | 3 / 4     | 17k          |
| ZCA Adaptive Haiku | 4 / 4     | 10k          |

### Observation

The adaptive ZCA agent running on Haiku, the cheapest Anthropic model, matches the success rate of the baseline running on Opus, the most expensive, while using **27x fewer input tokens**. This suggests that slice-isolated execution can make smaller models viable for tasks that would otherwise require a frontier model.

---

# Experiment 3 — TypeScript compiler repair (typecheck signal)

A third benchmark configuration evaluates the same architectural ideas using **TypeScript compiler errors instead of failing tests**.

In this setup the loop becomes:

```text
run tsc --noEmit
→ parse compiler errors
→ project slice from error anchors
→ edit
→ re-run typecheck
→ re-project
```

This removes the test harness entirely and treats the **compiler as the verification oracle**.

Each task is a small TypeScript project containing one intentional type-level failure such as:

* incorrect return type
* missing property
* undefined identifier
* unresolved cross-file import

| Task                            | Baseline                              | ZCA Naive                          | ZCA Adaptive                     |
| ------------------------------- | ------------------------------------- | ---------------------------------- | -------------------------------- |
| wrong_return_type (L1/O1)       | FAIL — 10 steps, 88.9s, 266.1k tokens | PASS — 1 step, 6.0s, 1.2k tokens   | PASS — 1 step, 6.8s, 1.3k tokens |
| missing_property (L1/O1)        | FAIL — 10 steps, 89.9s, 504.2k tokens | PASS — 1 step, 7.0s, 1.2k tokens   | PASS — 1 step, 6.7s, 1.2k tokens |
| undefined_name (L1/O1)          | FAIL — 10 steps, 94.4s, 367.0k tokens | PASS — 1 step, 6.6s, 1.2k tokens   | PASS — 1 step, 9.8s, 1.3k tokens |
| cross_file_return_type (L2/O1)  | FAIL — 10 steps, 133.9s, 1.2M tokens  | PASS — 1 step, 7.8s, 1.2k tokens   | PASS — 1 step, 6.0s, 1.4k tokens |
| wrong_method_call (L2/O2)       | FAIL — 10 steps, 103.5s, 1.4M tokens  | PASS — 1 step, 5.9s, 1.1k tokens   | PASS — 1 step, 5.6s, 1.4k tokens |
| unresolved_cross_import (L2/O2) | FAIL — 10 steps, 72.7s, 170.8k tokens | FAIL — 5 steps, 41.8s, 6.6k tokens | PASS — 1 step, 5.6s, 1.3k tokens |

| Agent        | Pass rate | Input tokens |
| ------------ | --------- | ------------ |
| Baseline     | 0 / 6     | 3.9M         |
| ZCA Naive    | 5 / 6     | 8.4k         |
| ZCA Adaptive | 6 / 6     | 5.9k         |

### Observation

Compiler-driven repair shows the same architectural pattern as the test benchmark.

The baseline agent repeatedly explores the repository but often fails to commit useful edits within the allowed steps.

The slice-based agents operate directly on the projected failure surface and typically resolve the error in a single iteration.

The `unresolved_cross_import` task is the clearest separator between naive and adaptive projection. The naive projector isolates only the failing file, which leaves the model without the cross-file dependency defining the missing symbol. The adaptive projector follows imports and expands the slice, allowing the error to be resolved in one step.

At the same time, some L2 tasks still appear soft or locally guessable, so the current typecheck benchmark should be read as an early architectural result rather than a complete benchmark of compiler-driven repair.

---

# Current interpretation

- **Projection vs baseline** is strongly supported across both test and typecheck surfaces. The baseline agent consistently fails by exploring without editing, regardless of failure signal.
- **Typecheck generalization** is strongly supported. The same projection/edit loop, with no changes to projectors or agent loops, produces clean results on TypeScript compiler errors.
- **Adaptive vs naive** is now cleanly supported by `unresolved_cross_import`, where the naive projector fails across 5 steps (it only sees the anchor file) while the adaptive projector solves it in 1 step (it follows imports to include context).
- **More hard L2 tasks are still needed.** Two of three L2 tasks were solved by naive — likely because the model could guess the correct fix from the anchor file alone. Tasks where the fix is not locally inferrable are needed to further stress the naive/adaptive boundary.

---

# Key findings

### Execution architecture strongly affects agent behavior

Across both test-driven and compiler-driven benchmarks, the baseline agent repeatedly explores the repository but often fails to commit edits within the allowed steps.

The slice-isolated agents bypass this exploration phase by operating on a projected failure slice, allowing them to apply edits immediately.

---

### Slice projection determines the ceiling

The naive ZCA agent fails when the projected slice omits relevant files.

The `unresolved_cross_import` task in the compiler benchmark demonstrates this clearly: single-file projection is insufficient when the missing symbol is defined in a different module.

The adaptive projector resolves this by expanding the slice along dependency edges.

---

### Context size can be dramatically reduced

In the same-model test benchmark, the baseline consumed **1.7M input tokens** across 4 tasks while failing all of them. ZCA Adaptive consumed **9.1k tokens** and passed all four, a **187x reduction** with better outcomes.

In the compiler benchmark, the baseline consumed **3.9M input tokens** across 6 tasks while failing all of them. ZCA Adaptive consumed **5.9k tokens** and passed all six.

---

### Typecheck generalization is strongly supported

The same slice-isolated runtime pattern extends beyond failing tests.

TypeScript compiler output can be treated as a structured failure surface:

```text
compiler error
→ anchor
→ projected slice
→ bounded edit
→ re-verify
```

This suggests that the architecture is not limited to test-backed repair. It applies more generally to **verifier-backed software repair**.

---

# Limitations

This benchmark is intentionally small and designed as a **diagnostic experiment**, not a large-scale evaluation.

It does not attempt to compete with larger datasets such as SWE-bench.

Instead it isolates architectural tradeoffs between:

* context accumulation
* slice projection

The current benchmarks are intentionally small and synthetic. Larger repositories may introduce additional challenges for slice projection and dependency discovery.

Some compiler tasks are still soft enough that a local semantic guess can pass without truly requiring adaptive expansion.

Future work should add more hard cross-file tasks where local patching is insufficient and dependency-aware projection is required.

---

# Running the benchmark

```bash
export ANTHROPIC_API_KEY=YOUR_KEY
npm install
npm run benchmark -- configs/benchmark.json
```

Results are saved to `results/<config-name>.json`, e.g.:

```text
results/benchmark.json
results/benchmark-cross-model.json
results/benchmark-typecheck.json
```

If you want to run the compiler-driven benchmark:

```bash
npm run benchmark -- configs/benchmark-typecheck.json
```

To run the benchmark including mini-SWE-agent as an external baseline:

```bash
pip install mini-swe-agent
npm run benchmark -- configs/benchmark-with-swe-agent.json
```

mini-SWE-agent is a Python CLI. It must be installed separately and available as `mini` on your PATH. The adapter invokes it as a subprocess and does not require any other Python dependencies in this repository.

---

# Repository structure

```text
experiments/tasks/                      # test-driven benchmark task definitions
  parser_bug/
  range_check_bug/
  slug_conflict_bug/
  config_lookup_bug/

experiments/tasks-typecheck/            # compiler-driven benchmark task definitions
  wrong_return_type/
  missing_property/
  undefined_name/
  cross_file_return_type/
  wrong_method_call/
  unresolved_cross_import/

src/
  agents/baseline/                      # long-context baseline agent
  agents/zca/                           # ZCA agent + naive/adaptive projectors
  agents/sweAgent/                      # mini-SWE-agent subprocess adapter
  model/                                # model client abstraction
  runtime/                              # sandbox execution and tool registry
  analysis/                             # result types and metrics
  scripts/                              # CLI entrypoints

configs/
  benchmark.json                        # same-model (Sonnet) test benchmark
  benchmark-cross-model.json            # cross-model (Opus vs Haiku) test benchmark
  benchmark-typecheck.json              # typecheck-driven benchmark
  benchmark-with-swe-agent.json         # test benchmark with mini-SWE-agent baseline

results/                                # benchmark output JSON files
```

---

# Future work

Possible directions include:

* expanding the benchmark with additional locality and observability levels
* adding harder compiler-driven cross-file tasks
* evaluating ZCA agents on larger repositories
* improving slice projection heuristics
* extending the same failure-surface pattern to other verifier-backed domains such as CI and static analysis

---

# License

MIT