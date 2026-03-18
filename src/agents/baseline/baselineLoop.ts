import type { ModelClient, Message } from "../../model/types.js";
import type { ToolRegistry } from "../../runtime/tools/index.js";
import { Logger } from "../../runtime/execution/logger.js";
import { runTests } from "../../runtime/tools/runTests.js";
import type { BaselineRunResult } from "./BaselineAgent.js";
import { BASELINE_SYSTEM_PROMPT } from "./baselinePrompt.js";

interface LoopContext {
  model: ModelClient;
  registry: ToolRegistry;
  maxSteps: number;
  taskPath: string;
  logger: Logger;
}

export async function runBaselineLoop(
  ctx: LoopContext,
): Promise<BaselineRunResult> {
  const { model, registry, maxSteps, taskPath, logger } = ctx;

  const history: Message[] = [
    { role: "system", content: BASELINE_SYSTEM_PROMPT },
  ];

  logger.info("Running initial test suite...");
  const initialResult = await runTests({ taskPath });

  if (initialResult.success) {
    logger.success("All tests already pass. Nothing to do.");
    return { success: true, steps: 0, history };
  }

  logger.warn("Tests failing. Starting agent loop.");

  history.push({
    role: "user",
    content: [
      "The test suite is failing. Here is the output:",
      "",
      "```",
      initialResult.output,
      "```",
      "",
      "Fix the failing tests. Do not modify test files.",
    ].join("\n"),
  });

  let lastStep = 0;

  for (let step = 1; step <= maxSteps; step++) {
    lastStep = step;
    logger.step(step, maxSteps);

    const response = await model.chat(history, registry.definitions);
    history.push({ role: "assistant", content: response.content });

    if (response.toolCalls.length === 0) {
      logger.info("Model produced no tool calls. Ending loop.");
      break;
    }

    for (const toolCall of response.toolCalls) {
      const handler = registry.handlers.get(toolCall.name);

      if (!handler) {
        const msg = `Unknown tool: ${toolCall.name}`;
        logger.warn(msg);
        history.push({
          role: "tool",
          content: msg,
          toolCallID: toolCall.id,
          name: toolCall.name,
        });
        continue;
      }

      logger.tool(toolCall.name, toolCall.arguments);
      const result = await handler(toolCall.arguments);

      history.push({
        role: "tool",
        content: result.output,
        toolCallID: toolCall.id,
        name: toolCall.name,
      });
    }

    logger.info("Re-running tests...");
    const testResult = await runTests({ taskPath });

    if (testResult.success) {
      logger.success(`All tests pass after ${step} step(s).`);
      return { success: true, steps: step, history };
    }

    history.push({
      role: "user",
      content: [
        "Tests still failing:",
        "",
        "```",
        testResult.output,
        "```",
        "",
        "Continue fixing.",
      ].join("\n"),
    });
  }

  logger.error(
    `Stopped after ${lastStep} step(s) without fixing all tests.`,
  );
  return { success: false, steps: lastStep, history };
}
