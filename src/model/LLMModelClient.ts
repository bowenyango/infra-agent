import type { AgentDecision, AgentRuntimeState } from '../types/agent.ts';
import type { ModelClient } from './ModelClient.ts';
import type { LLMClientConfig } from './config.ts';
import { parsePlannerDecision } from './decision-parser.ts';
import {
  createLLMProviderAdapter,
  type LLMProviderAdapter,
  type LLMProviderMessage
} from './provider-adapter.ts';
import { buildPlannerSystemPrompt, buildPlannerUserPrompt } from './prompt.ts';

type FetchTransport = typeof fetch;

export class LLMModelClient implements ModelClient {
  readonly name: string;
  private readonly config: LLMClientConfig;
  private readonly fetchTransport: FetchTransport;
  private readonly providerAdapter: LLMProviderAdapter;

  constructor(
    config: LLMClientConfig,
    fetchTransport: FetchTransport = fetch,
    providerAdapter: LLMProviderAdapter = createLLMProviderAdapter(config.provider)
  ) {
    if (providerAdapter.provider !== config.provider) {
      throw new Error(`LLM provider adapter ${providerAdapter.provider} cannot handle provider ${config.provider}.`);
    }

    this.config = config;
    this.fetchTransport = fetchTransport;
    this.providerAdapter = providerAdapter;
    this.name = `llm-model-client:${config.model}`;
  }

  async decideNextAction(runtime: AgentRuntimeState): Promise<AgentDecision> {
    const messages: LLMProviderMessage[] = [
      {
        role: 'system',
        content: buildPlannerSystemPrompt()
      },
      {
        role: 'user',
        content: buildPlannerUserPrompt(runtime)
      }
    ];
    const request = this.providerAdapter.buildRequest(this.config, messages);
    const response = await this.fetchTransport(request.url, request.init);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM planner request failed with status ${response.status}: ${text}`);
    }

    const body = await response.json() as unknown;
    const content = this.providerAdapter.extractMessageContent(body);
    if (!content) {
      throw new Error('LLM planner response did not include message content.');
    }

    return parsePlannerDecision(content, runtime);
  }
}
