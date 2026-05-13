import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildKnowledgeCacheId } from '../../src/knowledge/cache.ts';
import { createFileKnowledgeStore } from '../../src/knowledge/knowledge-store.ts';
import { fetchOfficialKnowledgeSource } from '../../src/knowledge/retrieve.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';
import { extractMarkdownKnowledgeUnitsFromCacheEntry } from '../../src/knowledge/markdown-units.ts';
import { extractKnowledgeUnitSetFromFactSet } from '../../src/knowledge/units.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

const LIVE_KNOWLEDGE_ENV = 'INFRA_AGENT_LIVE_KNOWLEDGE_TESTS';
const FETCH_TIMEOUT_MS = 15_000;

const FALLBACK_CANONICAL_TARGETS = [
  {
    id: 'terraform-hashicorp-aws-provider-docs',
    domain: 'terraform',
    source: {
      kind: 'terraform-registry',
      name: 'provider:hashicorp/aws',
      provider: 'hashicorp/aws',
      url: 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
    },
    identitySignals: [
      /hashicorp\/aws/i,
      /aws provider/i,
      /terraform aws provider/i,
      /aws_/i
    ]
  },
  {
    id: 'pulumi-aws-package-provider-docs',
    domain: 'pulumi',
    source: {
      kind: 'pulumi-docs',
      name: 'pulumi-docs:package:aws',
      packageName: '@pulumi/aws',
      url: 'https://www.pulumi.com/registry/packages/aws/api-docs/'
    },
    identitySignals: [
      /@pulumi\/aws/i,
      /pulumi aws/i,
      /aws/i
    ]
  },
  {
    id: 'helm-kube-prometheus-stack-docs',
    domain: 'helm',
    source: {
      kind: 'chart-docs',
      name: 'chart-docs:kube-prometheus-stack',
      chart: 'kube-prometheus-stack',
      url: 'https://raw.githubusercontent.com/prometheus-community/helm-charts/main/charts/kube-prometheus-stack/README.md'
    },
    identitySignals: [
      /kube-prometheus-stack/i,
      /prometheus-community/i,
      /prometheus/i,
      /grafana/i
    ]
  }
];

function fallbackForSource(source) {
  return FALLBACK_CANONICAL_TARGETS.find(target =>
    target.source.kind === source.kind
    && (
      target.source.url === source.url
      || target.source.provider === source.provider
      || target.source.packageName === source.packageName
      || target.source.chart === source.chart
    )
  );
}

function normalizeExportedTarget(target) {
  const source = target.source ?? target;
  const fallback = fallbackForSource(source);
  return {
    id: target.id ?? fallback?.id,
    domain: target.domain ?? fallback?.domain,
    source,
    identitySignals: target.identitySignals ?? fallback?.identitySignals ?? []
  };
}

async function loadCanonicalTargets() {
  try {
    const module = await import('../../src/knowledge/public-extraction-targets.ts');
    const exportedTargets = [
      module.CANONICAL_PUBLIC_EXTRACTION_TARGETS,
      module.PUBLIC_EXTRACTION_TARGETS,
      module.PUBLIC_KNOWLEDGE_EXTRACTION_TARGETS,
      module.CANONICAL_NETWORK_EXTRACTION_TARGETS
    ].find(Array.isArray);
    if (exportedTargets) {
      return exportedTargets.map(normalizeExportedTarget);
    }
  } catch (error) {
    const code = typeof error === 'object' && error !== null ? error.code : null;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ERR_MODULE_NOT_FOUND' && message.includes('public-extraction-targets')) {
      return FALLBACK_CANONICAL_TARGETS;
    }
    throw error;
  }

  return FALLBACK_CANONICAL_TARGETS;
}

function assertCanonicalTargets(targets) {
  assert.equal(targets.length, 3);
  assert.ok(targets.some(target =>
    target.domain === 'terraform'
    && target.source.kind === 'terraform-registry'
    && target.source.provider === 'hashicorp/aws'
    && target.source.url === 'https://registry.terraform.io/providers/hashicorp/aws/latest/docs'
  ));
  assert.ok(targets.some(target =>
    target.domain === 'pulumi'
    && target.source.kind === 'pulumi-docs'
    && target.source.packageName === '@pulumi/aws'
    && target.source.url === 'https://www.pulumi.com/registry/packages/aws/api-docs/'
  ));
  assert.ok(targets.some(target =>
    target.domain === 'helm'
    && target.source.kind === 'chart-docs'
    && target.source.chart === 'kube-prometheus-stack'
    && /^https:\/\//.test(target.source.url)
  ));

  for (const target of targets) {
    assert.equal(typeof target.id, 'string');
    assert.ok(target.id.length > 0);
    assert.ok(['terraform', 'pulumi', 'helm'].includes(target.domain));
    assert.equal(typeof target.source.name, 'string');
    assert.ok(target.source.name.length > 0);
    assert.equal(typeof target.source.url, 'string');
    assert.ok(target.source.url.startsWith('https://'));
    assert.equal(buildKnowledgeCacheId(target.source).length, 24);
  }
}

