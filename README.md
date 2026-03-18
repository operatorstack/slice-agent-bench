# slice-agent-bench

A minimal benchmark for comparing two coding agent execution architectures:

1. **Baseline coding agent** — a traditional long-context agent loop that receives the full repository context and iterates until the task is resolved.
2. **ZCA slice agent** — slice-isolated execution following the pipeline: **projection → canonicalization → operation → verification → integration**.

## Purpose

This repository provides a controlled environment to measure how each architecture performs on identical bug-fix and feature tasks across dimensions such as accuracy, token efficiency, latency, and context utilisation.

## Repository layout

```
slice-agent-bench/
├── experiments/       # Task definitions and fixtures
│   └── tasks/
├── agents/            # Agent implementations
│   ├── baseline/      # Traditional long-context agent
│   └── zca/           # Slice-based execution agent
├── runtime/           # Shared execution runtime
│   ├── tools/         # Tool abstractions (file I/O, linting, testing)
│   └── execution/     # Sandboxed execution harness
├── analysis/          # Post-run analysis
│   ├── metrics/       # Metric computation scripts
│   └── reports/       # Generated reports and visualisations
├── results/           # Raw run outputs (git-ignored)
├── scripts/           # Helper scripts (run benchmarks, collect results)
├── configs/           # Configuration files for agents and runtime
└── .gitignore
```

## Status

**Scaffolding only** — no implementation code has been written yet.
