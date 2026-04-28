export interface QueryLoopConfig {
  maxTurns: number;
}

export const DEFAULT_QUERY_LOOP_CONFIG: QueryLoopConfig = {
  maxTurns: 6
};

export function resolveQueryLoopConfig(config: Partial<QueryLoopConfig> = {}): QueryLoopConfig {
  const maxTurns = Number.isFinite(config.maxTurns)
    ? Math.trunc(config.maxTurns ?? DEFAULT_QUERY_LOOP_CONFIG.maxTurns)
    : DEFAULT_QUERY_LOOP_CONFIG.maxTurns;

  return {
    maxTurns: Math.max(1, maxTurns)
  };
}
