import { AnthropicModelClient } from "./AnthropicModelClient.js";
import { StubModelClient } from "./StubModelClient.js";
import type { ModelClient } from "./types.js";

export interface ModelConfig {
  provider: string;
  model: string;
  temperature: number;
}

export function createModelClient(config: ModelConfig): ModelClient {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicModelClient({
        model: config.model,
        temperature: config.temperature,
      });
    default:
      if (config.provider !== "stub") {
        console.warn(
          `Unknown provider "${config.provider}". Falling back to stub.`,
        );
      }
      return new StubModelClient();
  }
}

export function createModelFactory(config: ModelConfig): () => ModelClient {
  return () => createModelClient(config);
}
