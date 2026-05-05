export type PlannerMode = 'auto' | 'llm' | 'rule-based';
export type LLMProvider = 'openai-compatible';
export type LLMConfigSource = 'cli' | 'env' | 'default';
export type LLMApiKeySource = 'INFRA_AGENT_OPENAI_API_KEY' | 'OPENAI_API_KEY';

export interface LLMClientConfigOverrides {
  provider?: LLMProvider;
  model?: string;
  baseUrl?: string;
}

export interface LLMClientConfig {
  apiKey: string;
  apiKeySource: LLMApiKeySource;
  provider: LLMProvider;
  providerSource: LLMConfigSource;
  baseUrl: string;
  baseUrlSource: LLMConfigSource;
  model: string;
  modelSource: LLMConfigSource;
}

export type LLMConfigEnvironment = Record<string, string | undefined>;

function normalizeProvider(value: LLMProvider | string | undefined): LLMProvider {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'openai-compatible') {
    return 'openai-compatible';
  }

  throw new Error(`Unsupported LLM planner provider "${trimmed}". Expected openai-compatible.`);
}

function normalizeBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return 'https://api.openai.com/v1';
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function resolveLLMClientConfig(
  env: LLMConfigEnvironment = process.env,
  overrides: LLMClientConfigOverrides = {}
): LLMClientConfig | null {
  const apiKey = env.INFRA_AGENT_OPENAI_API_KEY?.trim() || env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const apiKeySource = env.INFRA_AGENT_OPENAI_API_KEY?.trim()
    ? 'INFRA_AGENT_OPENAI_API_KEY'
    : 'OPENAI_API_KEY';
  const provider = normalizeProvider(overrides.provider ?? env.INFRA_AGENT_LLM_PROVIDER);
  const providerSource = overrides.provider
    ? 'cli'
    : env.INFRA_AGENT_LLM_PROVIDER?.trim()
      ? 'env'
      : 'default';
  const model = overrides.model?.trim() || env.INFRA_AGENT_MODEL?.trim() || 'gpt-5-mini';
  const modelSource = overrides.model?.trim()
    ? 'cli'
    : env.INFRA_AGENT_MODEL?.trim()
      ? 'env'
      : 'default';
  const rawBaseUrl = overrides.baseUrl?.trim() || env.INFRA_AGENT_OPENAI_BASE_URL || env.OPENAI_BASE_URL;
  const baseUrlSource = overrides.baseUrl?.trim()
    ? 'cli'
    : (env.INFRA_AGENT_OPENAI_BASE_URL?.trim() || env.OPENAI_BASE_URL?.trim())
      ? 'env'
      : 'default';

  return {
    apiKey,
    apiKeySource,
    provider,
    providerSource,
    baseUrl: normalizeBaseUrl(rawBaseUrl),
    baseUrlSource,
    model,
    modelSource
  };
}
