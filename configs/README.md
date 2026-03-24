# configs

Configuration files for agent runs and benchmark matrix.

## Files

| File | Purpose |
|---|---|
| `baseline.json` | Config for baseline agent (max steps, model provider) |
| `zca.json` | Config for ZCA agent with naive projector |
| `zca-adaptive.json` | Config for ZCA agent with adaptive projector |
| `benchmark.json` | Same-model (Sonnet) test benchmark: tasks × agents × model |
| `benchmark-cross-model.json` | Cross-model benchmark: Opus baseline vs Haiku ZCA agents |
| `benchmark-typecheck.json` | TypeScript compiler-driven benchmark (all 6 typecheck tasks) |
| `benchmark-typecheck-fast.json` | Typecheck benchmark subset (L2 tasks only, ZCA agents only) |
| `benchmark-with-swe-agent.json` | Test benchmark with mini-SWE-agent as external baseline |
