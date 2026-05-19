import { createHash } from 'node:crypto';
import { parseKnowledgeUnitSet } from './knowledge-unit-contract.ts';
import {
  KNOWLEDGE_UNIT_TYPES,
  type KnowledgeCacheEntry,
  type KnowledgeUnit,
  type KnowledgeUnitSet
} from '../types/knowledge.ts';
import type {
  CompactPublicKnowledgeUnit,
  PublicKnowledgeLibraryArtifact
} from './url-report.ts';

interface PublicLibraryArtifactExtractionOptions {
  extractedAt?: string;
}

function sha256Hex(value: string): string {
  return createHash('sha256')
    .update(value)
    .digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePublicKnowledgeLibraryArtifact(value: unknown): PublicKnowledgeLibraryArtifact {
  if (!isRecord(value) || value.kind !== 'infra-agent.public-knowledge-library-artifact') {
    throw new Error('public knowledge library artifact kind must be infra-agent.public-knowledge-library-artifact.');
  }

  if (
    value.schemaVersion !== 1
    || value.mutationAllowed !== false
    || value.storageScope !== 'public-reference'
    || value.privacyScope !== 'public-reference'
    || !isRecord(value.unitsByType)
    || !isRecord(value.summary)
    || !isRecord(value.publication)
    || value.publication.status !== 'local-artifact'
    || value.publication.downloadable !== true
    || value.publication.uploadRequired !== false
    || value.publication.reviewRequired !== true
  ) {
    throw new Error('public knowledge library artifact publication posture is invalid.');
  }

  return value as unknown as PublicKnowledgeLibraryArtifact;
}

function flattenCompactUnits(artifact: PublicKnowledgeLibraryArtifact): CompactPublicKnowledgeUnit[] {
  return KNOWLEDGE_UNIT_TYPES.flatMap(unitType => {
    const units = artifact.unitsByType[unitType];
    return Array.isArray(units) ? units : [];
  });
}

function assertArtifactCoherence(artifact: PublicKnowledgeLibraryArtifact): void {
  const unitPayload = JSON.stringify(artifact.unitsByType);
  if (artifact.unitPayloadHash !== sha256Hex(unitPayload)) {
    throw new Error('public knowledge library artifact unitPayloadHash does not match unitsByType.');
  }

  const units = flattenCompactUnits(artifact);
  if (artifact.summary.unitCount !== units.length) {
    throw new Error('public knowledge library artifact summary unitCount does not match unitsByType.');
  }
}

function rebasePublicLibraryUnit(
  entry: KnowledgeCacheEntry,
  unit: CompactPublicKnowledgeUnit
): KnowledgeUnit {
  const {
    sourceId: _sourceId,
    sourceLocator,
    ...unitWithoutCompactSource
  } = unit;

  return {
    ...unitWithoutCompactSource,
    source: {
      id: entry.id,
      source: entry.source,
      contentHash: entry.contentHash,
      locator: sourceLocator
    }
  } as KnowledgeUnit;
}

export function extractPublicKnowledgeLibraryUnitSetFromCacheEntry(
  entry: KnowledgeCacheEntry,
  options: PublicLibraryArtifactExtractionOptions = {}
): KnowledgeUnitSet {
  const artifact = parsePublicKnowledgeLibraryArtifact(JSON.parse(entry.content) as unknown);
  assertArtifactCoherence(artifact);

  const units = flattenCompactUnits(artifact).map(unit => rebasePublicLibraryUnit(entry, unit));
  const unitSet = {
    kind: 'infra-agent.knowledge-units',
    schemaVersion: 1,
    mutationAllowed: false,
    sourceId: entry.id,
    source: entry.source,
    sourceContentHash: entry.contentHash,
    extractedAt: options.extractedAt ?? new Date().toISOString(),
    unitCount: units.length,
    units
  } satisfies KnowledgeUnitSet;

  return parseKnowledgeUnitSet(unitSet);
}
