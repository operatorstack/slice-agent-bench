import type { ToolDefinition, ToolHandler } from "./types.js";
import { readFile } from "./readFile.js";
import { createSearchRepo } from "./searchRepo.js";
import { editFile } from "./editFile.js";
import { runTests } from "./runTests.js";
import { runTypeCheck } from "./runTypeCheck.js";

export interface ToolRegistry {
  handlers: Map<string, ToolHandler>;
  definitions: ToolDefinition[];
}

export function createToolRegistry(
  taskPath: string,
  signal: "test" | "typecheck" = "test",
): ToolRegistry {
  const searchRepo = createSearchRepo(taskPath);

  const verifyHandler: ToolHandler =
    signal === "typecheck"
      ? (args) => runTypeCheck({ ...args, taskPath })
      : (args) => runTests({ ...args, taskPath });

  const verifyToolName = signal === "typecheck" ? "runTypeCheck" : "runTests";
  const verifyDescription =
    signal === "typecheck"
      ? "Run the TypeScript compiler (tsc --noEmit) to check for type errors."
      : "Run the test suite in the task repository.";

  const handlers = new Map<string, ToolHandler>([
    ["readFile", readFile],
    ["searchRepo", searchRepo],
    ["editFile", editFile],
    [verifyToolName, verifyHandler],
  ]);

  const definitions: ToolDefinition[] = [
    {
      name: "readFile",
      description: "Read the contents of a file at the given path.",
      parameters: {
        path: {
          type: "string",
          description: "Absolute or relative path to the file.",
        },
      },
    },
    {
      name: "searchRepo",
      description:
        "Search the task repository for a text pattern. Returns matching lines with file paths and line numbers.",
      parameters: {
        query: {
          type: "string",
          description: "Text or regex pattern to search for.",
        },
      },
    },
    {
      name: "editFile",
      description:
        "Write new content to a file, replacing its current content entirely.",
      parameters: {
        path: {
          type: "string",
          description: "Absolute or relative path to the file.",
        },
        content: {
          type: "string",
          description: "The full new content for the file.",
        },
      },
    },
    {
      name: verifyToolName,
      description: verifyDescription,
      parameters: {},
    },
  ];

  return { handlers, definitions };
}
