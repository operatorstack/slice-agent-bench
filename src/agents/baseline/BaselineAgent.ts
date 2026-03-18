import type { ModelClient, Message } from "../../model/types.js";
import { createToolRegistry } from "../../runtime/tools/index.js";
import { resolveTaskPath } from "../../runtime/execution/taskPaths.js";
import { Logger } from "../../runtime/execution/logger.js";
import { runBaselineLoop } from "./baselineLoop.js";

export interface BaselineAgentConfig {
  taskName: string;
  maxSteps: number;
  model: ModelClient;
}

export interface BaselineRunResult {
  success: boolean;
  steps: number;
  history: Message[];
}

export class BaselineAgent {
  private readonly config: BaselineAgentConfig;
  private readonly logger: Logger;
  private readonly taskPath: string;

  constructor(config: BaselineAgentConfig) {
    this.config = config;
    this.taskPath = resolveTaskPath(config.taskName);
    this.logger = new Logger("baseline");
  }

  async run(): Promise<BaselineRunResult> {
    this.logger.info(`Task: ${this.config.taskName}`);
    this.logger.info(`Task path: ${this.taskPath}`);
    this.logger.info(`Max steps: ${this.config.maxSteps}`);

    const registry = createToolRegistry(this.taskPath);

    return runBaselineLoop({
      model: this.config.model,
      registry,
      maxSteps: this.config.maxSteps,
      taskPath: this.taskPath,
      logger: this.logger,
    });
  }
}
