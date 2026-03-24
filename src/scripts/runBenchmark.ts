import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { BaselineAgent } from "../agents/baseline/BaselineAgent.js";
import { ZCAAgent } from "../agents/zca/ZCAAgent.js";
import type { ProjectorMode, SignalType } from "../agents/zca/ZCAAgent.js";
import { MiniSWEAgentAdapter, toLitellmModel } from "../agents/sweAgent/MiniSWEAgentAdapter.js";
import { createModelClient, createModelFactory } from "../model/factory.js";
import type { ModelConfig } from "../model/factory.js";
import { Logger } from "../runtime/execution/logger.js";
import { createTaskSandbox } from "../runtime/execution/sandbox.js";
import type { BenchmarkResult, BenchmarkSummary } from "../analysis/metrics/types.js";
import { TASK_CLASSIFICATIONS } from "../analysis/metrics/types.js";

interface AgentSpec {
  name: string;
  type: "baseline" | "zca" | "swe";
  projector?: ProjectorMode;
  maxSteps: number;
  model?: ModelConfig;
  signal?: SignalType;
  costLimit?: number;
  timeout?: number;
}

interface BenchmarkConfig {
  tasks: string[];
  agents: AgentSpec[];
  model: ModelConfig;
  signal?: SignalType;
  tasksDir?: string;
}

interface Job {
  task: string;
  agentSpec: AgentSpec;
  index: number;
}

interface CLIOptions {
  configPath: string;
  tasks?: string[];
  agents?: string[];
  levels?: string[];
  heavyConcurrency: number;
  lightConcurrency: number;
}

function parseCLI(argv: string[]): CLIOptions {
  const args = argv.slice(2);
  let configPath = "configs/benchmark.json";
  let tasks: string[] | undefined;
  let agents: string[] | undefined;
  let levels: string[] | undefined;
  let heavyConcurrency = 1;
  let lightConcurrency = 1;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--tasks" && next) {
      tasks = next.split(",").map((s) => s.trim());
      i++;
    } else if (arg === "--agents" && next) {
      agents = next.split(",").map((s) => s.trim());
      i++;
    } else if (arg === "--levels" && next) {
      levels = next.split(",").map((s) => s.trim().toUpperCase());
      i++;
    } else if (arg === "--heavy-concurrency" && next) {
      heavyConcurrency = Math.max(1, Number(next));
      i++;
    } else if (arg === "--light-concurrency" && next) {
      lightConcurrency = Math.max(1, Number(next));
      i++;
    } else if (arg === "--concurrency" && next) {
      const n = Math.max(1, Number(next));
      heavyConcurrency = n;
      lightConcurrency = n;
      i++;
    } else if (!arg.startsWith("--")) {
      configPath = arg;
    }
  }

  return { configPath, tasks, agents, levels, heavyConcurrency, lightConcurrency };
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
    const agentModelRaw = spec["model"];
    let agentModel: ModelConfig | undefined;
    if (typeof agentModelRaw === "object" && agentModelRaw !== null) {
      const m = agentModelRaw as Record<string, unknown>;
      agentModel = {
        provider: String(m["provider"] ?? "stub"),
        model: String(m["model"] ?? "stub"),
        temperature: Number(m["temperature"] ?? 0),
      };
    }
    return {
      name: String(spec["name"] ?? "unknown"),
      type: String(spec["type"] ?? "baseline") as "baseline" | "zca" | "swe",
      projector: typeof spec["projector"] === "string"
        ? (spec["projector"] as ProjectorMode)
        : undefined,
      maxSteps: Number(spec["maxSteps"] ?? 10),
      model: agentModel,
      signal: typeof spec["signal"] === "string"
        ? (spec["signal"] as SignalType)
        : undefined,
      costLimit: typeof spec["costLimit"] === "number"
        ? spec["costLimit"]
        : undefined,
      timeout: typeof spec["timeout"] === "number"
        ? spec["timeout"]
        : undefined,
    };
  });

  const signal = typeof obj["signal"] === "string"
    ? (obj["signal"] as SignalType)
    : undefined;

  const tasksDir = typeof obj["tasksDir"] === "string"
    ? obj["tasksDir"]
    : undefined;

  return {
    tasks,
    agents,
    model: {
      provider: String(modelSection["provider"] ?? "stub"),
      model: String(modelSection["model"] ?? "stub"),
      temperature: Number(modelSection["temperature"] ?? 0),
    },
    signal,
    tasksDir,
  };
}

