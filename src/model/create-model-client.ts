import type { ModelClient } from './ModelClient.ts';
import { resolveLLMClientConfig, type PlannerMode } from './config.ts';
import { LLMModelClient } from './LLMModelClient.ts';
import { RuleBasedModelClient } from './RuleBasedModelClient.ts';

export function createModelClient(mode: PlannerMode = 'auto'): ModelClient {
  if (mode === 'rule-based') {
    return new RuleBasedModelClient();
  }

  const llmConfig = resolveLLMClientConfig();
  if (mode === 'llm') {
    if (!llmConfig) {
      throw new Error('LLM planner was requested but no API key was configured. Set INFRA_AGENT_OPENAI_API_KEY or OPENAI_API_KEY.');
    }

    return new LLMModelClient(llmConfig);
  }

  if (llmConfig) {
    return new LLMModelClient(llmConfig);
  }

  return new RuleBasedModelClient('rule-based-fallback');
}
