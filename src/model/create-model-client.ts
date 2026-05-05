import type { ModelClient } from './ModelClient.ts';
import {
  resolveLLMClientConfig,
  type LLMClientConfigOverrides,
  type LLMConfigEnvironment,
  type LLMProvider,
  type PlannerMode
} from './config.ts';
import { LLMModelClient } from './LLMModelClient.ts';
import { RuleBasedModelClient } from './RuleBasedModelClient.ts';

export type PlannerEffectiveMode = 'llm' | 'rule-based' | 'custom';

export interface PlannerRuntimeConfig {
  requestedMode: PlannerMode;
  effectiveMode: PlannerEffectiveMode;
  clientName: string;
  fallbackReason: string | null;
  llm: {
    provider: LLMProvider;
    model: string;
    baseUrl: string;
    apiKeySource: string;
    providerSource: string;
    modelSource: string;
    baseUrlSource: string;
  } | null;
}

export interface ModelClientSelection {
  client: ModelClient;
  plannerConfig: PlannerRuntimeConfig;
}

function ruleBasedSelection(requestedMode: PlannerMode, clientName: string, fallbackReason: string | null): ModelClientSelection {
  const client = new RuleBasedModelClient(clientName);

  return {
    client,
    plannerConfig: {
      requestedMode,
      effectiveMode: 'rule-based',
      clientName: client.name,
      fallbackReason,
      llm: null
    }
  };
}

function llmSelection(requestedMode: PlannerMode, llmConfig: NonNullable<ReturnType<typeof resolveLLMClientConfig>>): ModelClientSelection {
  const client = new LLMModelClient(llmConfig);

  return {
    client,
    plannerConfig: {
      requestedMode,
      effectiveMode: 'llm',
      clientName: client.name,
      fallbackReason: null,
      llm: {
        provider: llmConfig.provider,
        model: llmConfig.model,
        baseUrl: llmConfig.baseUrl,
        apiKeySource: llmConfig.apiKeySource,
        providerSource: llmConfig.providerSource,
        modelSource: llmConfig.modelSource,
        baseUrlSource: llmConfig.baseUrlSource
      }
    }
  };
}

export function createModelClientSelection(
  mode: PlannerMode = 'auto',
  env?: LLMConfigEnvironment,
  overrides?: LLMClientConfigOverrides
): ModelClientSelection {
  if (mode === 'rule-based') {
    return ruleBasedSelection(mode, 'rule-based-model-client', null);
  }

  const llmConfig = resolveLLMClientConfig(env, overrides);
  if (mode === 'llm') {
    if (!llmConfig) {
      throw new Error('LLM planner was requested but no API key was configured. Set INFRA_AGENT_OPENAI_API_KEY or OPENAI_API_KEY.');
    }

    return llmSelection(mode, llmConfig);
  }

  if (llmConfig) {
    return llmSelection(mode, llmConfig);
  }

  return ruleBasedSelection(mode, 'rule-based-fallback', 'No LLM API key is configured.');
}

export function createModelClient(
  mode: PlannerMode = 'auto',
  env?: LLMConfigEnvironment,
  overrides?: LLMClientConfigOverrides
): ModelClient {
  return createModelClientSelection(mode, env, overrides).client;
}
