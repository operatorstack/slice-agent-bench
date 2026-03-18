import type { ToolDefinition } from "../runtime/tools/types.js";

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallID?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  tokenUsage?: TokenUsage;
}

export interface ModelClient {
  chat(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse>;
}
