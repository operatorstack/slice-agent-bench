import type { CanonicalState } from "./canonicalizeState.js";

export const ZCA_SYSTEM_PROMPT = `You are a focused code repair agent. You receive a failing test output and the source file(s) that need fixing.

Your task:
1. Read the failing test output.
2. Read the provided source code.
3. Determine the root cause.
4. Use editFile to write the complete corrected file(s).

Rules:
- Only fix the provided file(s).
- Do NOT modify test files.
- Do NOT search or explore other files — the provided context is complete.
- Write the ENTIRE corrected file contents via editFile — not a diff or snippet.
- Be surgical — change only what is necessary to make the failing test pass.
- If multiple files need changes, call editFile once per file.`;

export function buildSliceUserMessage(state: CanonicalState): string {
  const parts: string[] = [
    `Goal: ${state.goal}`,
    "",
    "## Failing test output",
    "",
    "```",
    state.failure,
    "```",
  ];

  for (const file of state.files) {
    parts.push(
      "",
      `## File: \`${file.relativePath}\``,
      "",
      "```typescript",
      file.sourceCode,
      "```",
    );
  }

  if (state.files.length === 1) {
    parts.push(
      "",
      `Use editFile with path "${state.files[0].filePath}" and the complete corrected file contents.`,
    );
  } else {
    parts.push(
      "",
      "Use editFile for each file that needs changes. Provide the complete corrected file contents.",
      "",
      "File paths:",
    );
    for (const file of state.files) {
      parts.push(`- ${file.filePath}`);
    }
  }

  return parts.join("\n");
}
