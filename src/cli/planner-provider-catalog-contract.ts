import type { PlannerProviderCatalogReport } from './planner-provider-catalog.ts';

const SUPPORTED_PROVIDER_IDS = new Set(['openai-compatible']);
const SUPPORTED_PROVIDER_STATUSES = new Set(['supported']);
const SUPPORTED_TRANSPORTS = new Set(['chat-completions']);
const SUPPORTED_ENDPOINT_PATHS = new Set(['/chat/completions']);
const SUPPORTED_RESPONSE_FORMATS = new Set(['json-object']);
const SUPPORTED_DOMAINS = new Set(['helm', 'pulumi', 'terraform']);
const SUPPORTED_COMMANDS = new Set(['agent', 'doctor']);

const EXPECTED_API_KEY_ENV = ['INFRA_AGENT_OPENAI_API_KEY', 'OPENAI_API_KEY'];
const EXPECTED_BASE_URL_ENV = ['INFRA_AGENT_OPENAI_BASE_URL', 'OPENAI_BASE_URL'];
const EXPECTED_PROVIDER_FLAGS = ['--llm-provider openai-compatible'];
const EXPECTED_MODEL_FLAGS = ['--model <name>', '--llm-model <name>'];
const EXPECTED_BASE_URL_FLAGS = ['--openai-base-url <url>', '--llm-base-url <url>'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`planner provider catalog input ${label} must be a string.`);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`planner provider catalog input ${label} must be a boolean.`);
  }
}

function assertNonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`planner provider catalog input ${label} must be a non-negative integer.`);
  }
}

function assertSupportedString(value: unknown, label: string, supportedValues: Set<string>): asserts value is string {
  assertString(value, label);
  if (!supportedValues.has(value)) {
    throw new Error(`planner provider catalog input ${label} must be supported.`);
  }
}

function assertExactStringArray(value: unknown, label: string, expectedValues: string[]): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`planner provider catalog input ${label} must be an array.`);
  }

  if (value.length !== expectedValues.length || value.some((entry, index) => entry !== expectedValues[index])) {
    throw new Error(`planner provider catalog input ${label} must match the supported values.`);
  }
}

function assertSupportedStringArray(value: unknown, label: string, supportedValues: Set<string>): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new Error(`planner provider catalog input ${label} must be an array.`);
  }

  for (const entry of value) {
    assertSupportedString(entry, label, supportedValues);
  }
}

