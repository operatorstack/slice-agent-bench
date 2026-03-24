import { spawn } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Logger } from "../../runtime/execution/logger.js";
import { runTests } from "../../runtime/tools/runTests.js";
import { runTypeCheck } from "../../runtime/tools/runTypeCheck.js";
import type { SignalType } from "../zca/ZCAAgent.js";

const PROBLEM_STATEMENTS: Record<SignalType, string> = {
  test: [
    "There is a failing test in this repository.",
    "Fix the code so that the test suite passes.",
    "Do not make unrelated changes.",
  ].join("\n"),
  typecheck: [
    "There is a failing TypeScript compiler error in this repository.",
    "Fix the code so that `tsc --noEmit` passes.",
    "Do not make unrelated changes.",
  ].join("\n"),
};

export interface MiniSWEAgentConfig {
  taskName: string;
  taskPath: string;
  signal: SignalType;
  model: string;
  costLimit?: number;
  timeout?: number;
}

export interface MiniSWEAgentResult {
  success: boolean;
  steps: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface TrajectoryEntry {
  role?: string;
  content?: string;
  tool_calls?: unknown[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  actions?: unknown[];
}

export class MiniSWEAgentAdapter {
  private readonly config: MiniSWEAgentConfig;
  private readonly logger: Logger;

  constructor(config: MiniSWEAgentConfig) {
    this.config = config;
    this.logger = new Logger("mini-swe");
  }

  async run(): Promise<MiniSWEAgentResult> {
    const { taskPath, signal, model, taskName } = this.config;
    const costLimit = this.config.costLimit ?? 2.0;
    const timeout = this.config.timeout ?? 300_000;

    this.logger.info(`Task: ${taskName}`);
    this.logger.info(`Task path: ${taskPath}`);
    this.logger.info(`Model: ${model}`);
    this.logger.info(`Cost limit: $${costLimit}`);

    const trajectoryPath = join(taskPath, `.trajectory-${randomUUID()}.json`);
    const problemStatement = PROBLEM_STATEMENTS[signal];

    try {
      await this.invokeAgent(taskPath, problemStatement, model, costLimit, timeout, trajectoryPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Agent invocation failed: ${msg}`);
    }

    const { steps, inputTokens, outputTokens } = await this.parseTrajectory(trajectoryPath);

    const verifier = signal === "typecheck" ? runTypeCheck : runTests;
    const verification = await verifier({ taskPath });
    const success = verification.success;

    this.logger.info(`Verification: ${success ? "PASS" : "FAIL"}`);
    this.logger.info(`Steps: ${steps}, Tokens: ${inputTokens}in/${outputTokens}out`);

    try {
      await unlink(trajectoryPath);
    } catch {
      // best-effort cleanup
    }

    return {
      success,
      steps,
      totalInputTokens: inputTokens,
      totalOutputTokens: outputTokens,
    };
  }

  private invokeAgent(
    cwd: string,
    task: string,
    model: string,
    costLimit: number,
    timeout: number,
    trajectoryPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        "-y",
        "--exit-immediately",
        "-t", task,
        "-m", model,
        "-l", String(costLimit),
        "-o", trajectoryPath,
      ];

      this.logger.info(`Spawning: mini ${args.join(" ")}`);

      const proc = spawn("mini", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          MSWEA_CONFIGURED: "1",
        },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      const timer = setTimeout(() => {
        this.logger.warn(`Timeout after ${timeout}ms, killing process`);
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill("SIGKILL");
          }
        }, 5_000);
      }, timeout);

      proc.on("error", (err) => {
        clearTimeout(timer);
        if (err.message.includes("ENOENT")) {
          reject(new Error(
            "mini-swe-agent CLI not found. Install it with: pip install mini-swe-agent",
          ));
          return;
        }
        reject(err);
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 && stderr.trim()) {
          this.logger.error(`mini stderr:\n${stderr.trim()}`);
        } else if (stderr.trim()) {
          this.logger.verbose("mini stderr", stderr.trim());
        }
        if (stdout.trim()) {
          this.logger.verbose("mini stdout", stdout.trim());
        }
        this.logger.info(`mini exited with code ${code}`);
        resolve();
      });
    });
  }

  private async parseTrajectory(
    trajectoryPath: string,
  ): Promise<{ steps: number; inputTokens: number; outputTokens: number }> {
    try {
      const raw = await readFile(trajectoryPath, "utf-8");
      const data = JSON.parse(raw);
      this.logger.info(`Trajectory shape: ${describeShape(data)}`);
      if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj["messages"])) {
          const msgs = obj["messages"] as Record<string, unknown>[];
          const roles = msgs.map((m) => m["role"]).filter(Boolean);
          const withUsage = msgs.filter((m) => m["usage"]).length;
          const withExtra = msgs.filter((m) => m["extra"]).length;
          this.logger.info(
            `Messages: ${msgs.length} total, roles=[${[...new Set(roles)].join(",")}], ` +
            `${withUsage} with usage, ${withExtra} with extra`,
          );
          if (msgs.length > 0) {
            this.logger.info(`First message keys: [${Object.keys(msgs[0]).join(",")}]`);
            const lastAssistant = [...msgs].reverse().find((m) => m["role"] === "assistant");
            if (lastAssistant) {
              this.logger.info(`Last assistant keys: [${Object.keys(lastAssistant).join(",")}]`);
            }
          }
        }
        if (typeof obj["info"] === "object" && obj["info"] !== null) {
          this.logger.info(`Info keys: [${Object.keys(obj["info"] as object).join(",")}]`);
        }
      }
      return extractMetrics(data);
    } catch {
      this.logger.warn("Could not read trajectory file, returning zero metrics");
      return { steps: 0, inputTokens: 0, outputTokens: 0 };
    }
  }
}

function extractMetrics(
  trajectory: unknown,
): { steps: number; inputTokens: number; outputTokens: number } {
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  if (Array.isArray(trajectory)) {
    for (const entry of trajectory) {
      const e = entry as TrajectoryEntry;

      if (e.role === "assistant" || e.actions || e.tool_calls) {
        steps++;
      }

      if (e.usage) {
        inputTokens += e.usage.input_tokens ?? e.usage.prompt_tokens ?? 0;
        outputTokens += e.usage.output_tokens ?? e.usage.completion_tokens ?? 0;
      }
    }
  } else if (typeof trajectory === "object" && trajectory !== null) {
    const obj = trajectory as Record<string, unknown>;

    if (Array.isArray(obj["history"])) {
      for (const entry of obj["history"]) {
        const e = entry as TrajectoryEntry;
        if (e.role === "assistant" || e.actions || e.tool_calls) {
          steps++;
        }
        if (e.usage) {
          inputTokens += e.usage.input_tokens ?? e.usage.prompt_tokens ?? 0;
          outputTokens += e.usage.output_tokens ?? e.usage.completion_tokens ?? 0;
        }
      }
    }

    if (typeof obj["info"] === "object" && obj["info"] !== null) {
      const info = obj["info"] as Record<string, unknown>;
      if (typeof info["total_cost"] === "number" && steps === 0) {
        steps = 1;
      }
    }

    if (typeof obj["steps"] === "number") {
      steps = obj["steps"] as number;
    }
    if (typeof obj["input_tokens"] === "number") {
      inputTokens = obj["input_tokens"] as number;
    }
    if (typeof obj["output_tokens"] === "number") {
      outputTokens = obj["output_tokens"] as number;
    }
  }

  return { steps, inputTokens, outputTokens };
}

function describeShape(data: unknown): string {
  if (Array.isArray(data)) {
    const sample = data[0];
    const keys = sample && typeof sample === "object" ? Object.keys(sample as object).join(",") : "?";
    return `array[${data.length}] first-keys=[${keys}]`;
  }
  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data);
    return `object keys=[${keys.join(",")}]`;
  }
  return typeof data;
}

export function toLitellmModel(provider: string, model: string): string {
  return `${provider}/${model}`;
}
