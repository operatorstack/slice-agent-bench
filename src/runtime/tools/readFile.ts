import { readFile as fsReadFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ToolResult } from "./types.js";

export async function readFile(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const filePath = String(args["path"] ?? "");
  if (!filePath) {
    return { success: false, output: "Missing required argument: path" };
  }

  try {
    const content = await fsReadFile(resolve(filePath), "utf-8");
    return { success: true, output: content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: `Failed to read file: ${msg}` };
  }
}
