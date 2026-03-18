import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BaselineAgent } from "../agents/baseline/BaselineAgent.js";
import { AnthropicModelClient } from "../model/AnthropicModelClient.js";
import { StubModelClient } from "../model/StubModelClient.js";
import type { ModelClient } from "../model/types.js";
import { Logger } from "../runtime/execution/logger.js";
import { createTaskSandbox } from "../runtime/execution/sandbox.js";

interface BaselineConfig {
  maxSteps: number;
  model: {
    provider: string;
    model: string;
    temperature: number;
  };
}

function parseConfig(raw: unknown): BaselineConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid config: expected an object");
  }
  const obj = raw as Record<string, unknown>;
  const modelSection =
    typeof obj["model"] === "object" && obj["model"] !== null
      ? (obj["model"] as Record<string, unknown>)
      : {};

  return {
    maxSteps: Number(obj["maxSteps"] ?? 10),
    model: {
      provider: String(modelSection["provider"] ?? "stub"),
      model: String(modelSection["model"] ?? "stub"),
      temperature: Number(modelSection["temperature"] ?? 0),
    },
  };
}

function createModelClient(config: BaselineConfig): ModelClient {
  switch (config.model.provider) {
    case "anthropic":
      return new AnthropicModelClient({
        model: config.model.model,
        temperature: config.model.temperature,
      });
    default:
      if (config.model.provider !== "stub") {
        console.warn(
          `Unknown provider "${config.model.provider}". Falling back to stub.`,
        );
      }
      return new StubModelClient();
  }
}

async function main(): Promise<void> {
  const logger = new Logger("run-baseline");

  const taskName = process.argv[2];
  if (!taskName) {
    logger.error("Usage: tsx src/scripts/runBaseline.ts <task-name>");
    logger.info("Example: tsx src/scripts/runBaseline.ts parser_bug");
    process.exit(1);
  }

  const configPath = process.argv[3] ?? "configs/baseline.json";
  logger.info(`Loading config from ${configPath}`);

  const raw = await readFile(resolve(configPath), "utf-8");
  const config = parseConfig(JSON.parse(raw));
  const model = createModelClient(config);

  const sandbox = createTaskSandbox(taskName, "baseline");
  logger.info(`Sandboxed task at: ${sandbox.workPath}`);

  try {
    const agent = new BaselineAgent({
      taskName,
      maxSteps: config.maxSteps,
      model,
      taskPath: sandbox.workPath,
    });

    logger.info(`Starting baseline agent on task: ${taskName}`);
    const result = await agent.run();

    console.log();
    logger.info(`Result: ${result.success ? "PASS" : "FAIL"}`);
    logger.info(`Steps: ${result.steps}`);
    logger.info(`History: ${result.history.length} messages`);
    logger.info(`Tokens: ${result.totalInputTokens} input / ${result.totalOutputTokens} output`);

    process.exit(result.success ? 0 : 1);
  } finally {
    sandbox.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