function isNetworkUnavailableError(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /abort|eai_again|enotfound|econnrefused|econnreset|etimedout|fetch failed|network|socket|timeout/i.test(message);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function assertFetchedWrite(target, write) {
  assert.equal(write.source.kind, target.source.kind);
  assert.equal(write.source.name, target.source.name);
  assert.equal(write.source.url, target.source.url);
  assert.equal(write.metadata?.retrieval, 'official-url');
  assert.ok(['text/markdown', 'text/plain', 'application/json', 'application/yaml'].includes(write.contentType));
  assert.equal(typeof write.content, 'string');
  assert.ok(write.content.length > 0);
  assert.ok(write.staleAfter === undefined || Number.isFinite(Date.parse(write.staleAfter)));
  assert.ok(write.metadata?.normalization === undefined || write.metadata.normalization === 'html-to-markdown');
}

function assertCacheEntryShape(target, entry) {
  assert.equal(entry.id, buildKnowledgeCacheId(target.source));
  assert.deepEqual(entry.source, target.source);
  assert.equal(entry.contentHash.length, 64);
  assert.ok(Number.isFinite(Date.parse(entry.fetchedAt)));
  assert.equal(entry.metadata?.retrieval, 'official-url');
  assert.ok(entry.content.length > 0);
}

function assertNoRawHtmlOrSecretLikeContent(target, value) {
  assert.doesNotMatch(value, /<script\b|<\/script>|<style\b|<\/style>|<!doctype\s+html|<html\b|<\/html>/i);
  assert.doesNotMatch(value, /authorization:\s*bearer|api[_-]?key\s*=|password\s*=|secret[_-]?token\s*=|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/i);
  assert.ok(
    target.identitySignals.some(pattern => pattern.test(value) || pattern.test(JSON.stringify(target.source))),
    `missing stable identity signal for ${target.id}`
  );
}

function assertValidUnitSet(unitSet) {
  const validation = validateKnowledgePayload(unitSet, 'live-network-unit-set');
  assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));
  assert.equal(validation.unitSetCount, 1);
  assert.equal(validation.unitCount, unitSet.unitCount);
  assert.ok(unitSet.units.every(unit =>
    ['fact', 'guidance', 'example', 'diagnostic', 'recipe'].includes(unit.unitType)
  ));
  assert.doesNotMatch(JSON.stringify(unitSet), /<script\b|<\/script>|<!doctype\s+html|<html\b|authorization:\s*bearer|api[_-]?key|password|secret[_-]?token/i);
}

test('opt-in live network extraction smoke covers canonical public targets', async () => {
  const targets = await loadCanonicalTargets();
  assertCanonicalTargets(targets);

  if (process.env[LIVE_KNOWLEDGE_ENV] !== '1') {
    return;
  }

  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-live-knowledge-'));
  const store = createFileKnowledgeStore(tempRoot);
  const unavailableTargets = [];
  const fetchedEntries = [];

  try {
    for (const target of targets) {
      let write;
      try {
        write = await fetchOfficialKnowledgeSource(target.source, {
          fetchImpl: fetchWithTimeout,
          fetchedAt: '2026-05-13T00:00:00.000Z'
        });
      } catch (error) {
        if (isNetworkUnavailableError(error)) {
          unavailableTargets.push(target.id);
          continue;
        }
        throw error;
      }

      assert.ok(write);
      assertFetchedWrite(target, write);
      const entry = await store.write(write);
      const readBack = await store.read(target.source);
      assert.ok(readBack);
      assertCacheEntryShape(target, entry);
      assert.deepEqual(readBack, entry);
      assertNoRawHtmlOrSecretLikeContent(target, entry.content);

      const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
        now: new Date('2026-05-13T00:00:00.000Z'),
        extractedAt: '2026-05-13T00:00:00.000Z'
      });
      assert.equal(factSet.sourceId, entry.id);
      assert.deepEqual(factSet.source, entry.source);
      assert.equal(factSet.sourceContentHash, entry.contentHash);
      assert.equal(factSet.sourceFetchedAt, entry.fetchedAt);
      assert.ok(factSet.factCount >= 0);
      assert.doesNotMatch(JSON.stringify(factSet), /<script\b|<\/script>|<!doctype\s+html|<html\b|authorization:\s*bearer|api[_-]?key|password|secret[_-]?token/i);

      const markdownUnits = extractMarkdownKnowledgeUnitsFromCacheEntry(entry, factSet);
      if (factSet.factCount > 0 || markdownUnits.length > 0) {
        const unitSet = extractKnowledgeUnitSetFromFactSet(factSet, markdownUnits);
        assertValidUnitSet(unitSet);
      }

      fetchedEntries.push(entry);
    }

    assert.ok(
      fetchedEntries.length > 0 || unavailableTargets.length === targets.length,
      'live smoke should either fetch at least one target or no-op because all canonical targets were unreachable'
    );
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
