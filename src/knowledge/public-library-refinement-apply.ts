import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateKnowledgePayload } from './validate.ts';
import {
  buildPublicKnowledgeLibraryArtifact,
  type PublicKnowledgeLibraryArtifact,
  type PublicKnowledgeQualityStatus,
  type PublicKnowledgeUrlReport
} from './url-report.ts';
import type { KnowledgeUnitCountByType } from './unit-index.ts';
import type { KnowledgeUnitType } from '../types/knowledge.ts';

export interface PublicKnowledgeLibraryRefinementApplyOptions {
  artifactPath: string;
  refinedReportPath: string;
  baseDir: string;
}

export interface PublicKnowledgeLibraryRefinementApplyResult {
  report: PublicKnowledgeLibraryRefinementApplyReport;
  artifact: PublicKnowledgeLibraryArtifact;
}

export interface PublicKnowledgeLibraryRefinementApplyReport {
  kind: 'infra-agent.public-knowledge-library-refinement-apply';
  schemaVersion: 1;
  mutationAllowed: true;
  executionMode: 'local-artifact-write';
  inputPath: string;
  refinedReportPath: string;
  coordinates: string;
  driftChecks: {
    coordinates: 'matched';
    source: 'matched';
    sourceContentHash: 'matched';
    classification: 'matched';
    download: 'matched';
    sourceOutline: 'matched';
    version: 'matched';
  };
  artifact: {
    artifactId: string;
    previousUnitPayloadHash: string;
    unitPayloadHash: string;
    sourceContentHash: string;
    unitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    includedUnitTypes: KnowledgeUnitType[];
    compactByteLength: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    reviewRequired: true;
  };
  refinement: {
    inputContract: 'infra-agent.public-knowledge-url-report';
    outputArtifactKind: 'infra-agent.public-knowledge-library-artifact';
    status: 'applied';
    reviewPacketHash: string;
    unitTypes: KnowledgeUnitType[];
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    qualityWarningCount: number;
  };
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sha256(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function parseArtifact(value: unknown): PublicKnowledgeLibraryArtifact {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-library-artifact') {
    throw new Error('knowledge library-refinement-apply requires an infra-agent.public-knowledge-library-artifact input.');
  }

  return value as unknown as PublicKnowledgeLibraryArtifact;
}

function parseUrlReport(value: unknown): PublicKnowledgeUrlReport {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-url-report') {
    throw new Error('knowledge library-refinement-apply --refined requires an infra-agent.public-knowledge-url-report input.');
  }

  return value as unknown as PublicKnowledgeUrlReport;
}

async function readValidatedPayload(
  path: string,
  expectedKind: 'infra-agent.public-knowledge-library-artifact' | 'infra-agent.public-knowledge-url-report',
  label: string
): Promise<unknown> {
  const payload = JSON.parse(await readFile(path, 'utf8')) as unknown;
  const validation = validateKnowledgePayload(payload, path);
  if (!validation.valid || validation.inputKind !== expectedKind) {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `${label} is invalid: ${firstIssue.path} ${firstIssue.message}`
      : `${label} must be a ${expectedKind} payload.`);
  }

  return payload;
}

function assertSame(value: boolean, field: string): void {
  if (!value) {
    throw new Error(`Refined public knowledge URL report does not match original library artifact: ${field}.`);
  }
}

function assertRefinementIdentity(
  original: PublicKnowledgeLibraryArtifact,
  refined: PublicKnowledgeUrlReport
): void {
  assertSame(refined.centralLibraryCandidate.classification.coordinates === original.coordinates, 'coordinates');
  assertSame(refined.sourceId === original.sourceId, 'sourceId');
  assertSame(refined.sourceContentHash === original.sourceContentHash, 'sourceContentHash');
  assertSame(sameJson(refined.centralLibraryCandidate.source, original.source), 'source');
  assertSame(sameJson(refined.centralLibraryCandidate.classification, original.classification), 'classification');
  assertSame(sameJson(refined.download, original.download), 'download');
  assertSame(sameJson(refined.sourceOutline, original.sourceOutline), 'sourceOutline');
  assertSame(sameJson(refined.centralLibraryCandidate.classification.versionRef, original.classification.versionRef), 'versionRef');
  assertSame(sameJson(refined.centralLibraryCandidate.classification.versionResolution, original.classification.versionResolution), 'versionResolution');
}

