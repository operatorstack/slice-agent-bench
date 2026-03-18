import type { ProjectedSlice, SliceFile } from "./projectFailureSlice.js";

export interface CanonicalFile {
  relativePath: string;
  filePath: string;
  sourceCode: string;
}

export interface CanonicalState {
  goal: string;
  failure: string;
  failureLabel: string;
  files: CanonicalFile[];
}

export function canonicalizeState(
  slice: ProjectedSlice,
  goal = "Fix the failing test by patching the source file(s).",
  failureLabel = "Failing test output",
): CanonicalState {
  return {
    goal,
    failure: slice.testOutput,
    failureLabel,
    files: slice.files.map(toCanonicalFile),
  };
}

function toCanonicalFile(file: SliceFile): CanonicalFile {
  return {
    relativePath: file.relativePath,
    filePath: file.filePath,
    sourceCode: file.sourceCode,
  };
}
