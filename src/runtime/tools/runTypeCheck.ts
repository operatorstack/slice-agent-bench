import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolResult } from "./types.js";

const execAsync = promisify(exec);

export interface TypeErrorAnchor {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}

const SUPPORTED_CODES = new Set(["TS2322", "TS2339", "TS2304"]);

const IGNORED_PATTERNS = [
  /node_modules\//,
  /\/dist\//,
  /\.d\.ts$/,
];

const TSC_ERROR_RE =
  /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

export function parseTscOutput(output: string): TypeErrorAnchor[] {
  const anchors: TypeErrorAnchor[] = [];
  for (const line of output.split("\n")) {
    const match = TSC_ERROR_RE.exec(line.trim());
    if (match) {
      anchors.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        code: match[4],
        message: match[5],
      });
    }
  }
  return anchors;
}

export function selectPrimaryAnchor(
  anchors: TypeErrorAnchor[],
): TypeErrorAnchor | null {
  const candidates = anchors
    .filter((a) => SUPPORTED_CODES.has(a.code))
    .filter((a) => !IGNORED_PATTERNS.some((p) => p.test(a.file)));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const fileCmp = a.file.localeCompare(b.file);
    if (fileCmp !== 0) {
      return fileCmp;
    }
    const lineCmp = a.line - b.line;
    if (lineCmp !== 0) {
      return lineCmp;
    }
    return a.code.localeCompare(b.code);
  });

  return candidates[0];
}

export async function runTypeCheck(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const taskPath = String(args["taskPath"] ?? "");
  if (!taskPath) {
    return { success: false, output: "Missing required argument: taskPath" };
  }

  try {
    const { stdout, stderr } = await execAsync("npx tsc --noEmit", {
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
    return { success: false, output: `TypeCheck execution failed: ${msg}` };
  }
}

function isExecError(
  err: unknown,
): err is Error & { stdout: string; stderr: string } {
  return err instanceof Error && "stdout" in err;
}
