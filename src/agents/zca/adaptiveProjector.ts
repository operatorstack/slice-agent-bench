import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import type { ProjectedSlice, SliceFile } from "./projectFailureSlice.js";
import { inferSourceFile } from "./projectFailureSlice.js";
import type { Logger } from "../../runtime/execution/logger.js";

export interface AdaptiveProjectorOptions {
  maxFiles?: number;
  logger?: Logger;
  entryFile?: string;
}

export async function projectAdaptiveSlice(
  taskPath: string,
  failureOutput: string,
  options?: AdaptiveProjectorOptions,
): Promise<ProjectedSlice> {
  const maxFiles = options?.maxFiles ?? 3;
  const logger = options?.logger;

  const primaryRelative = options?.entryFile ?? inferSourceFile(failureOutput);
  logger?.verbose("Adaptive projector: primary file", primaryRelative);
  const primaryPath = resolve(join(taskPath, primaryRelative));

  if (!existsSync(primaryPath)) {
    throw new Error(
      `Projector entry file not found: ${primaryRelative} (resolved: ${primaryPath}). ` +
      `This usually means the failure output could not be mapped to a source file.`,
    );
  }

  const primarySource = await readFile(primaryPath, "utf-8");

  const candidateRelPaths = new Set<string>();
  candidateRelPaths.add(primaryRelative);

  const imports = extractLocalImports(primarySource);
  logger?.verbose(
    `Import scan (${imports.length} local imports)`,
    imports.length > 0 ? imports.map((i) => `  → src/${i}.ts`).join("\n") : "(none)",
  );
  for (const imp of imports) {
    const rel = `src/${imp}.ts`;
    candidateRelPaths.add(rel);
  }

  const failingSymbol = extractFailingSymbol(failureOutput);
  logger?.verbose("Extracted failing symbol", failingSymbol ?? "(none found)");
  if (failingSymbol) {
    const searchHits = await grepTaskSrc(taskPath, failingSymbol);
    logger?.verbose(
      `Grep for "${failingSymbol}" (${searchHits.length} hits)`,
      searchHits.length > 0 ? searchHits.map((h) => `  → ${h}`).join("\n") : "(no matches)",
    );
    for (const hit of searchHits) {
      candidateRelPaths.add(hit);
    }
  }

  const selected = [...candidateRelPaths].slice(0, maxFiles);
  logger?.verbose(
    `Final candidate set (${selected.length}/${candidateRelPaths.size} capped at ${maxFiles})`,
    selected.join("\n"),
  );

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

  return { testOutput: failureOutput, files };
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
