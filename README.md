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
```

Each step adds more information to the conversation history.

Over time the model sees:

- previously read files  
- earlier reasoning steps  
- intermediate edits  
- tool outputs  

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

Each task is a small TypeScript project containing:

- a minimal codebase  
- one failing test  
- exactly one bug  

Agents must modify the code so that the test suite passes.

Tasks vary along two axes:

## Task locality

How many files are required to fix the bug.

| Level | Description |
|------|-------------|
| L1 | Single file bug |
| L2 | Two files involved |
| L3 | Multiple files involved |

## Projection observability

How obvious the bug source is from the failure signal.

| Level | Description |
|------|-------------|
| O1 | Directly observable from stack trace |
| O2 | Requires reasoning across files |
| O3 | Ambiguous failure location |

---

# Agents compared

Three agents are evaluated.

## Baseline agent

Traditional coding agent loop.

```text
search
read file
search
read more files
edit
run tests
repeat
```

Context grows across iterations. A "step" is counted only when the agent makes an edit and re-runs tests. Read-only tool calls (search, read) are free sub-iterations within each step, so the agent has room to explore before committing a change.

---

## ZCA Naive

Slice-isolated execution with a simple projector.

The failing test identifies a candidate file which is sent to the model.

---

## ZCA Adaptive

Slice-isolated execution with a multi-file projector.

Candidate files are selected using heuristics such as:

- stack trace files  
- test imports  
- dependency relationships  

This allows the agent to include the correct files even when the failure source is ambiguous.

---

# Experimental results

Two benchmark configurations were run.

---

# Experiment 1 — Same model comparison

All agents use **Claude Sonnet 4**.

| Task | Baseline (Sonnet) | ZCA Naive (Sonnet) | ZCA Adaptive (Sonnet) |
|---|---|---|---|
| parser_bug (L1/O1) | FAIL — 10 steps, 71s, 159k tokens | PASS — 1 step, 8s, 2.2k tokens | PASS — 1 step, 8s, 2.5k tokens |
| range_check_bug (L2/O1) | FAIL — 10 steps, 82s, 1.2M tokens | PASS — 1 step, 5s, 1.8k tokens | PASS — 1 step, 7s, 2.2k tokens |
| slug_conflict_bug (L3/O2) | FAIL — 10 steps, 89s, 167k tokens | PASS — 1 step, 12s, 2.1k tokens | PASS — 2 steps, 14s, 4.4k tokens |
| config_lookup_bug (L2/O3) | FAIL — 10 steps, 73s, 242k tokens | FAIL — 5 steps, 42s, 9.9k tokens | PASS — 1 step, 7s, 2.2k tokens |

| Agent | Pass rate | Input tokens |
|------|-----------|--------------|
| Baseline | 0 / 4 | 1.7M |
| ZCA Naive | 3 / 4 | 11.8k |
| ZCA Adaptive | 4 / 4 | 9.1k |

### Observation

With the **same model**, execution architecture dramatically changes behavior.

The baseline agent has 10 edit-steps (read-only exploration is free and uncapped within each step), but Sonnet consistently explores without committing edits, exhausting its budget. The same baseline architecture passes 4/4 when given Opus (see Experiment 2), suggesting that stronger models cope better with open-ended exploration loops while weaker models benefit more from architectural guardrails.

The ZCA agents sidestep this entirely — they receive a pre-projected slice and edit immediately.

---

# Experiment 2 — Cross model comparison

Baseline uses **Claude Opus 4**.  
ZCA agents use **Claude Haiku 4.5**.

| Task | Baseline (Opus 4) | ZCA Naive (Haiku 4.5) | ZCA Adaptive (Haiku 4.5) |
|---|---|---|---|
| parser_bug (L1/O1) | PASS — 8 steps, 103s, 164k tokens | PASS — 1 step, 5s, 2.4k tokens | PASS — 1 step, 5s, 2.8k tokens |
| range_check_bug (L2/O1) | PASS — 4 steps, 38s, 34k tokens | PASS — 1 step, 4s, 2.0k tokens | PASS — 1 step, 4s, 2.4k tokens |
| slug_conflict_bug (L3/O2) | PASS — 6 steps, 51s, 45k tokens | PASS — 2 steps, 11s, 4.9k tokens | PASS — 2 steps, 9s, 4.9k tokens |
| config_lookup_bug (L2/O3) | PASS — 5 steps, 40s, 34k tokens | FAIL — 5 steps, 27s, 13.7k tokens | PASS — 1 step, 4s, 2.4k tokens |

| Agent | Pass rate | Input tokens |
|------|-----------|--------------|
| Baseline Opus | 4 / 4 | 270k |
| ZCA Naive Haiku | 3 / 4 | 17k |
| ZCA Adaptive Haiku | 4 / 4 | 10k |

### Observation

The adaptive ZCA agent running on Haiku (the cheapest Anthropic model) matches the success rate of the baseline running on Opus (the most expensive), while using **27x fewer input tokens**. This suggests that slice-isolated execution can make smaller models viable for tasks that would otherwise require a frontier model.

---

# Key findings

### Execution architecture matters

With the same model (Sonnet), the baseline agent fails all tasks while ZCA Adaptive solves all tasks.

This suggests that agent runtime design can strongly affect performance.

---

### Slice projection determines the ceiling

The naive ZCA agent fails when the projected slice omits relevant files.

The adaptive projector resolves this by including additional candidate files.

---

### Context size can be dramatically reduced

In the same-model experiment, the baseline consumed **1.7M input tokens** across 4 tasks while failing all of them. ZCA Adaptive consumed **9.1k tokens** and passed all four — a **187x reduction** with better outcomes.

---

# Limitations

This benchmark is intentionally small and designed as a **diagnostic experiment**, not a large-scale evaluation.

It does not attempt to compete with larger datasets such as SWE-bench.

Instead it isolates architectural tradeoffs between:

- context accumulation  
- slice projection  

Future work may explore how slice-isolated execution behaves on larger repositories.

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
```


---

# Repository structure

```text
experiments/tasks/            # benchmark task definitions
  parser_bug/
  range_check_bug/
  slug_conflict_bug/
  config_lookup_bug/

src/
  agents/baseline/            # long-context baseline agent
  agents/zca/                 # ZCA agent + naive/adaptive projectors
  model/                      # model client abstraction (Anthropic SDK)
  runtime/                    # sandbox execution and tool registry
  analysis/                   # result types and metrics
  scripts/                    # CLI entrypoints (runBenchmark, runBaseline, runZCA)

configs/
  benchmark.json              # same-model (Sonnet) config
  benchmark-cross-model.json  # cross-model (Opus vs Haiku) config

results/                      # benchmark output JSON files
```


---

# Future work

Possible directions include:

- expanding the benchmark with additional locality and observability levels  
- evaluating ZCA agents on larger repositories  
- improving slice projection heuristics  

---

# License

MIT