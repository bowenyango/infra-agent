import { createHash } from 'node:crypto';
import type { LLMClientConfig } from '../model/config.ts';
import {
  createLLMProviderAdapter,
  type LLMProviderAdapter,
  type LLMProviderMessage
} from '../model/provider-adapter.ts';
import {
  buildPublicKnowledgeLibraryRefinementReviewReport,
  type PublicKnowledgeLibraryRefinementReviewReport
} from './public-library-refinement-review.ts';
import { validateKnowledgePayload, type KnowledgeValidationIssue } from './validate.ts';
import type {
  PublicKnowledgeQualityStatus,
  PublicKnowledgeUrlReport
} from './url-report.ts';
import type { KnowledgeUnitType } from '../types/knowledge.ts';
import type { KnowledgeUnitCountByType } from './unit-index.ts';

type FetchTransport = typeof fetch;

export interface PublicKnowledgeLibraryRefinementRunOptions {
  reviewReport?: PublicKnowledgeLibraryRefinementReviewReport;
  artifactPath?: string;
  baseDir?: string;
  config: LLMClientConfig;
  fetchTransport?: FetchTransport;
  providerAdapter?: LLMProviderAdapter;
}

export interface PublicKnowledgeLibraryRefinementRunResult {
  report: PublicKnowledgeLibraryRefinementRunReport;
  refinedReport: PublicKnowledgeUrlReport;
}

export interface PublicKnowledgeLibraryRefinementRunReport {
  kind: 'infra-agent.public-knowledge-library-refinement-run';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'model-refinement-run';
  inputPath: string;
  coordinates: string;
  provider: {
    id: LLMClientConfig['provider'];
    model: string;
    transport: 'chat-completions';
    responseFormat: 'json-object';
  };
  request: {
    promptHash: string;
    compactInputHash: string;
    reviewPacketHash: string;
    rawContentIncluded: false;
  };
  response: {
    status: 'validated';
    httpStatus: number;
    contentHash: string;
    contentByteLength: number;
    outputKind: 'infra-agent.public-knowledge-url-report';
  };
  refined: {
    sourceId: string;
    sourceContentHash: string;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    unitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    includedUnitTypes: KnowledgeUnitType[];
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    compactByteLength: number;
  };
  validation: {
    valid: true;
    inputKind: 'infra-agent.public-knowledge-url-report';
    issueCount: number;
    warningCount: number;
    warnings: KnowledgeValidationIssue[];
  };
  warnings: string[];
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePublicKnowledgeUrlReport(value: unknown): PublicKnowledgeUrlReport {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-url-report') {
    throw new Error('LLM refinement output must be an infra-agent.public-knowledge-url-report payload.');
  }

  return value as unknown as PublicKnowledgeUrlReport;
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function parseJsonContent(content: string): unknown {
  const stripped = stripJsonFence(content);
  try {
    return JSON.parse(stripped) as unknown;
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end <= start) {
      throw new Error('LLM refinement response did not contain a JSON object.');
    }

    return JSON.parse(stripped.slice(start, end + 1)) as unknown;
  }
}

function buildCompactInput(reviewReport: PublicKnowledgeLibraryRefinementReviewReport): Record<string, unknown> {
  return {
    outputContract: reviewReport.llmPrompt.outputContract,
    compactInputs: reviewReport.compactInputs,
    llmRefinementInput: reviewReport.llmRefinementInput,
    rawContentIncluded: false
  };
}