function buildWarnings(
  original: PublicKnowledgeLibraryArtifact,
  updated: PublicKnowledgeLibraryArtifact
): string[] {
  return [
    ...(updated.quality.status === 'needs-refinement'
      ? ['Updated artifact still needs refinement before it should be treated as ready public-reference knowledge.']
      : []),
    ...(updated.llmRefinementInput.reviewPacket.missingUnitTypes.length > 0
      ? [`Updated artifact is missing unit types: ${updated.llmRefinementInput.reviewPacket.missingUnitTypes.join(', ')}.`]
      : []),
    ...(original.unitPayloadHash === updated.unitPayloadHash
      ? ['Refined report produced the same unit payload hash as the original artifact.']
      : []),
    ...(updated.publication.reviewRequired
      ? ['Updated artifact remains review-required before registry staging or broad reuse.']
      : [])
  ];
}

export async function applyPublicKnowledgeLibraryRefinement(
  options: PublicKnowledgeLibraryRefinementApplyOptions
): Promise<PublicKnowledgeLibraryRefinementApplyResult> {
  const inputPath = resolve(options.baseDir, options.artifactPath);
  const refinedReportPath = resolve(options.baseDir, options.refinedReportPath);
  const originalPayload = await readValidatedPayload(
    inputPath,
    'infra-agent.public-knowledge-library-artifact',
    'Original public library artifact'
  );
  const refinedPayload = await readValidatedPayload(
    refinedReportPath,
    'infra-agent.public-knowledge-url-report',
    'Refined public knowledge URL report'
  );
  const original = parseArtifact(originalPayload);
  const refined = parseUrlReport(refinedPayload);
  assertRefinementIdentity(original, refined);

  const updatedArtifact: PublicKnowledgeLibraryArtifact = {
    ...buildPublicKnowledgeLibraryArtifact(refined),
    artifactId: original.artifactId
  };
  const updatedValidation = validateKnowledgePayload(updatedArtifact, 'updated-public-library-artifact');
  if (!updatedValidation.valid || updatedValidation.inputKind !== 'infra-agent.public-knowledge-library-artifact') {
    const firstIssue = updatedValidation.issues[0];
    throw new Error(firstIssue
      ? `Updated public library artifact is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Updated public library artifact is invalid.');
  }

  const reviewPacketHash = sha256(JSON.stringify(updatedArtifact.llmRefinementInput.reviewPacket));
  const warnings = buildWarnings(original, updatedArtifact);

  return {
    artifact: updatedArtifact,
    report: {
      kind: 'infra-agent.public-knowledge-library-refinement-apply',
      schemaVersion: 1,
      mutationAllowed: true,
      executionMode: 'local-artifact-write',
      inputPath,
      refinedReportPath,
      coordinates: updatedArtifact.coordinates,
      driftChecks: {
        coordinates: 'matched',
        source: 'matched',
        sourceContentHash: 'matched',
        classification: 'matched',
        download: 'matched',
        sourceOutline: 'matched',
        version: 'matched'
      },
      artifact: {
        artifactId: updatedArtifact.artifactId,
        previousUnitPayloadHash: original.unitPayloadHash,
        unitPayloadHash: updatedArtifact.unitPayloadHash,
        sourceContentHash: updatedArtifact.sourceContentHash,
        unitCount: updatedArtifact.summary.unitCount,
        unitCounts: updatedArtifact.summary.unitCounts,
        includedUnitTypes: updatedArtifact.summary.includedUnitTypes,
        compactByteLength: updatedArtifact.summary.compactByteLength,
        qualityStatus: updatedArtifact.quality.status,
        qualityScore: updatedArtifact.quality.score,
        reviewRequired: true
      },
      refinement: {
        inputContract: 'infra-agent.public-knowledge-url-report',
        outputArtifactKind: 'infra-agent.public-knowledge-library-artifact',
        status: 'applied',
        reviewPacketHash,
        unitTypes: updatedArtifact.llmRefinementInput.unitTypes,
        missingUnitTypes: updatedArtifact.llmRefinementInput.reviewPacket.missingUnitTypes,
        unitTypeComplete: updatedArtifact.llmRefinementInput.reviewPacket.missingUnitTypes.length === 0,
        qualityWarningCount: updatedArtifact.quality.warnings.length
      },
      warnings
    }
  };
}