async function runOneAgent(
  taskName: string,
  agentSpec: AgentSpec,
  defaultModelConfig: ModelConfig,
  logger: Logger,
  globalSignal?: SignalType,
  tasksDir?: string,
): Promise<BenchmarkResult> {
  const modelConfig = agentSpec.model ?? defaultModelConfig;
  const signal = agentSpec.signal ?? globalSignal ?? "test";
  const sandbox = createTaskSandbox(taskName, agentSpec.name, tasksDir);
  logger.info(`Sandboxed task at: ${sandbox.workPath}`);
  logger.info(`Model: ${modelConfig.provider}/${modelConfig.model}`);
  if (signal !== "test") {
    logger.info(`Signal: ${signal}`);
  }

  const startMs = Date.now();

  try {
    if (agentSpec.type === "baseline") {
      const model = createModelClient(modelConfig);
      const agent = new BaselineAgent({
        taskName,
        maxSteps: agentSpec.maxSteps,
        model,
        taskPath: sandbox.workPath,
        signal,
      });
      const result = await agent.run();
      return {
        task: taskName,
        agent: agentSpec.name,
        success: result.success,
        steps: result.steps,
        durationMs: Date.now() - startMs,
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
      };
    }

    if (agentSpec.type === "swe") {
      const litellmModel = toLitellmModel(modelConfig.provider, modelConfig.model);
      const agent = new MiniSWEAgentAdapter({
        taskName,
        taskPath: sandbox.workPath,
        signal,
        model: litellmModel,
        costLimit: agentSpec.costLimit,
        timeout: agentSpec.timeout,
      });
      const result = await agent.run();
      return {
        task: taskName,
        agent: agentSpec.name,
        success: result.success,
        steps: result.steps,
        durationMs: Date.now() - startMs,
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
      };
    }

    const factory = createModelFactory(modelConfig);
    const agent = new ZCAAgent({
      taskName,
      maxSteps: agentSpec.maxSteps,
      createModel: factory,
      projector: agentSpec.projector ?? "naive",
      taskPath: sandbox.workPath,
      signal,
    });
    const result = await agent.run();
    return {
      task: taskName,
      agent: agentSpec.name,
      success: result.success,
      steps: result.steps,
      durationMs: Date.now() - startMs,
      inputTokens: result.totalInputTokens,
      outputTokens: result.totalOutputTokens,
    };
  } finally {
    sandbox.cleanup();
  }
}

