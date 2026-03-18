import type { ModelClient } from "../../model/types.js";
import { resolveTaskPath } from "../../runtime/execution/taskPaths.js";
import { Logger } from "../../runtime/execution/logger.js";
import { projectFailureSlice } from "./projectFailureSlice.js";
import { projectAdaptiveSlice } from "./adaptiveProjector.js";
import { runZCALoop } from "./zcaLoop.js";
import type { Projector } from "./zcaLoop.js";

export type ProjectorMode = "naive" | "adaptive";

export interface ZCAAgentConfig {
  taskName: string;
  maxSteps: number;
  createModel: () => ModelClient;
  projector?: ProjectorMode;
}

export interface ZCARunResult {
  success: boolean;
  steps: number;
}

export class ZCAAgent {
  private readonly config: ZCAAgentConfig;
  private readonly logger: Logger;
  private readonly taskPath: string;
  private readonly project: Projector;

  constructor(config: ZCAAgentConfig) {
    this.config = config;
    this.taskPath = resolveTaskPath(config.taskName);
    this.logger = new Logger("zca");

    const mode = config.projector ?? "naive";
    this.project =
      mode === "adaptive" ? projectAdaptiveSlice : projectFailureSlice;
    this.logger.info(`Projector: ${mode}`);
  }

  async run(): Promise<ZCARunResult> {
    this.logger.info(`Task: ${this.config.taskName}`);
    this.logger.info(`Task path: ${this.taskPath}`);
    this.logger.info(`Max steps: ${this.config.maxSteps}`);

    return runZCALoop({
      createModel: this.config.createModel,
      project: this.project,
      maxSteps: this.config.maxSteps,
      taskPath: this.taskPath,
      logger: this.logger,
    });
  }
}
