import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ZCAAgent } from "../agents/zca/ZCAAgent.js";
import type { ProjectorMode } from "../agents/zca/ZCAAgent.js";
import { AnthropicModelClient } from "../model/AnthropicModelClient.js";
import { StubModelClient } from "../model/StubModelClient.js";
import type { ModelClient } from "../model/types.js";
import { Logger } from "../runtime/execution/logger.js";
import { createTaskSandbox } from "../runtime/execution/sandbox.js";

interface ZCAConfig {
  maxSteps: number;
  projector?: string;
  model: {
    provider: string;
    model: string;
    temperature: number;
  };
}

function parseConfig(raw: unknown): ZCAConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid config: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  const modelRaw = obj["model"];
  const modelSection =
    typeof modelRaw === "object" && modelRaw !== null
      ? (modelRaw as Record<string, unknown>)
      : {};

  return {
    maxSteps: Number(obj["maxSteps"] ?? 5),
    projector: typeof obj["projector"] === "string" ? obj["projector"] : undefined,
    model: {
      provider: String(modelSection["provider"] ?? "stub"),
      model: String(modelSection["model"] ?? "stub"),
      temperature: Number(modelSection["temperature"] ?? 0),
    },
  };
}

function createModelFactory(config: ZCAConfig): () => ModelClient {
  return () => {
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
  };
}

async function main(): Promise<void> {
  const logger = new Logger("run-zca");

  const taskName = process.argv[2];
  if (!taskName) {
    logger.error("Usage: tsx src/scripts/runZCA.ts <task-name> [config-path]");
    logger.info("Example: tsx src/scripts/runZCA.ts parser_bug");
    process.exit(1);
  }

  const configPath = process.argv[3] ?? "configs/zca.json";
  logger.info(`Loading config from ${configPath}`);

  const raw = await readFile(resolve(configPath), "utf-8");
  const config = parseConfig(JSON.parse(raw));
  const createModel = createModelFactory(config);

  const projector = (config.projector === "adaptive" ? "adaptive" : "naive") satisfies ProjectorMode;

  const sandbox = createTaskSandbox(taskName, `zca-${projector}`);
  logger.info(`Sandboxed task at: ${sandbox.workPath}`);

  try {
    const agent = new ZCAAgent({
      taskName,
      maxSteps: config.maxSteps,
      createModel,
      projector,
      taskPath: sandbox.workPath,
    });

    logger.info(`Starting ZCA agent on task: ${taskName}`);
    const result = await agent.run();

    console.log();
    logger.info(`Result: ${result.success ? "PASS" : "FAIL"}`);
    logger.info(`Steps: ${result.steps}`);
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
