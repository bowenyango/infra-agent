import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateKnowledgePayload } from './validate.ts';
import type {
  CompactPublicKnowledgeUnit,
  PublicKnowledgeCentralLibraryClassification,
  PublicKnowledgeDownloadSummary,
  PublicKnowledgeLibraryArtifact,
  PublicKnowledgeLlmRefinementInput,
  PublicKnowledgeQualityStatus,
  PublicKnowledgeQualitySummary,
  PublicKnowledgeSourceOutline,
  PublicKnowledgeVersionRef,
  PublicKnowledgeVersionResolution
} from './url-report.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeUnitType
} from '../types/knowledge.ts';
import type { KnowledgeUnitCountByType } from './unit-index.ts';

export interface PublicKnowledgeLibraryRefinementReviewOptions {
  artifactPath: string;
  baseDir: string;
}

export interface PublicKnowledgeLibraryRefinementReviewReport {
  kind: 'infra-agent.public-knowledge-library-refinement-review';
  schemaVersion: 1;
  mutationAllowed: false;
  executionMode: 'offline-llm-review-input';
  inputPath: string;
  artifact: {
    artifactId: string;
    coordinates: string;
    sourceContentHash: string;
    unitPayloadHash: string;
    unitCount: number;
    unitCounts: KnowledgeUnitCountByType;
    includedUnitTypes: KnowledgeUnitType[];
    compactByteLength: number;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    qualityWarnings: string[];
    versionRef: PublicKnowledgeVersionRef;
    versionResolution: PublicKnowledgeVersionResolution;
    reviewRequired: true;
  };
  classification: PublicKnowledgeCentralLibraryClassification;
  compactInputs: {
    inputRefs: PublicKnowledgeLlmRefinementInput['inputRefs'];
    classification: PublicKnowledgeCentralLibraryClassification;
    download: PublicKnowledgeDownloadSummary;
    sourceOutline: PublicKnowledgeSourceOutline;
    summary: PublicKnowledgeLibraryArtifact['summary'];
    quality: PublicKnowledgeQualitySummary;
    unitsByType: Record<KnowledgeUnitType, CompactPublicKnowledgeUnit[]>;
  };
  llmRefinementInput: PublicKnowledgeLlmRefinementInput;
  llmPrompt: {
    system: string;
    user: string;
    outputContract: PublicKnowledgeLlmRefinementInput['outputContract'];
    rawContentIncluded: false;
  };
  review: {
    status: 'not-run';
    mode: 'offline-review';
    reviewPacketHash: string;
    outputContract: PublicKnowledgeLlmRefinementInput['outputContract'];
    unitTypes: KnowledgeUnitType[];
    unitCounts: KnowledgeUnitCountByType;
    missingUnitTypes: KnowledgeUnitType[];
    unitTypeComplete: boolean;
    qualityStatus: PublicKnowledgeQualityStatus;
    qualityScore: number;
    qualityWarningCount: number;
    reviewRequired: true;
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

function parseLibraryArtifact(value: unknown): PublicKnowledgeLibraryArtifact {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-library-artifact') {
    throw new Error('knowledge library-refinement-review requires an infra-agent.public-knowledge-library-artifact input.');
  }

  return value as unknown as PublicKnowledgeLibraryArtifact;
}

function buildWarnings(artifact: PublicKnowledgeLibraryArtifact): string[] {
  const missingUnitTypes = artifact.llmRefinementInput.reviewPacket.missingUnitTypes;

  return [
    ...(artifact.quality.status === 'needs-refinement'
      ? ['Artifact quality is needs-refinement; run the review packet through an LLM before marking it ready.']
      : []),
    ...(missingUnitTypes.length > 0
      ? [`Artifact is missing unit types: ${missingUnitTypes.join(', ')}.`]
      : []),
    ...(artifact.publication.reviewRequired
      ? ['Artifact remains review-required before broad public-library reuse.']
      : []),
    ...(artifact.classification.versionRef.mutable
      ? ['Artifact was classified from a floating version alias; use the content hash and resolved version when reviewing.']
      : [])
  ];
}

function buildPrompt(artifact: PublicKnowledgeLibraryArtifact): PublicKnowledgeLibraryRefinementReviewReport['llmPrompt'] {
  const refinement = artifact.llmRefinementInput;
  const packet = refinement.reviewPacket;
  const unitCounts = KNOWLEDGE_UNIT_TYPES
    .map(unitType => `${unitType}=${packet.unitCounts[unitType]}`)
    .join(', ');

  return {
    system: [
      'You refine public infrastructure knowledge units for infra-agent.',
      'Use only the supplied compact inputs and review packet.',
      'Do not invent provider behavior, defaults, identity fields, replacement risks, diagnostics, or recipes.',
      'Return only JSON matching the requested output contract.'
    ].join(' '),
    user: [
      `Objective: ${refinement.objective}`,
      `Coordinates: ${packet.coordinates}`,
      `Domain: ${packet.ecosystem}`,
      `Artifact kind: ${packet.artifactKind}`,
      `Version: ${packet.version}`,
      `Quality: ${packet.qualityStatus} score=${packet.qualityScore}`,
      `Unit counts: ${unitCounts}`,
      `Missing unit types: ${packet.missingUnitTypes.join(', ') || 'none'}`,
      `Source outline signals: ${packet.sourceOutline.signals.join(', ') || 'none'}`,
      `Download strategy: ${packet.downloadStrategy}; fallback used: ${packet.fallbackUsed ? 'yes' : 'no'}`,
      `Checklist: ${refinement.reviewChecklist.join(' | ')}`,
      `Reject output when: ${refinement.rejectionCriteria.join(' | ')}`,
      `Constraints: ${refinement.constraints.join(' | ')}`,
      'Review the compactInputs and llmRefinementInput fields in this report, then return a refined public-knowledge URL report payload.'
    ].join('\n'),
    outputContract: refinement.outputContract,
    rawContentIncluded: false
  };
}

export async function buildPublicKnowledgeLibraryRefinementReviewReport(
  options: PublicKnowledgeLibraryRefinementReviewOptions
): Promise<PublicKnowledgeLibraryRefinementReviewReport> {
  const inputPath = resolve(options.baseDir, options.artifactPath);
  const payload = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
  const validation = validateKnowledgePayload(payload, inputPath);
  if (!validation.valid || validation.inputKind !== 'infra-agent.public-knowledge-library-artifact') {
    const firstIssue = validation.issues[0];
    throw new Error(firstIssue
      ? `Public library refinement review input is invalid: ${firstIssue.path} ${firstIssue.message}`
      : 'Public library refinement review input must be an infra-agent.public-knowledge-library-artifact payload.');
  }

  const artifact = parseLibraryArtifact(payload);
  const refinement = artifact.llmRefinementInput;
  const reviewPacketHash = sha256(JSON.stringify(refinement.reviewPacket));
  const missingUnitTypes = refinement.reviewPacket.missingUnitTypes;

  return {
    kind: 'infra-agent.public-knowledge-library-refinement-review',
    schemaVersion: 1,
    mutationAllowed: false,
    executionMode: 'offline-llm-review-input',
    inputPath,
    artifact: {
      artifactId: artifact.artifactId,
      coordinates: artifact.coordinates,
      sourceContentHash: artifact.sourceContentHash,
      unitPayloadHash: artifact.unitPayloadHash,
      unitCount: artifact.summary.unitCount,
      unitCounts: artifact.summary.unitCounts,
      includedUnitTypes: artifact.summary.includedUnitTypes,
      compactByteLength: artifact.summary.compactByteLength,
      qualityStatus: artifact.quality.status,
      qualityScore: artifact.quality.score,
      qualityWarnings: artifact.quality.warnings,
      versionRef: artifact.classification.versionRef,
      versionResolution: artifact.classification.versionResolution,
      reviewRequired: true
    },
    classification: artifact.classification,
    compactInputs: {
      inputRefs: refinement.inputRefs,
      classification: artifact.classification,
      download: artifact.download,
      sourceOutline: artifact.sourceOutline,
      summary: artifact.summary,
      quality: artifact.quality,
      unitsByType: artifact.unitsByType
    },
    llmRefinementInput: refinement,
    llmPrompt: buildPrompt(artifact),
    review: {
      status: refinement.status,
      mode: refinement.mode,
      reviewPacketHash,
      outputContract: refinement.outputContract,
      unitTypes: refinement.unitTypes,
      unitCounts: artifact.summary.unitCounts,
      missingUnitTypes,
      unitTypeComplete: missingUnitTypes.length === 0,
      qualityStatus: artifact.quality.status,
      qualityScore: artifact.quality.score,
      qualityWarningCount: artifact.quality.warnings.length,
      reviewRequired: true
    },
    warnings: buildWarnings(artifact)
  };
}
