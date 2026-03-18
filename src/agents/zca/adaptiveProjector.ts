import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import type { ProjectedSlice, SliceFile } from "./projectFailureSlice.js";
import { inferSourceFile } from "./projectFailureSlice.js";

/**
 * Adaptive projector: bounded multi-file slice.
 *
 * Goes beyond the naive single-file projector by:
 *   1. Reading the primary file (same inference as naive)
 *   2. Extracting its local imports
 *   3. Running one bounded grep for a key symbol from the test failure
 *   4. Including up to `maxFiles` total files in the slice
 *
 * This is NOT a full search-based agent. The projector has a fixed budget:
 *   - 1 file read (primary)
 *   - 1 import scan
 *   - 1 grep search
 *   - up to maxFiles total reads
 */
export async function projectAdaptiveSlice(
  taskPath: string,
  testOutput: string,
  maxFiles = 3,
): Promise<ProjectedSlice> {
  const primaryRelative = inferSourceFile(testOutput);
  const primaryPath = resolve(join(taskPath, primaryRelative));
  const primarySource = await readFile(primaryPath, "utf-8");

  const candidateRelPaths = new Set<string>();
  candidateRelPaths.add(primaryRelative);

  const imports = extractLocalImports(primarySource);
  for (const imp of imports) {
    const rel = `src/${imp}.ts`;
    candidateRelPaths.add(rel);
  }

  const failingSymbol = extractFailingSymbol(testOutput);
  if (failingSymbol) {
    const searchHits = await grepTaskSrc(taskPath, failingSymbol);
    for (const hit of searchHits) {
      candidateRelPaths.add(hit);
    }
  }

  const selected = [...candidateRelPaths].slice(0, maxFiles);

  const files: SliceFile[] = [];
  for (const rel of selected) {
    const abs = resolve(join(taskPath, rel));
    try {
      const source = rel === primaryRelative
        ? primarySource
        : await readFile(abs, "utf-8");
      files.push({ filePath: abs, relativePath: rel, sourceCode: source });
    } catch {
      // file doesn't exist — skip
    }
  }

  return { testOutput, files };
}

function extractLocalImports(source: string): string[] {
  const imports: string[] = [];
  const re = /from\s+["']\.\/(\w+)(?:\.js)?["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Extracts a likely key symbol from the test failure output.
 *
 * Looks for quoted string values or function names in assertion errors.
 */
function extractFailingSymbol(testOutput: string): string | null {
  const quotedMatch = testOutput.match(
    /expected.*?["'](\w{4,})["']/i,
  );
  if (quotedMatch) {
    return quotedMatch[1];
  }

  const fnMatch = testOutput.match(/(\w+)\s*\(/);
  if (fnMatch && fnMatch[1].length > 3) {
    return fnMatch[1];
  }

  return null;
}

function grepTaskSrc(
  taskPath: string,
  pattern: string,
): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      "grep",
      ["-rl", "--include=*.ts", pattern, "src"],
      { cwd: taskPath, maxBuffer: 256 * 1024 },
      (error, stdout) => {
        if (!stdout) {
          resolve([]);
          return;
        }
        const files = stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .filter((f) => !f.endsWith(".test.ts"));
        resolve(files);
      },
    );
  });
}