export function parsePlannerProviderCatalogReport(value: unknown): PlannerProviderCatalogReport {
  if (!isRecord(value)) {
    throw new Error('planner provider catalog input must be an object.');
  }

  if (value.kind !== 'infra-agent.planner-provider-catalog') {
    throw new Error('planner provider catalog input kind must be infra-agent.planner-provider-catalog.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error('planner provider catalog input schemaVersion must be 1.');
  }

  if (value.mutationAllowed !== false) {
    throw new Error('planner provider catalog input mutationAllowed must be false.');
  }

  if (value.liveProviderCheck !== false) {
    throw new Error('planner provider catalog input liveProviderCheck must be false.');
  }

  if (!isRecord(value.scope)) {
    throw new Error('planner provider catalog input scope must be an object.');
  }

  if (value.scope.plannerOnly !== true) {
    throw new Error('planner provider catalog input scope.plannerOnly must be true.');
  }

  assertSupportedStringArray(value.scope.domains, 'scope.domains', SUPPORTED_DOMAINS);
  assertSupportedStringArray(value.commands, 'commands', SUPPORTED_COMMANDS);

  if (!isRecord(value.summary)) {
    throw new Error('planner provider catalog input summary must be an object.');
  }

  assertNonNegativeInteger(value.summary.providerCount, 'summary.providerCount');
  assertNonNegativeInteger(value.summary.supportedProviderCount, 'summary.supportedProviderCount');

  if (!Array.isArray(value.providers)) {
    throw new Error('planner provider catalog input providers must be an array.');
  }

  if (value.summary.providerCount !== value.providers.length) {
    throw new Error('planner provider catalog input summary.providerCount must match providers length.');
  }

  let supportedProviderCount = 0;
  for (const [index, provider] of value.providers.entries()) {
    const label = `providers[${index}]`;
    if (!isRecord(provider)) {
      throw new Error(`planner provider catalog input ${label} must be an object.`);
    }

    assertSupportedString(provider.id, `${label}.id`, SUPPORTED_PROVIDER_IDS);
    assertString(provider.displayName, `${label}.displayName`);
    assertSupportedString(provider.status, `${label}.status`, SUPPORTED_PROVIDER_STATUSES);
    if (provider.status === 'supported') {
      supportedProviderCount += 1;
    }

    if (!isRecord(provider.capabilities)) {
      throw new Error(`planner provider catalog input ${label}.capabilities must be an object.`);
    }
    assertSupportedString(provider.capabilities.transport, `${label}.capabilities.transport`, SUPPORTED_TRANSPORTS);
    assertSupportedString(provider.capabilities.endpointPath, `${label}.capabilities.endpointPath`, SUPPORTED_ENDPOINT_PATHS);
    assertSupportedString(provider.capabilities.responseFormat, `${label}.capabilities.responseFormat`, SUPPORTED_RESPONSE_FORMATS);
    assertBoolean(provider.capabilities.supportsJsonObject, `${label}.capabilities.supportsJsonObject`);
    assertBoolean(provider.capabilities.supportsStreaming, `${label}.capabilities.supportsStreaming`);
    if (provider.capabilities.supportsJsonObject !== true) {
      throw new Error(`planner provider catalog input ${label}.capabilities.supportsJsonObject must be true.`);
    }
    if (provider.capabilities.supportsStreaming !== false) {
      throw new Error(`planner provider catalog input ${label}.capabilities.supportsStreaming must be false.`);
    }

    if (!isRecord(provider.defaults)) {
      throw new Error(`planner provider catalog input ${label}.defaults must be an object.`);
    }
    assertString(provider.defaults.model, `${label}.defaults.model`);
    assertString(provider.defaults.baseUrl, `${label}.defaults.baseUrl`);
    assertExactStringArray(provider.apiKeyEnv, `${label}.apiKeyEnv`, EXPECTED_API_KEY_ENV);

    if (!isRecord(provider.configEnv)) {
      throw new Error(`planner provider catalog input ${label}.configEnv must be an object.`);
    }
    if (provider.configEnv.provider !== 'INFRA_AGENT_LLM_PROVIDER') {
      throw new Error(`planner provider catalog input ${label}.configEnv.provider must match the supported value.`);
    }
    if (provider.configEnv.model !== 'INFRA_AGENT_MODEL') {
      throw new Error(`planner provider catalog input ${label}.configEnv.model must match the supported value.`);
    }
    assertExactStringArray(provider.configEnv.baseUrl, `${label}.configEnv.baseUrl`, EXPECTED_BASE_URL_ENV);

    if (!isRecord(provider.cliFlags)) {
      throw new Error(`planner provider catalog input ${label}.cliFlags must be an object.`);
    }
    assertExactStringArray(provider.cliFlags.provider, `${label}.cliFlags.provider`, EXPECTED_PROVIDER_FLAGS);
    assertExactStringArray(provider.cliFlags.model, `${label}.cliFlags.model`, EXPECTED_MODEL_FLAGS);
    assertExactStringArray(provider.cliFlags.baseUrl, `${label}.cliFlags.baseUrl`, EXPECTED_BASE_URL_FLAGS);
  }

  if (value.summary.supportedProviderCount !== supportedProviderCount) {
    throw new Error('planner provider catalog input summary.supportedProviderCount must match supported providers.');
  }

  return value as PlannerProviderCatalogReport;
}
