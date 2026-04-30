export type PlannerMode = 'auto' | 'llm' | 'rule-based';

export interface LLMClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type LLMConfigEnvironment = Record<string, string | undefined>;

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return 'https://api.openai.com/v1';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveLLMClientConfig(env: LLMConfigEnvironment = process.env): LLMClientConfig | null {
  const apiKey = env.INFRA_AGENT_OPENAI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(env.INFRA_AGENT_OPENAI_BASE_URL || env.OPENAI_BASE_URL),
    model: env.INFRA_AGENT_MODEL?.trim() || 'gpt-5-mini'
  };
}
