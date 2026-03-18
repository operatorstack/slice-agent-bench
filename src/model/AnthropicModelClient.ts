import Anthropic from "@anthropic-ai/sdk";
import type { ModelClient, Message, ModelResponse, ToolCall } from "./types.js";
import type { ToolDefinition } from "../runtime/tools/types.js";
import { Logger } from "../runtime/execution/logger.js";

export interface AnthropicClientConfig {
  model: string;
  temperature: number;
}

/**
 * Maintains its own native Anthropic message history so that assistant messages
 * include full tool_use content blocks, which the Anthropic API requires for
 * valid multi-turn tool-calling conversations. The baseline loop only stores
 * the text portion of assistant messages in its generic history — the native
 * history kept here fills that gap.
 */
export class AnthropicModelClient implements ModelClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly temperature: number;
  private readonly logger = new Logger("anthropic");

  private nativeHistory: Anthropic.MessageParam[] = [];
  private processedCount = 0;
  private systemPrompt: string | undefined;

  constructor(config: AnthropicClientConfig) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY environment variable is required",
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = config.model;
    this.temperature = config.temperature;
  }

  async chat(
    messages: Message[],
    tools: ToolDefinition[],
  ): Promise<ModelResponse> {
    if (this.processedCount === 0) {
      const systemMsg = messages.find((m) => m.role === "system");
      this.systemPrompt = systemMsg?.content;
    }

    const newMessages = messages.slice(this.processedCount);
    this.processedCount = messages.length;
    this.appendNewMessages(newMessages);

    const anthropicTools = tools.map(toAnthropicTool);

    this.logger.info(
      `Requesting (model: ${this.model}, turns: ${this.nativeHistory.length})`,
    );

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: this.temperature,
        system: this.systemPrompt,
        messages: this.nativeHistory,
        tools: anthropicTools,
      });

      this.nativeHistory.push({
        role: "assistant",
        content: response.content,
      });

      this.logger.info(
        `Response: stop=${response.stop_reason} ` +
          `tokens=${response.usage.input_tokens}in/${response.usage.output_tokens}out`,
      );

      return parseContentBlocks(response.content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`API call failed: ${msg}`);
      throw error;
    }
  }

  /**
   * Converts new internal messages into a single Anthropic user turn.
   *
   * Assistant messages are skipped because the native history already contains
   * the full assistant response (with tool_use blocks). Tool-role messages
   * become tool_result blocks, and user-role messages become text blocks —
   * all merged into one user message so the alternating user/assistant
   * structure required by Anthropic is preserved.
   */
  private appendNewMessages(messages: Message[]): void {
    const blocks: Array<
      Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam
    > = [];

    for (const msg of messages) {
      if (msg.role === "system" || msg.role === "assistant") {
        continue;
      }
      if (msg.role === "tool" && msg.toolCallID) {
        blocks.push({
          type: "tool_result",
          tool_use_id: msg.toolCallID,
          content: msg.content,
        });
      }
      if (msg.role === "user") {
        blocks.push({ type: "text", text: msg.content });
      }
    }

    if (blocks.length > 0) {
      this.nativeHistory.push({ role: "user", content: blocks });
    }
  }
}

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  const properties: Record<
    string,
    { type: string; description: string }
  > = {};
  const required: string[] = [];

  for (const [name, schema] of Object.entries(tool.parameters)) {
    properties[name] = {
      type: schema.type,
      description: schema.description,
    };
    required.push(name);
  }

  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties,
      required,
    },
  };
}

function parseContentBlocks(
  blocks: Anthropic.ContentBlock[],
): ModelResponse {
  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      textParts.push(block.text);
    }
    if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: toRecord(block.input),
      });
    }
  }

  return {
    content: textParts.join("\n"),
    toolCalls,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
