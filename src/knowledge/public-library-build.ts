import { createHash } from 'node:crypto';
import type { LLMClientConfig } from '../model/config.ts';
import type { LLMProviderAdapter } from '../model/provider-adapter.ts';
import type { KnowledgeUnitType } from '../types/knowledge.ts';
import type { KnowledgeUnitCountByType } from './unit-index.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport,
  type PublicKnowledgeCentralLibraryClassification,
  type PublicKnowledgeDownloadSummary,
  type PublicKnowledgeLibraryArtifact,
  type PublicKnowledgeQualityStatus,
  type PublicKnowledgeUrlReport,
  type PublicKnowledgeUrlReportOptions
} from './url-report.ts';
import {
  buildPublicKnowledgeLibraryRefinementReviewReportFromArtifact,
  type PublicKnowledgeLibraryRefinementReviewReport
} from './public-library-refinement-review.ts';
import {
  runPublicKnowledgeLibraryRefinement,
  type PublicKnowledgeLibraryRefinementRunReport
} from './public-library-refinement-run.ts';
import { validateKnowledgePayload, type KnowledgeValidationIssue } from './validate.ts';

type FetchTransport = typeof fetch;

export interface PublicKnowledgeLibraryBuildRefineOptions {
  config: LLMClientConfig;
  fetchTransport?: FetchTransport;
  providerAdapter?: LLMProviderAdapter;
}

export interface PublicKnowledgeLibraryBuildOptions {
  url: string;
  contentPath?: string;
  maxUnits?: number;
  now?: Date;
  fetchImpl?: PublicKnowledgeUrlReportOptions['fetchImpl'];
  fetchTransport?: FetchTransport;
  providerAdapter?: LLMProviderAdapter;
  refine?: PublicKnowledgeLibraryBuildRefineOptions;
}

export interface PublicKnowledgeLibraryBuildResult {
  report: PublicKnowledgeLibraryBuildReport;
  artifact: PublicKnowledgeLibraryArtifact;
  urlReport: PublicKnowledgeUrlReport;
}

export interface PublicKnowledgeLibraryBuildReport {
  kind: 'infra-agent.public-knowledge-library-build';
  schemaVersion: 1;
  mutationAllowed: boolean;
  executionMode: 'deterministic' | 'model-refinement';
  sourceUrl: string;
  coordinates: string;
  classification: PublicKnowledgeCentralLibraryClassification;
  download: PublicKnowledgeDownloadSummary;
  quality: {
    initial: PublicKnowledgeQualitySnapshot;
    final: PublicKnowledgeQualitySnapshot;
  };
  unitCoverage: PublicKnowledgeUnitCoverageSnapshot;
  artifact: {
    artifactId: string;
    sourceContentHash: string;
    unitPayloadHash: string;
    generatedFromReportKind: PublicKnowledgeLibraryArtifact['generatedFromReportKind'];
    kind: PublicKnowledgeLibraryArtifact['kind'];
    reviewRequired: true;
  };
  refinement: {
    enabled: boolean;
    status: 'disabled' | 'validated';
    reviewPacketHash: string;
    inputReviewPacketHash: string;
    finalReviewPacketHash: string;
    run?: {
      provider: PublicKnowledgeLibraryRefinementRunReport['provider'];
      request: PublicKnowledgeLibraryRefinementRunReport['request'];
      response: PublicKnowledgeLibraryRefinementRunReport['response'];
    };
  };
  validation: {
    valid: true;
    inputKind: 'infra-agent.public-knowledge-library-artifact';
    issueCount: number;
    warningCount: number;
    warnings: KnowledgeValidationIssue[];
  };
  warnings: string[];
}

export interface PublicKnowledgeQualitySnapshot {
  status: PublicKnowledgeQualityStatus;
  score: number;
  warningCount: number;
  warnings: string[];
}

export interface PublicKnowledgeUnitCoverageSnapshot {
  unitCount: number;
  unitCounts: KnowledgeUnitCountByType;
  includedUnitTypes: KnowledgeUnitType[];
  missingUnitTypes: KnowledgeUnitType[];
  unitTypeComplete: boolean;
  compactByteLength: number;
}

function qualitySnapshot(report: PublicKnowledgeUrlReport): PublicKnowledgeQualitySnapshot {
  return {
    status: report.quality.status,
    score: report.quality.score,
    warningCount: report.quality.warnings.length,
    warnings: report.quality.warnings
  };
}

function unitCoverageSnapshot(report: PublicKnowledgeUrlReport): PublicKnowledgeUnitCoverageSnapshot {
  return {
    unitCount: report.summary.includedUnitCount,
    unitCounts: report.summary.unitCounts,
    includedUnitTypes: report.summary.includedUnitTypes,
    missingUnitTypes: report.summary.missingUnitTypes,
    unitTypeComplete: report.summary.unitTypeComplete,
    compactByteLength: report.summary.compactByteLength
  };
}

function validateLibraryArtifact(artifact: PublicKnowledgeLibraryArtifact): KnowledgeValidationIssue[] {
  const validation = validateKnowledgePayload(artifact, 'public-library-build-artifact');
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-library-artifact') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Public knowledge library artifact is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Public knowledge library artifact must be an infra-agent.public-knowledge-library-artifact payload.');
  }

  return validation.issues.filter(issue => issue.severity === 'warning');
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function artifactReviewPacketHash(artifact: PublicKnowledgeLibraryArtifact): string {
  return sha256(JSON.stringify(artifact.llmRefinementInput.reviewPacket));
}

