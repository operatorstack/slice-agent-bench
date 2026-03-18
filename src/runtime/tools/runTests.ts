import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolResult } from "./types.js";

const execAsync = promisify(exec);

export async function runTests(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskPath = String(args["taskPath"] ?? "");
  if (!taskPath) {
    return { success: false, output: "Missing required argument: taskPath" };
  }

  try {
    const { stdout, stderr } = await execAsync("npm test", {
      cwd: taskPath,
      timeout: 30_000,
      maxBuffer: 512 * 1024,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { success: true, output };
  } catch (error: unknown) {
    if (isExecError(error)) {
      const output = [error.stdout, error.stderr]
        .filter(Boolean)
        .join("\n")
        .trim();
      return { success: false, output };
    }
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, output: `Test execution failed: ${msg}` };
  }
}

function isExecError(
  err: unknown,
): err is Error & { stdout: string; stderr: string } {
  return err instanceof Error && "stdout" in err;
}