async function runPool<T>(
  items: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await items[i]();
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker(),
    ),
  );
  return results;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}k`;
  }
  return String(n);
}

function printMatrix(summary: BenchmarkSummary): void {
  const colWidth = 28;
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
        const tokStr = `${formatTokens(cell.inputTokens + cell.outputTokens)}tok`;
        row += `${icon} ${stepStr} ${durStr} ${tokStr}`.padEnd(colWidth);
      } else {
        row += "—".padEnd(colWidth);
      }
    }
    console.log(row);
  }

  console.log("─".repeat(header.length));

  let totalRow = "Pass rate".padEnd(taskColWidth);
  for (const agent of summary.agents) {
    const wins = summary.results.filter(
      (r) => r.agent === agent && r.success,
    ).length;
    const total = summary.results.filter((r) => r.agent === agent).length;
    totalRow += `${wins}/${total}`.padEnd(colWidth);
  }
  console.log(totalRow);

  let tokenRow = "Total tokens".padEnd(taskColWidth);
  for (const agent of summary.agents) {
    const agentResults = summary.results.filter((r) => r.agent === agent);
    const totalIn = agentResults.reduce((s, r) => s + r.inputTokens, 0);
    const totalOut = agentResults.reduce((s, r) => s + r.outputTokens, 0);
    tokenRow += `${formatTokens(totalIn)}in/${formatTokens(totalOut)}out`.padEnd(colWidth);
  }
  console.log(tokenRow);

  console.log("═".repeat(header.length));
  console.log();
}

function buildJobs(config: BenchmarkConfig, cli: CLIOptions): Job[] {
  let { tasks } = config;
  let agents = config.agents;

  if (cli.tasks) {
    const allowed = new Set(cli.tasks);
    tasks = tasks.filter((t) => allowed.has(t));
  }

  if (cli.levels) {
    const allowed = new Set(cli.levels);
    tasks = tasks.filter((t) => {
      const cls = TASK_CLASSIFICATIONS[t];
      return cls && allowed.has(cls.locality);
    });
  }

  if (cli.agents) {
    const allowed = new Set(cli.agents);
    agents = agents.filter((a) => allowed.has(a.name));
  }

  const jobs: Job[] = [];
  let index = 0;
  for (const task of tasks) {
    for (const agentSpec of agents) {
      jobs.push({ task, agentSpec, index: index++ });
    }
  }
  return jobs;
}

async function main(): Promise<void> {
  const logger = new Logger("benchmark");
  const cli = parseCLI(process.argv);

  logger.info(`Loading benchmark config from ${cli.configPath}`);

  const raw = await readFile(resolve(cli.configPath), "utf-8");
  const config = parseConfig(JSON.parse(raw));

  const allJobs = buildJobs(config, cli);

  const filteredTasks = [...new Set(allJobs.map((j) => j.task))];
  const filteredAgents = [...new Set(allJobs.map((j) => j.agentSpec.name))];

  logger.info(`Tasks: ${filteredTasks.join(", ")}`);
  logger.info(`Agents: ${filteredAgents.join(", ")}`);
  logger.info(`Jobs: ${allJobs.length}`);
  logger.info(`Default model: ${config.model.provider}/${config.model.model}`);

  const isHeavy = (j: Job): boolean =>
    j.agentSpec.type === "baseline" || j.agentSpec.type === "swe";
  const heavyJobs = allJobs.filter(isHeavy);
  const lightJobs = allJobs.filter((j) => !isHeavy(j));

  if (heavyJobs.length > 0 && lightJobs.length > 0) {
    logger.info(
      `Weighted concurrency: heavy=${cli.heavyConcurrency} (${heavyJobs.length} jobs), ` +
      `light=${cli.lightConcurrency} (${lightJobs.length} jobs)`,
    );
  } else {
    const total = heavyJobs.length + lightJobs.length;
    const c = heavyJobs.length > 0 ? cli.heavyConcurrency : cli.lightConcurrency;
    logger.info(`Concurrency: ${c} (${total} jobs)`);
  }

  function makeRunner(job: Job): () => Promise<{ job: Job; result: BenchmarkResult }> {
    return async () => {
      const { task, agentSpec } = job;
      const tag = `${agentSpec.name}:${task}`;

      logger.info(`▶ Starting ${tag}`);
      const startWall = Date.now();

      try {
        const result = await runOneAgent(
          task, agentSpec, config.model, logger, config.signal, config.tasksDir,
        );
        const wallSec = ((Date.now() - startWall) / 1000).toFixed(1);
        logger.info(
          `✔ ${tag}: ${result.success ? "PASS" : "FAIL"} in ${result.steps} steps ` +
          `(${wallSec}s, ${formatTokens(result.inputTokens)}in/${formatTokens(result.outputTokens)}out)`,
        );
        return { job, result };
      } catch (error) {
        logger.error(`✘ ${tag}: ${error}`);
        return {
          job,
          result: {
            task,
            agent: agentSpec.name,
            success: false,
            steps: 0,
            durationMs: 0,
            inputTokens: 0,
            outputTokens: 0,
          },
        };
      }
    };
  }

  const heavyRunners = heavyJobs.map(makeRunner);
  const lightRunners = lightJobs.map(makeRunner);

  const [heavyResults, lightResults] = await Promise.all([
    runPool(heavyRunners, cli.heavyConcurrency),
    runPool(lightRunners, cli.lightConcurrency),
  ]);

  const allResults = [...heavyResults, ...lightResults]
    .sort((a, b) => a.job.index - b.job.index)
    .map((r) => r.result);

  const summary: BenchmarkSummary = {
    results: allResults,
    matrix: [],
    tasks: filteredTasks,
    agents: filteredAgents,
  };

  printMatrix(summary);

  const { mkdir, writeFile } = await import("node:fs/promises");
  const { basename } = await import("node:path");
  await mkdir(resolve("results"), { recursive: true });

  const configName = basename(cli.configPath, ".json");
  const namedPath = resolve(`results/${configName}.json`);
  await writeFile(namedPath, JSON.stringify(summary, null, 2));
  logger.info(`Results saved to ${namedPath}`);

  const allPassed = allResults.every((r) => r.success);
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