function buildArtifactValidation(
  warnings: KnowledgeValidationIssue[]
): PublicKnowledgeLibraryBuildReport['validation'] {
  return {
    valid: true,
    inputKind: 'infra-agent.public-knowledge-library-artifact',
    issueCount: warnings.length,
    warningCount: warnings.length,
    warnings
  };
}

function refinementWarnings(
  reviewReport: PublicKnowledgeLibraryRefinementReviewReport,
  runReport?: PublicKnowledgeLibraryRefinementRunReport
): string[] {
  return [
    ...reviewReport.warnings,
    ...(runReport?.warnings ?? [])
  ];
}

function buildReport(input: {
  initialUrlReport: PublicKnowledgeUrlReport;
  finalUrlReport: PublicKnowledgeUrlReport;
  artifact: PublicKnowledgeLibraryArtifact;
  reviewReport: PublicKnowledgeLibraryRefinementReviewReport;
  artifactWarnings: KnowledgeValidationIssue[];
  refinementRunReport?: PublicKnowledgeLibraryRefinementRunReport;
}): PublicKnowledgeLibraryBuildReport {
  const { artifact, finalUrlReport, initialUrlReport, reviewReport, refinementRunReport } = input;
  const finalReviewPacketHash = artifactReviewPacketHash(artifact);

  return {
    kind: 'infra-agent.public-knowledge-library-build',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: refinementRunReport ? 'model-refinement' : 'deterministic',
    sourceUrl: finalUrlReport.sourceUrl,
    coordinates: artifact.coordinates,
    classification: artifact.classification,
    download: finalUrlReport.download,
    quality: {
      initial: qualitySnapshot(initialUrlReport),
      final: qualitySnapshot(finalUrlReport)
    },
    unitCoverage: unitCoverageSnapshot(finalUrlReport),
    artifact: {
      artifactId: artifact.artifactId,
      sourceContentHash: artifact.sourceContentHash,
      unitPayloadHash: artifact.unitPayloadHash,
      generatedFromReportKind: artifact.generatedFromReportKind,
      kind: artifact.kind,
      reviewRequired: artifact.publication.reviewRequired
    },
    refinement: {
      enabled: Boolean(refinementRunReport),
      status: refinementRunReport ? 'validated' : 'disabled',
      reviewPacketHash: finalReviewPacketHash,
      inputReviewPacketHash: reviewReport.review.reviewPacketHash,
      finalReviewPacketHash,
      ...(refinementRunReport
        ? {
            run: {
              provider: refinementRunReport.provider,
              request: refinementRunReport.request,
              response: refinementRunReport.response
            }
          }
        : {})
    },
    validation: buildArtifactValidation(input.artifactWarnings),
    warnings: [
      ...refinementWarnings(reviewReport, refinementRunReport),
      ...(input.artifactWarnings.length > 0
        ? [`Artifact validation returned ${input.artifactWarnings.length} warning(s).`]
        : [])
    ]
  };
}

export async function buildPublicKnowledgeLibraryFromUrl(
  options: PublicKnowledgeLibraryBuildOptions
): Promise<PublicKnowledgeLibraryBuildResult> {
  const initialUrlReport = await buildPublicKnowledgeUrlReport({
    url: options.url,
    contentPath: options.contentPath,
    maxUnits: options.maxUnits,
    now: options.now,
    fetchImpl: options.fetchImpl
  });
  const initialArtifact = buildPublicKnowledgeLibraryArtifact(initialUrlReport);
  const initialArtifactWarnings = validateLibraryArtifact(initialArtifact);
  const reviewReport = buildPublicKnowledgeLibraryRefinementReviewReportFromArtifact({
    artifact: initialArtifact,
    inputPath: 'in-memory-public-library-artifact'
  });

  if (!options.refine) {
    return {
      artifact: initialArtifact,
      urlReport: initialUrlReport,
      report: buildReport({
        initialUrlReport,
        finalUrlReport: initialUrlReport,
        artifact: initialArtifact,
        reviewReport,
        artifactWarnings: initialArtifactWarnings
      })
    };
  }

  const refinement = await runPublicKnowledgeLibraryRefinement({
    reviewReport,
    config: options.refine.config,
    fetchTransport: options.refine.fetchTransport ?? options.fetchTransport,
    providerAdapter: options.refine.providerAdapter ?? options.providerAdapter
  });
  const refinedArtifact: PublicKnowledgeLibraryArtifact = {
    ...buildPublicKnowledgeLibraryArtifact(refinement.refinedReport),
    artifactId: initialArtifact.artifactId
  };
  const refinedArtifactWarnings = validateLibraryArtifact(refinedArtifact);

  return {
    artifact: refinedArtifact,
    urlReport: refinement.refinedReport,
    report: buildReport({
      initialUrlReport,
      finalUrlReport: refinement.refinedReport,
      artifact: refinedArtifact,
      reviewReport,
      artifactWarnings: refinedArtifactWarnings,
      refinementRunReport: refinement.report
    })
  };
}