function buildMessages(reviewReport: PublicKnowledgeLibraryRefinementReviewReport): LLMProviderMessage[] {
  const compactInput = buildCompactInput(reviewReport);

  return [
    {
      role: 'system',
      content: reviewReport.llmPrompt.system
    },
    {
      role: 'user',
      content: [
        reviewReport.llmPrompt.user,
        'Compact input JSON:',
        JSON.stringify(compactInput)
      ].join('\n')
    }
  ];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertSame(value: boolean, field: string): void {
  if (!value) {
    throw new Error(`Refined public knowledge URL report does not match original library artifact: ${field}.`);
  }
}

function assertRefinementIdentity(
  original: PublicKnowledgeLibraryRefinementReviewReport,
  refined: PublicKnowledgeUrlReport
): void {
  assertSame(refined.centralLibraryCandidate.classification.coordinates === original.artifact.coordinates, 'coordinates');
  assertSame(refined.sourceId === original.llmRefinementInput.reviewPacket.sourceId, 'sourceId');
  assertSame(refined.sourceContentHash === original.artifact.sourceContentHash, 'sourceContentHash');
  assertSame(sameJson(refined.centralLibraryCandidate.classification, original.classification), 'classification');
  assertSame(sameJson(refined.download, original.compactInputs.download), 'download');
  assertSame(sameJson(refined.sourceOutline, original.compactInputs.sourceOutline), 'sourceOutline');
  assertSame(sameJson(refined.centralLibraryCandidate.classification.versionRef, original.artifact.versionRef), 'versionRef');
  assertSame(sameJson(refined.centralLibraryCandidate.classification.versionResolution, original.artifact.versionResolution), 'versionResolution');
}

async function resolveReviewReport(
  options: PublicKnowledgeLibraryRefinementRunOptions
): Promise<PublicKnowledgeLibraryRefinementReviewReport> {
  if (options.reviewReport) {
    return options.reviewReport;
  }

  if (!options.artifactPath) {
    throw new Error('Public library refinement run requires reviewReport or artifactPath.');
  }

  return buildPublicKnowledgeLibraryRefinementReviewReport({
    artifactPath: options.artifactPath,
    baseDir: options.baseDir ?? process.cwd()
  });
}

export async function runPublicKnowledgeLibraryRefinement(
  options: PublicKnowledgeLibraryRefinementRunOptions
): Promise<PublicKnowledgeLibraryRefinementRunResult> {
  const reviewReport = await resolveReviewReport(options);
  const providerAdapter = options.providerAdapter ?? createLLMProviderAdapter(options.config.provider);
  if (providerAdapter.provider !== options.config.provider) {
    throw new Error(`LLM provider adapter ${providerAdapter.provider} cannot handle provider ${options.config.provider}.`);
  }

  const messages = buildMessages(reviewReport);
  const compactInputJson = JSON.stringify(buildCompactInput(reviewReport));
  const promptJson = JSON.stringify({
    system: reviewReport.llmPrompt.system,
    user: reviewReport.llmPrompt.user,
    compactInputHash: sha256(compactInputJson),
    outputContract: reviewReport.llmPrompt.outputContract
  });
  const request = providerAdapter.buildRequest(options.config, messages);
  const fetchTransport = options.fetchTransport ?? fetch;
  const response = await fetchTransport(request.url, request.init);

  if (!response.ok) {
    const text = await response.text();
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    throw new Error(`Public library refinement request failed with status ${response.status}${statusText}; response body omitted (${Buffer.byteLength(text, 'utf8')} bytes).`);
  }

  const body = await response.json() as unknown;
  const content = providerAdapter.extractMessageContent(body);
  if (!content) {
    throw new Error('Public library refinement response did not include message content.');
  }

  const parsed = parseJsonContent(content);
  const validation = validateKnowledgePayload(parsed, 'public-library-refinement-output');
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-url-report') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Public library refinement output is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Public library refinement output must be an infra-agent.public-knowledge-url-report payload.');
  }

  const refinedReport = parsePublicKnowledgeUrlReport(parsed);
  assertRefinementIdentity(reviewReport, refinedReport);
  const warnings = validation.issues.filter(issue => issue.severity === 'warning');

  return {
    refinedReport,
    report: {
      kind: 'infra-agent.public-knowledge-library-refinement-run',
      schemaVersion: 1,
      mutationAllowed: false,
      executionMode: 'model-refinement-run',
      inputPath: reviewReport.inputPath,
      coordinates: reviewReport.artifact.coordinates,
      provider: {
        id: options.config.provider,
        model: options.config.model,
        transport: providerAdapter.capabilities.transport,
        responseFormat: providerAdapter.capabilities.responseFormat
      },
      request: {
        promptHash: sha256(promptJson),
        compactInputHash: sha256(compactInputJson),
        reviewPacketHash: reviewReport.review.reviewPacketHash,
        rawContentIncluded: false
      },
      response: {
        status: 'validated',
        httpStatus: response.status,
        contentHash: sha256(content),
        contentByteLength: Buffer.byteLength(content, 'utf8'),
        outputKind: 'infra-agent.public-knowledge-url-report'
      },
      refined: {
        sourceId: refinedReport.sourceId,
        sourceContentHash: refinedReport.sourceContentHash,
        qualityStatus: refinedReport.quality.status,
        qualityScore: refinedReport.quality.score,
        unitCount: refinedReport.summary.includedUnitCount,
        unitCounts: refinedReport.summary.unitCounts,
        includedUnitTypes: refinedReport.summary.includedUnitTypes,
        missingUnitTypes: refinedReport.summary.missingUnitTypes,
        unitTypeComplete: refinedReport.summary.unitTypeComplete,
        compactByteLength: refinedReport.summary.compactByteLength
      },
      validation: {
        valid: true,
        inputKind: 'infra-agent.public-knowledge-url-report',
        issueCount: validation.issueCount,
        warningCount: warnings.length,
        warnings
      },
      warnings: [
        ...reviewReport.warnings,
        ...(warnings.length > 0
          ? [`Validation returned ${warnings.length} warning(s) for the refined public knowledge URL report.`]
          : [])
      ]
    }
  };
}
