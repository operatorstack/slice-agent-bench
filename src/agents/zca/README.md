# ZCA Agent

The Zero-Context Agent uses **slice-isolated execution** — each iteration
projects a minimal failure slice, canonicalizes it, and sends only that
context to the model.

## Projector modes

### Naive (`projector: "naive"`)

Maps the failing test file name to a single source file. Fast and
deterministic, but blind to cross-file dependencies and misaligned
test-to-source mappings.

Best on: L1/L2 tasks with O1 observability.

### Adaptive (`projector: "adaptive"`)

Extends the naive projector with a bounded exploration budget:

1. **Import scanning** — parses the primary file's local imports.
2. **Bounded grep** — one `grep -rl` search for a key symbol from the
   test failure output.
3. **Candidate selection** — includes up to 3 files total.

This keeps the agent slice-isolated (no conversational exploration)
while recovering coverage on multi-file and ambiguous-source tasks.

Best on: L2/L3 tasks, O2/O3 observability.

## Architecture

```
test failure
    │
    ▼
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌────────┐
│ Projector │ ──▶ │ Canonicalize │ ──▶ │ Model    │ ──▶ │ Verify │
│ (naive/   │     │              │     │ (editFile│     │ (tests)│
│  adaptive)│     │              │     │  only)   │     │        │
└──────────┘     └──────────────┘     └──────────┘     └────────┘
                                                            │
                                          loop if still failing
```
