# src/runtime/tools

Shared tool implementations used by all agent architectures.

These tools are intentionally simple and generic so that both the baseline agent
and the future ZCA agent use exactly the same underlying capabilities.

## Tools

| Tool | Description |
|---|---|
| `readFile` | Read a file's contents by path |
| `searchRepo` | Grep the task repo for a text pattern |
| `editFile` | Overwrite a file with new content |
| `runTests` | Run `npm test` in the task directory |

## Registry

`index.ts` exports `createToolRegistry(taskPath)` which returns:
- `handlers` — a `Map<string, ToolHandler>` for dispatching tool calls
- `definitions` — an array of `ToolDefinition` objects to pass to the model
