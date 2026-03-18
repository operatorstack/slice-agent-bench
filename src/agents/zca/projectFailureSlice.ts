import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Logger } from "../../runtime/execution/logger.js";

export interface SliceFile {
  filePath: string;
  relativePath: string;
  sourceCode: string;
}

export interface ProjectedSlice {
  testOutput: string;
  files: SliceFile[];
}

export async function projectFailureSlice(
  taskPath: string,
  failureOutput: string,
  logger?: Logger,
  entryFile?: string,
): Promise<ProjectedSlice> {
  const relativePath = entryFile ?? inferSourceFile(failureOutput);
  logger?.verbose("Naive projector: entry file", relativePath);
  const filePath = resolve(join(taskPath, relativePath));

  if (!existsSync(filePath)) {
    throw new Error(
      `Projector entry file not found: ${relativePath} (resolved: ${filePath}). ` +
      `This usually means the failure output could not be mapped to a source file.`,
    );
  }

  const sourceCode = await readFile(filePath, "utf-8");

  return {
    testOutput: failureOutput,
    files: [{ filePath, relativePath, sourceCode }],
  };
}

/**
 * Infers the source file to fix from the test failure output.
 *
 * Looks for test file patterns like `test/foo.test.ts` and maps to `src/foo.ts`.
 */
export function inferSourceFile(testOutput: string): string {
  const testFileMatch = testOutput.match(/test\/(\w+)\.test\.ts/);
  if (testFileMatch) {
    return `src/${testFileMatch[1]}.ts`;
  }
  return "src/index.ts";
}
