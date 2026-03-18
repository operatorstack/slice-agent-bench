# src/agents/baseline

Baseline coding agent — the **control condition** in the benchmark.

This agent follows a traditional long-context agent loop:

1. Run the task's test suite and observe failures.
2. Send the full conversation history (system prompt + test output + prior tool results) to the model.
3. Execute any tool calls the model requests (read files, search, edit, re-run tests).
4. Append all results to the growing history.
5. Automatically re-run tests after each round of tool use.
6. Stop when tests pass or the step limit is reached.

## Files

| File | Purpose |
|---|---|
| `BaselineAgent.ts` | Agent class — owns config, task path, and delegates to the loop |
| `baselineLoop.ts` | Core interaction loop |
| `baselinePrompt.ts` | System prompt sent to the model |

## Shared layers

The baseline agent reuses `src/runtime/tools/` and `src/runtime/execution/` so
that the later ZCA agent can share the same tooling and execution infrastructure.
