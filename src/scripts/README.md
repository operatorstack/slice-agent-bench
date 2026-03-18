# src/scripts

CLI entrypoints for running benchmark agents.

## Scripts

| Script | Usage |
|---|---|
| `runBaseline.ts` | `npm run baseline -- <task-name> [config-path]` |
| `runZCA.ts` | `npm run zca -- <task-name> [config-path]` |
| `runBenchmark.ts` | `npm run benchmark -- [config-path]` |

## Examples

Run a single agent against a single task:

```bash
npm run baseline -- parser_bug
npm run zca -- range_check_bug configs/zca-adaptive.json
```

Run the full benchmark matrix:

```bash
npm run benchmark
npm run benchmark -- configs/benchmark.json
```
