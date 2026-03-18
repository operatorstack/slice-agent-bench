import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { resolveTaskPath } from "./taskPaths.js";

const BENCH_RUNS_DIR = resolve(".bench-runs");

export interface SandboxedTask {
  originalPath: string;
  workPath: string;
  cleanup: () => void;
}

export function createTaskSandbox(
  taskName: string,
  runLabel: string,
): SandboxedTask {
  const originalPath = resolveTaskPath(taskName);
  const runID = Date.now();
  const dirName = `${runID}-${taskName}-${runLabel}`;
  const workPath = join(BENCH_RUNS_DIR, dirName);

  mkdirSync(workPath, { recursive: true });
  cpSync(originalPath, workPath, { recursive: true });

  return {
    originalPath,
    workPath,
    cleanup: () => {
      try {
        rmSync(workPath, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    },
  };
}
