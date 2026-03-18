# src/model

Model client abstraction shared by all agent architectures.

## Files

| File | Purpose |
|---|---|
| `types.ts` | `ModelClient` interface, `Message`, `ToolCall`, and `ModelResponse` types |
| `AnthropicModelClient.ts` | Production client using the Anthropic SDK with tool-calling support |
| `StubModelClient.ts` | No-op implementation that returns empty responses (for testing the harness) |

## Configuration

Set `"provider": "anthropic"` in a config file under `configs/` and ensure
the `ANTHROPIC_API_KEY` environment variable is set. The `createModelClient`
factory in `src/scripts/runBaseline.ts` routes to the correct implementation.

## Adding another provider

Implement the `ModelClient` interface and add a new case to the
`createModelClient` switch in `src/scripts/runBaseline.ts`.
