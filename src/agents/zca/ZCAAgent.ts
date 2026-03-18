import type { ModelClient } from "../../model/types.js";
import { resolveTaskPath } from "../../runtime/execution/taskPaths.js";
import { Logger } from "../../runtime/execution/logger.js";
import { projectFailureSlice } from "./projectFailureSlice.js";
import { projectAdaptiveSlice } from "./adaptiveProjector.js";
import { runZCALoop } from "./zcaLoop.js";
import type { Projector, ZCARunResult } from "./zcaLoop.js";
import { runTypeCheck } from "../../runtime/tools/runTypeCheck.js";
import {
  parseTscOutput,
  selectPrimaryAnchor,
} from "../../runtime/tools/runTypeCheck.js";
export type { ZCARunResult } from "./zcaLoop.js";

export type ProjectorMode = "naive" | "adaptive";
export type SignalType = "test" | "typecheck";

const ZCA_TYPECHECK_PROMPT = `You are a focused code repair agent. You receive TypeScript compiler error output and the source file(s) that need fixing.

Your task:
1. Read the compiler error output.
2. Read the provided source code.
3. Determine the root cause of the type error.
4. Use editFile to write the complete corrected file(s).

Rules:
- Only fix the provided file(s).
- Do NOT search or explore other files — the provided context is complete.
- Write the ENTIRE corrected file contents via editFile — not a diff or snippet.
- Be surgical — change only what is necessary to resolve the type error.
- Do not refactor unrelated code or change behavior beyond fixing the type.
- If multiple files need changes, call editFile once per file.`;

export interface ZCAAgentConfig {
  taskName: string;
  maxSteps: number;
  createModel: () => ModelClient;
  projector?: ProjectorMode;
  taskPath?: string;
  verbose?: boolean;
  signal?: SignalType;
}

export class ZCAAgent {
  private readonly config: ZCAAgentConfig;
  private readonly logger: Logger;
  private readonly taskPath: string;
  private readonly project: Projector;

  constructor(config: ZCAAgentConfig) {
    this.config = config;
    this.taskPath = config.taskPath ?? resolveTaskPath(config.taskName);
    this.logger = new Logger("zca", { verbose: config.verbose });

    const mode = config.projector ?? "naive";
    const signal = config.signal ?? "test";
    this.project = this.buildProjector(mode, signal);
    this.logger.info(`Projector: ${mode}, Signal: ${signal}`);
  }

  async run(): Promise<ZCARunResult> {
    this.logger.info(`Task: ${this.config.taskName}`);
    this.logger.info(`Task path: ${this.taskPath}`);
    this.logger.info(`Max steps: ${this.config.maxSteps}`);

    const signal = this.config.signal ?? "test";
    const isTypecheck = signal === "typecheck";

    return runZCALoop({
      createModel: this.config.createModel,
      project: this.project,
      maxSteps: this.config.maxSteps,
      taskPath: this.taskPath,
      logger: this.logger,
      ...(isTypecheck && {
        verify: runTypeCheck,
        systemPrompt: ZCA_TYPECHECK_PROMPT,
        goal: "Fix the TypeScript compiler error by patching the source file(s).",
        failureLabel: "Compiler error output",
      }),
    });
  }

  private buildProjector(mode: ProjectorMode, signal: SignalType): Projector {
    const log = this.logger;

    if (signal === "typecheck") {
      return async (taskPath, failureOutput) => {
        const anchors = parseTscOutput(failureOutput);
        const primary = selectPrimaryAnchor(anchors);
        const entryFile = primary?.file ?? anchors[0]?.file;

        log.verbose(
          "Anchor selection",
          primary
            ? `${primary.file}:${primary.line} ${primary.code} — ${primary.message}`
            : anchors[0]
              ? `(no supported code — falling back to ${anchors[0].file}:${anchors[0].line} ${anchors[0].code})`
              : "(no parseable anchor in tsc output)",
        );

        return mode === "adaptive"
          ? projectAdaptiveSlice(taskPath, failureOutput, { logger: log, entryFile })
          : projectFailureSlice(taskPath, failureOutput, log, entryFile);
      };
    }

    return mode === "adaptive"
      ? (tp, fo) => projectAdaptiveSlice(tp, fo, { logger: log })
      : (tp, fo) => projectFailureSlice(tp, fo, log);
  }
}
