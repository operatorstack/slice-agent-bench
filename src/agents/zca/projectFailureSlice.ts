import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface SliceFile {
  filePath: string;
  relativePath: string;
  sourceCode: string;
}

export interface ProjectedSlice {
  testOutput: string;
  files: SliceFile[];
}

/**
 * Naive projector: extracts a single-file slice from the task repo.
 *
 * Reads the failing test output and the source file most likely responsible
 * for the failure. The model never sees the broader repo — only this slice.
 */
export async function projectFailureSlice(
  taskPath: string,
  testOutput: string,
): Promise<ProjectedSlice> {
  const relativePath = inferSourceFile(testOutput);
  const filePath = resolve(join(taskPath, relativePath));
  const sourceCode = await readFile(filePath, "utf-8");

  return {
    testOutput,
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
