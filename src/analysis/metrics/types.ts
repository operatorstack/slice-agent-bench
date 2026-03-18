export interface BenchmarkResult {
  task: string;
  agent: string;
  success: boolean;
  steps: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface TaskClassification {
  locality: "L1" | "L2" | "L3" | "L4";
  observability: "O1" | "O2" | "O3" | "O4";
}

export interface BenchmarkSummary {
  results: BenchmarkResult[];
  matrix: MatrixCell[][];
  tasks: string[];
  agents: string[];
}

export interface MatrixCell {
  task: string;
  agent: string;
  success: boolean;
  steps: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
}

export const TASK_CLASSIFICATIONS: Record<string, TaskClassification> = {
  parser_bug: { locality: "L1", observability: "O1" },
  range_check_bug: { locality: "L2", observability: "O1" },
  slug_conflict_bug: { locality: "L3", observability: "O2" },
  config_lookup_bug: { locality: "L2", observability: "O3" },
};
