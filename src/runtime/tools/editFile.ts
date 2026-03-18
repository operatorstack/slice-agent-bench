import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolResult } from "./types.js";

export async function editFile(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const filePath = String(args["path"] ?? "");
  const content = String(args["content"] ?? "");

  if (!filePath) {
    return { success: false, output: "Missing required argument: path" };
  }

  try {
    const resolved = resolve(filePath);
    await writeFile(resolved, content, "utf-8");
    return { success: true, output: `File written: ${resolved}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: `Failed to write file: ${msg}` };
  }
}
