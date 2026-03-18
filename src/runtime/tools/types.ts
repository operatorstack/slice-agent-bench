export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterSchema>;
}

export interface ParameterSchema {
  type: string;
  description: string;
}

export interface ToolResult {
  success: boolean;
  output: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResult>;
