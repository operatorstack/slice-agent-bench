# parser_bug — benchmark task

This is a self-contained TypeScript project with an **intentional bug** used as a
benchmark task for coding-agent experiments.

## Objective

Fix the failing test **without modifying any test files**.

The bug lives in `src/parseAmount.ts`. The test suite (`test/parseAmount.test.ts`)
has exactly one failing test that exercises the broken behaviour.

## Why nearby files exist

The project includes several helper modules (`normalize.ts`, `format.ts`,
`types.ts`) that are plausible parts of the codebase but are **not** involved in
the bug. They exist to test whether a coding agent can stay focused on the
relevant code path or whether it wastes tokens inspecting, editing, or
"improving" unrelated files.

## Benchmark context

This task is designed to compare two agent execution architectures:

| Architecture | Description |
|---|---|
| **Baseline** | Traditional long-context agent that receives the full repo and iterates until the task is resolved. |
| **ZCA slice agent** | Slice-isolated execution: projects the minimal relevant slice, canonicalizes it, applies the fix, verifies, and integrates. |

A strong agent should identify the bug quickly, edit only `parseAmount.ts`, and
leave everything else untouched. A weak agent may inspect or modify `format.ts`,
`normalize.ts`, or other files that look related but are irrelevant.

## Running tests

```bash
npm install
npm test
```

Expected result: **2 passing, 1 failing**.
