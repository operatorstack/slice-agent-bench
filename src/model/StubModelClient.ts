import type { ModelClient, Message, ModelResponse } from "./types.js";
import type { ToolDefinition } from "../runtime/tools/types.js";
import { Logger } from "../runtime/execution/logger.js";

export class StubModelClient implements ModelClient {
  private readonly logger = new Logger("stub-model");

  async chat(
    messages: Message[],
    _tools: ToolDefinition[],
  ): Promise<ModelResponse> {
    const lastMessage = messages[messages.length - 1];
    this.logger.info(
      `Received ${messages.length} message(s), last role: ${lastMessage?.role ?? "none"}`,
    );
    this.logger.warn(
      "No real model configured. Replace StubModelClient with a real provider.",
    );

    return { content: "No model configured. Ending.", toolCalls: [] };
  }
}
