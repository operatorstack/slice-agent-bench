import type { ModelClient, Message } from "../../model/types.js";
import { createToolRegistry } from "../../runtime/tools/index.js";
import { resolveTaskPath } from "../../runtime/execution/taskPaths.js";
import { Logger } from "../../runtime/execution/logger.js";
import { runBaselineLoop } from "./baselineLoop.js";
import { runTypeCheck } from "../../runtime/tools/runTypeCheck.js";
import type { SignalType } from "../zca/ZCAAgent.js";

const BASELINE_TYPECHECK_PROMPT = `You are a coding agent. Your task is to fix TypeScript compiler errors in a project.

Rules:
- Use the provided tools to inspect the repository, understand the code, and make targeted edits.
- After editing, the TypeScript compiler will be re-run automatically.
- Fix only what is needed to make the compiler pass.
- Do not refactor unrelated code or add unnecessary changes.
- Preserve existing behavior — only resolve the type error.

Available tools:
- readFile(path): Read a file's contents.
- searchRepo(query): Search the repository for a text pattern.
- editFile(path, content): Replace a file's entire content.
- runTypeCheck(): Re-run the TypeScript compiler.

Approach:
1. Read the compiler error output carefully.
2. Identify which source file and line has the error.
3. Read the relevant source file(s).
4. Determine the root cause.
5. Edit the source file to fix the type error.
6. Confirm via compiler re-run.

Be concise. Focus on the fix.`;

export interface BaselineAgentConfig {
  taskName: string;
  maxSteps: number;
  model: ModelClient;
  taskPath?: string;
  signal?: SignalType;
}

export interface BaselineRunResult {
  success: boolean;
  steps: number;
  history: Message[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

export class BaselineAgent {
  private readonly config: BaselineAgentConfig;
  private readonly logger: Logger;
  private readonly taskPath: string;

  constructor(config: BaselineAgentConfig) {
    this.config = config;
    this.taskPath = config.taskPath ?? resolveTaskPath(config.taskName);
    this.logger = new Logger("baseline");
  }

  async run(): Promise<BaselineRunResult> {
    this.logger.info(`Task: ${this.config.taskName}`);
    this.logger.info(`Task path: ${this.taskPath}`);
    this.logger.info(`Max steps: ${this.config.maxSteps}`);

    const signal = this.config.signal ?? "test";
    const isTypecheck = signal === "typecheck";

    const registry = createToolRegistry(this.taskPath, signal);

    return runBaselineLoop({
      model: this.config.model,
      registry,
      maxSteps: this.config.maxSteps,
      taskPath: this.taskPath,
      logger: this.logger,
      ...(isTypecheck && {
        verify: runTypeCheck,
        systemPrompt: BASELINE_TYPECHECK_PROMPT,
        initialFailureMessage: (output: string) =>
          [
            "The TypeScript compiler reports errors. Here is the output:",
            "",
            "```",
            output,
            "```",
            "",
            "Fix the type errors. Be surgical — only change what is needed.",
          ].join("\n"),
        retryFailureMessage: (output: string) =>
          [
            "Compiler still has errors:",
            "",
            "```",
            output,
            "```",
            "",
            "Continue fixing.",
          ].join("\n"),
      }),
    });
  }
}
