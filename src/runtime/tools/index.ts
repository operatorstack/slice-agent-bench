import type { ToolDefinition, ToolHandler } from "./types.js";
import { readFile } from "./readFile.js";
import { createSearchRepo } from "./searchRepo.js";
import { editFile } from "./editFile.js";
import { runTests } from "./runTests.js";

export interface ToolRegistry {
  handlers: Map<string, ToolHandler>;
  definitions: ToolDefinition[];
}

export function createToolRegistry(taskPath: string): ToolRegistry {
  const searchRepo = createSearchRepo(taskPath);

  const boundRunTests = (args: Record<string, unknown>) =>
    runTests({ ...args, taskPath });

  const handlers = new Map<string, ToolHandler>([
    ["readFile", readFile],
    ["searchRepo", searchRepo],
    ["editFile", editFile],
    ["runTests", boundRunTests],
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
      name: "runTests",
      description: "Run the test suite in the task repository.",
      parameters: {},
    },
  ];

  return { handlers, definitions };
}
