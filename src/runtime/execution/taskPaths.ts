import { resolve } from "node:path";
import { existsSync } from "node:fs";

export function resolveTaskPath(taskName: string): string {
  const taskPath = resolve(process.cwd(), "experiments/tasks", taskName);

  if (!existsSync(taskPath)) {
    throw new Error(`Task directory not found: ${taskPath}`);
  }

  return taskPath;
}

export function getTasksRoot(): string {
  return resolve(process.cwd(), "experiments/tasks");
}
