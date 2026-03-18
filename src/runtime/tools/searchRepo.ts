import { execFile, type ExecFileException } from "node:child_process";
import type { ToolResult } from "./types.js";

export function createSearchRepo(taskPath: string) {
  return function searchRepo(
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const query = String(args["query"] ?? "");
    if (!query) {
      return Promise.resolve({
        success: false,
        output: "Missing required argument: query",
      });
    }

    return new Promise<ToolResult>((resolve) => {
      execFile(
        "grep",
        ["-rn", "--include=*.ts", query, "."],
        { cwd: taskPath, maxBuffer: 512 * 1024 },
        (error: ExecFileException | null, stdout: string, stderr: string) => {
          if (!error) {
            resolve({ success: true, output: stdout });
            return;
          }
          if (stdout === "" && stderr === "") {
            resolve({ success: true, output: "No matches found." });
            return;
          }
          resolve({
            success: false,
            output: `Search failed: ${stderr || error.message}`,
          });
        },
      );
    });
  };
}
