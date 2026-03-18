import type { ModelClient, Message } from "../../model/types.js";
import type { ToolDefinition, ToolResult } from "../../runtime/tools/types.js";
import { Logger } from "../../runtime/execution/logger.js";
import { runTests } from "../../runtime/tools/runTests.js";
import { editFile } from "../../runtime/tools/editFile.js";
import { canonicalizeState } from "./canonicalizeState.js";
import { ZCA_SYSTEM_PROMPT, buildSliceUserMessage } from "./zcaPrompt.js";
import type { ProjectedSlice } from "./projectFailureSlice.js";

export interface ZCARunResult {
  success: boolean;
  steps: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const EDIT_FILE_TOOL: ToolDefinition = {
  name: "editFile",
  description:
    "Write new content to a file, replacing its current content entirely.",
  parameters: {
    path: {
      type: "string",
      description: "Absolute path to the file.",
    },
    content: {
      type: "string",
      description: "The full new content for the file.",
    },
  },
};

export type Projector = (
  taskPath: string,
  testOutput: string,
) => Promise<ProjectedSlice>;

type VerifyFn = (args: Record<string, unknown>) => Promise<ToolResult>;

interface LoopContext {
  createModel: () => ModelClient;
  project: Projector;
  maxSteps: number;
  taskPath: string;
  logger: Logger;
  verify?: VerifyFn;
  systemPrompt?: string;
  goal?: string;
  failureLabel?: string;
}

export async function runZCALoop(ctx: LoopContext): Promise<ZCARunResult> {
  const { createModel, project, maxSteps, taskPath, logger } = ctx;
  const verify = ctx.verify ?? ((args) => runTests(args));
  const systemPrompt = ctx.systemPrompt ?? ZCA_SYSTEM_PROMPT;
  const goal = ctx.goal ?? "Fix the failing test by patching the source file(s).";
  const failureLabel = ctx.failureLabel ?? "Failing test output";

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  logger.info("Running initial verification...");
  const initialResult = await verify({ taskPath });

  if (initialResult.success) {
    logger.success("All tests already pass. Nothing to do.");
    return { success: true, steps: 0, totalInputTokens, totalOutputTokens };
  }

  logger.warn("Tests failing. Starting ZCA loop.");
  logger.verbose("Initial test output", initialResult.output);

  let latestTestOutput = initialResult.output;
  let lastStep = 0;

  for (let step = 1; step <= maxSteps; step++) {
    lastStep = step;
    logger.step(step, maxSteps);

    logger.info("Projecting failure slice...");
    const slice = await project(taskPath, latestTestOutput);
    const fileNames = slice.files.map((f) => f.relativePath).join(", ");
    logger.info(`Slice files: ${fileNames} (${slice.files.length} file(s))`);

    for (const file of slice.files) {
      logger.verbose(
        `Projected file: ${file.relativePath} (${file.sourceCode.length} chars)`,
        file.sourceCode,
      );
    }

    const state = canonicalizeState(slice, goal, failureLabel);
    const userMessage = buildSliceUserMessage(state);
    logger.verbose("System prompt", systemPrompt);
    logger.verbose(
      `Canonicalized user message (${userMessage.length} chars)`,
      userMessage,
    );

    const model = createModel();
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    logger.info("Sending slice to model...");
    const response = await model.chat(messages, [EDIT_FILE_TOOL]);

    if (response.tokenUsage) {
      totalInputTokens += response.tokenUsage.inputTokens;
      totalOutputTokens += response.tokenUsage.outputTokens;
      logger.verbose(
        "Token usage this step",
        `Input: ${response.tokenUsage.inputTokens}  Output: ${response.tokenUsage.outputTokens}`,
      );
    }

    if (response.content) {
      logger.verbose("Model reasoning", response.content);
    }

    logger.verbose(
      `Tool calls (${response.toolCalls.length})`,
      response.toolCalls
        .map((tc) => `${tc.name}(${JSON.stringify(tc.arguments, null, 2)})`)
        .join("\n\n"),
    );

    let applied = false;

    for (const toolCall of response.toolCalls) {
      if (toolCall.name !== "editFile") {
        logger.warn(`Ignoring unexpected tool call: ${toolCall.name}`);
        continue;
      }
      logger.tool("editFile", { path: toolCall.arguments["path"] });
      logger.verbose(
        `Edit content → ${toolCall.arguments["path"]}`,
        String(toolCall.arguments["content"] ?? ""),
      );
      await editFile(toolCall.arguments);
      applied = true;
    }

    if (!applied) {
      logger.warn("Model did not call editFile. Ending loop.");
      break;
    }

    logger.info("Re-running verification...");
    const testResult = await verify({ taskPath });
    logger.verbose("Post-edit verification output", testResult.output);

    if (testResult.success) {
      logger.success(`All tests pass after ${step} step(s).`);
      return { success: true, steps: step, totalInputTokens, totalOutputTokens };
    }

    latestTestOutput = testResult.output;
    logger.warn("Tests still failing. Will re-project slice.");
  }

  logger.error(
    `Stopped after ${lastStep} step(s) without fixing all tests.`,
  );
  return { success: false, steps: lastStep, totalInputTokens, totalOutputTokens };
}
