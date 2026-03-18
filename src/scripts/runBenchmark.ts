import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BaselineAgent } from "../agents/baseline/BaselineAgent.js";
import { ZCAAgent } from "../agents/zca/ZCAAgent.js";
import type { ProjectorMode } from "../agents/zca/ZCAAgent.js";
import { createModelClient, createModelFactory } from "../model/factory.js";
import type { ModelConfig } from "../model/factory.js";
import { Logger } from "../runtime/execution/logger.js";
import type { BenchmarkResult, BenchmarkSummary } from "../analysis/metrics/types.js";
import { TASK_CLASSIFICATIONS } from "../analysis/metrics/types.js";

interface AgentSpec {
  name: string;
  type: "baseline" | "zca";
  projector?: ProjectorMode;
  maxSteps: number;
}

interface BenchmarkConfig {
  tasks: string[];
  agents: AgentSpec[];
  model: ModelConfig;
}

function parseConfig(raw: unknown): BenchmarkConfig {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid config: expected an object");
  }

  const obj = raw as Record<string, unknown>;

  const modelRaw = obj["model"];
  const modelSection =
    typeof modelRaw === "object" && modelRaw !== null
      ? (modelRaw as Record<string, unknown>)
      : {};

  const tasks = Array.isArray(obj["tasks"]) ? obj["tasks"].map(String) : [];
  const agentsRaw = Array.isArray(obj["agents"]) ? obj["agents"] : [];

  const agents: AgentSpec[] = agentsRaw.map((a) => {
    const spec = a as Record<string, unknown>;
    return {
      name: String(spec["name"] ?? "unknown"),
      type: String(spec["type"] ?? "baseline") as "baseline" | "zca",
      projector: typeof spec["projector"] === "string"
        ? (spec["projector"] as ProjectorMode)
        : undefined,
      maxSteps: Number(spec["maxSteps"] ?? 10),
    };
  });

  return {
    tasks,
    agents,
    model: {
      provider: String(modelSection["provider"] ?? "stub"),
      model: String(modelSection["model"] ?? "stub"),
      temperature: Number(modelSection["temperature"] ?? 0),
    },
  };
}

async function runOneAgent(
  taskName: string,
  agentSpec: AgentSpec,
  modelConfig: ModelConfig,
  logger: Logger,
): Promise<BenchmarkResult> {
  const startMs = Date.now();

  if (agentSpec.type === "baseline") {
    const model = createModelClient(modelConfig);
    const agent = new BaselineAgent({
      taskName,
      maxSteps: agentSpec.maxSteps,
      model,
    });
    const result = await agent.run();
    return {
      task: taskName,
      agent: agentSpec.name,
      success: result.success,
      steps: result.steps,
      durationMs: Date.now() - startMs,
    };
  }

  const factory = createModelFactory(modelConfig);
  const agent = new ZCAAgent({
    taskName,
    maxSteps: agentSpec.maxSteps,
    createModel: factory,
    projector: agentSpec.projector ?? "naive",
  });
  const result = await agent.run();
  return {
    task: taskName,
    agent: agentSpec.name,
    success: result.success,
    steps: result.steps,
    durationMs: Date.now() - startMs,
  };
}

function printMatrix(summary: BenchmarkSummary): void {
  const colWidth = 20;
  const taskColWidth = 22;

  const header = "Task".padEnd(taskColWidth) +
    summary.agents.map((a) => a.padEnd(colWidth)).join("");
  console.log();
  console.log("═".repeat(header.length));
  console.log("  BENCHMARK RESULTS");
  console.log("═".repeat(header.length));
  console.log();
  console.log(header);
  console.log("─".repeat(header.length));

  for (const task of summary.tasks) {
    const classification = TASK_CLASSIFICATIONS[task];
    const tag = classification
      ? ` (${classification.locality}/${classification.observability})`
      : "";
    let row = `${task}${tag}`.padEnd(taskColWidth);

    for (const agent of summary.agents) {
      const cell = summary.results.find(
        (r) => r.task === task && r.agent === agent,
      );
      if (cell) {
        const icon = cell.success ? "✓" : "✗";
        const stepStr = `${cell.steps}s`;
        const durStr = `${(cell.durationMs / 1000).toFixed(1)}s`;
        row += `${icon} ${stepStr} ${durStr}`.padEnd(colWidth);
      } else {
        row += "—".padEnd(colWidth);
      }
    }
    console.log(row);
  }

  console.log("─".repeat(header.length));

  const total = summary.agents.map((agent) => {
    const wins = summary.results.filter(
      (r) => r.agent === agent && r.success,
    ).length;
    return `${wins}/${summary.tasks.length}`.padEnd(colWidth);
  });
  console.log("Pass rate".padEnd(taskColWidth) + total.join(""));
  console.log("═".repeat(header.length));
  console.log();
}

async function main(): Promise<void> {
  const logger = new Logger("benchmark");

  const configPath = process.argv[2] ?? "configs/benchmark.json";
  logger.info(`Loading benchmark config from ${configPath}`);

  const raw = await readFile(resolve(configPath), "utf-8");
  const config = parseConfig(JSON.parse(raw));

  logger.info(`Tasks: ${config.tasks.join(", ")}`);
  logger.info(`Agents: ${config.agents.map((a) => a.name).join(", ")}`);
  logger.info(`Model: ${config.model.provider}/${config.model.model}`);

  const results: BenchmarkResult[] = [];

  for (const task of config.tasks) {
    for (const agentSpec of config.agents) {
      console.log();
      logger.info(`${"─".repeat(50)}`);
      logger.info(`Running: ${agentSpec.name} on ${task}`);
      logger.info(`${"─".repeat(50)}`);

      try {
        const result = await runOneAgent(task, agentSpec, config.model, logger);
        results.push(result);
        logger.info(
          `Done: ${result.success ? "PASS" : "FAIL"} in ${result.steps} steps (${(result.durationMs / 1000).toFixed(1)}s)`,
        );
      } catch (error) {
        logger.error(
          `Error running ${agentSpec.name} on ${task}: ${error}`,
        );
        results.push({
          task,
          agent: agentSpec.name,
          success: false,
          steps: 0,
          durationMs: 0,
        });
      }
    }
  }

  const summary: BenchmarkSummary = {
    results,
    matrix: [],
    tasks: config.tasks,
    agents: config.agents.map((a) => a.name),
  };

  printMatrix(summary);

  const jsonPath = resolve("results/benchmark-latest.json");
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir(resolve("results"), { recursive: true });
  await writeFile(jsonPath, JSON.stringify(summary, null, 2));
  logger.info(`Results saved to ${jsonPath}`);

  const allPassed = results.every((r) => r.success);
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
