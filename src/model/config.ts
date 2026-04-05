export type PlannerMode = 'auto' | 'llm' | 'rule-based';

export interface LLMClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return 'https://api.openai.com/v1';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveLLMClientConfig(): LLMClientConfig | null {
  const apiKey = process.env.INFRA_AGENT_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(process.env.INFRA_AGENT_OPENAI_BASE_URL || process.env.OPENAI_BASE_URL),
    model: process.env.INFRA_AGENT_MODEL?.trim() || 'gpt-5-mini'
  };
}
