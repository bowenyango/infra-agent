import { DEFAULT_RETRIEVED_CONTEXT_BUDGET } from './knowledge/context-budget.ts';

export interface QueryLoopContextBudgetConfig {
  maxPackets: number;
  maxTokens: number;
  maxExcerptChars: number;
  maxFacts: number;
}

export interface QueryLoopConfig {
  maxTurns: number;
  maxRepairAttempts: number;
  retrievedContextBudget: QueryLoopContextBudgetConfig;
}

export interface QueryLoopConfigOverrides {
  maxTurns?: number;
  maxRepairAttempts?: number;
  retrievedContextBudget?: Partial<QueryLoopContextBudgetConfig>;
}

export const DEFAULT_QUERY_LOOP_CONFIG: QueryLoopConfig = {
  maxTurns: 6,
  maxRepairAttempts: 2,
  retrievedContextBudget: {
    maxPackets: DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxPackets,
    maxTokens: DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxTokens,
    maxExcerptChars: DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxExcerptChars,
    maxFacts: DEFAULT_RETRIEVED_CONTEXT_BUDGET.maxFacts
  }
};

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  const normalized = Number.isFinite(value)
    ? Math.trunc(value ?? fallback)
    : fallback;
  return Math.max(1, normalized);
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  const normalized = Number.isFinite(value)
    ? Math.trunc(value ?? fallback)
    : fallback;
  return Math.max(0, normalized);
}

export function resolveQueryLoopConfig(config: QueryLoopConfigOverrides = {}): QueryLoopConfig {
  const maxTurns = Number.isFinite(config.maxTurns)
    ? Math.trunc(config.maxTurns ?? DEFAULT_QUERY_LOOP_CONFIG.maxTurns)
    : DEFAULT_QUERY_LOOP_CONFIG.maxTurns;
  const defaultBudget = DEFAULT_QUERY_LOOP_CONFIG.retrievedContextBudget;
  const budget = config.retrievedContextBudget ?? {};

  return {
    maxTurns: Math.max(1, maxTurns),
    maxRepairAttempts: normalizeNonNegativeInteger(config.maxRepairAttempts, DEFAULT_QUERY_LOOP_CONFIG.maxRepairAttempts),
    retrievedContextBudget: {
      maxPackets: normalizePositiveInteger(budget.maxPackets, defaultBudget.maxPackets),
      maxTokens: normalizePositiveInteger(budget.maxTokens, defaultBudget.maxTokens),
      maxExcerptChars: normalizePositiveInteger(budget.maxExcerptChars, defaultBudget.maxExcerptChars),
      maxFacts: normalizePositiveInteger(budget.maxFacts, defaultBudget.maxFacts)
    }
  };
}
