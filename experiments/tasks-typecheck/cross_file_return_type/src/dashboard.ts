import type { Metric } from "./types.js";
import { collectLatency } from "./collector.js";

export function getMetrics(): Metric[] {
  const latency: Metric = collectLatency();
  return [latency];
}
