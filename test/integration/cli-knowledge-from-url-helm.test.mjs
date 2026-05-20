import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import {
  buildPublicKnowledgeLibraryArtifact,
  buildPublicKnowledgeUrlReport
} from '../../src/knowledge/url-report.ts';
import { validateKnowledgePayload } from '../../src/knowledge/validate.ts';

const HELM_KUBE_PROMETHEUS_STACK_URL = 'https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/';
const HELM_KUBE_PROMETHEUS_STACK_API_URL = 'https://artifacthub.io/api/v1/packages/helm/prometheus-community/kube-prometheus-stack';

const HELM_KUBE_PROMETHEUS_STACK_MARKDOWN = [
  '# kube-prometheus-stack',
  '',
  'Installs core components of the kube-prometheus stack with Prometheus Operator, Grafana dashboards, and Prometheus rules.',
  '',
  '## Values',
  '',
  '| Key | Type | Default | Description |',
  '| --- | --- | --- | --- |',
  '| `grafana.enabled` | bool | `true` | Whether to deploy Grafana with the chart. |',
  '| `prometheus.prometheusSpec.retention` | string | `10d` | Retention period for Prometheus data. |',
  '| `alertmanager.enabled` | bool | `true` | Whether to deploy Alertmanager with the stack. |',
  '',
  '## Example Values',
  '',
  '```yaml',
  'grafana:',
  '  enabled: true',
  'prometheus:',
  '  prometheusSpec:',
  '    retention: 10d',
  '```',
  '',
  '## Compatibility Warnings',
  '',
  'CRDs must be reviewed during chart upgrades because Kubernetes ownership and Prometheus Operator API compatibility can affect rendered manifests.',
  '',
  '## Upgrade Workflow',
  '',
  '1. Render the chart with helm template and the selected values files.',
  '2. Review CRD and ownership changes before merge.',
  '3. Run helm diff or the repository validator before applying changes.',
  '',
  '## Troubleshooting',
  '',
  '`rendered manifests contain a resource that already exists` usually means a Kubernetes object is owned by a different release or namespace.',
  '',
  '- Review Helm ownership annotations on the existing object.',
  '- Confirm the release name and destination namespace before changing values.',
  ''
].join('\n');

test('knowledge from-url emits Artifact Hub Helm chart public-library context', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-from-url-helm-'));

  try {
    const contentPath = join(tempRoot, 'kube-prometheus-stack.md');
    await writeFile(contentPath, HELM_KUBE_PROMETHEUS_STACK_MARKDOWN, 'utf8');

    const report = await buildPublicKnowledgeUrlReport({
      url: HELM_KUBE_PROMETHEUS_STACK_URL,
      contentPath,
      maxUnits: 20
    });
    const artifact = buildPublicKnowledgeLibraryArtifact(report);
    const reportValidation = validateKnowledgePayload(report, 'inline');
    const artifactValidation = validateKnowledgePayload(artifact, 'inline');

    assert.equal(report.domain, 'helm');
    assert.equal(report.source.kind, 'chart-docs');
    assert.equal(report.source.name, 'chart-docs:prometheus-community/kube-prometheus-stack');
    assert.equal(report.source.chart, 'kube-prometheus-stack');
    assert.equal(report.source.version, 'unversioned');
    assert.equal(report.download.mode, 'local-content');
    assert.deepEqual(report.sourceOutline.signals, [
      'argument-reference',
      'example-usage'
    ]);
    assert.equal(report.centralLibraryCandidate.classification.ecosystem, 'helm');
    assert.equal(report.centralLibraryCandidate.classification.artifactKind, 'helm-chart-docs');
    assert.equal(
      report.centralLibraryCandidate.classification.coordinates,
      'helm/chart/prometheus-community/kube-prometheus-stack/unversioned'
    );
    assert.equal(report.centralLibraryCandidate.classification.providerAddress, 'prometheus-community/kube-prometheus-stack');
    assert.equal(report.centralLibraryCandidate.classification.repository, 'prometheus-community');
    assert.equal(report.centralLibraryCandidate.classification.chart, 'kube-prometheus-stack');
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('chart-docs'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('prometheus-community'));
    assert.ok(report.centralLibraryCandidate.classification.tags.includes('kube-prometheus-stack'));
    assert.deepEqual(report.centralLibraryCandidate.classification.versionRef, {
      value: 'unversioned',
      kind: 'pinned-version',
      mutable: false,
      source: 'url-path'
    });
    assert.deepEqual(report.centralLibraryCandidate.classification.versionResolution, {
      requestedVersion: 'unversioned',
      resolvedVersion: 'unversioned',
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    });
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.ecosystem, 'helm');
    assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.artifactKind, 'helm-chart-docs');
    assert.ok(report.unitsByType.fact.some(unit =>
      unit.path === 'chart.kube-prometheus-stack.grafana.enabled'
      && unit.factKind === 'chart-value'
      && unit.defaultValue === 'true'
    ));
    assert.ok(report.unitsByType.example.some(unit =>
      unit.exampleType === 'helm-docs-example'
      && unit.language === 'yaml'
      && /grafana: enabled: true/.test(unit.snippet)
    ));
    assert.ok(report.unitsByType.diagnostic.some(unit =>
      unit.engine === 'helm'
      && unit.signature === 'rendered manifests contain a resource that already exists'
    ));
    assert.ok(report.unitsByType.recipe.some(unit =>
      /Helm|Upgrade Workflow/.test(unit.name)
      && unit.mutationAllowed === false
    ));
    assert.equal(report.summary.unitTypeComplete, true);
    assert.equal(report.summary.qualityStatus, 'ready');
    assert.equal(artifact.classification.artifactKind, 'helm-chart-docs');
    assert.equal(reportValidation.valid, true);
    assert.equal(artifactValidation.valid, true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge from-url fetches Artifact Hub Helm chart docs through primary official URL only', async () => {
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);
    assert.equal(url, HELM_KUBE_PROMETHEUS_STACK_URL);

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get(name) {
          return name.toLowerCase() === 'content-type' ? 'text/markdown' : null;
        }
      },
      async text() {
        return HELM_KUBE_PROMETHEUS_STACK_MARKDOWN;
      }
    };
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: HELM_KUBE_PROMETHEUS_STACK_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const validation = validateKnowledgePayload(report, 'inline');

  assert.deepEqual(requestedUrls, [HELM_KUBE_PROMETHEUS_STACK_URL]);
  assert.equal(report.download.mode, 'live-fetch');
  assert.equal(report.download.strategy, 'official-url-primary-only');
  assert.equal(report.download.usedRole, 'primary');
  assert.equal(report.download.fallbackUsed, false);
  assert.equal(report.download.usedUrl, HELM_KUBE_PROMETHEUS_STACK_URL);
  assert.equal(report.download.attemptedCount, 1);
  assert.equal(report.download.attempts[0].role, 'primary');
  assert.equal(report.download.attempts[0].status, 'used');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, 'official-url-primary-only');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, 0);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl, HELM_KUBE_PROMETHEUS_STACK_URL);
  assert.equal(validation.valid, true);
});

test('knowledge from-url falls back to Artifact Hub package API readme when chart page is not extractable', async () => {
  const requestedUrls = [];
  const fetchImpl = async url => {
    requestedUrls.push(url);

    if (url === HELM_KUBE_PROMETHEUS_STACK_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'text/html' : null;
          }
        },
        async text() {
          return '<html><body>Please enable Javascript to use this application</body></html>';
        }
      };
    }

    if (url === HELM_KUBE_PROMETHEUS_STACK_API_URL) {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get(name) {
            return name.toLowerCase() === 'content-type' ? 'application/json' : null;
          }
        },
        async text() {
          return JSON.stringify({
            name: 'kube-prometheus-stack',
            repository: { name: 'prometheus-community' },
            readme: HELM_KUBE_PROMETHEUS_STACK_MARKDOWN
          });
        }
      };
    }

    throw new Error(`Unexpected URL ${url}`);
  };

  const report = await buildPublicKnowledgeUrlReport({
    url: HELM_KUBE_PROMETHEUS_STACK_URL,
    fetchImpl,
    maxUnits: 20,
    now: new Date('2026-05-18T00:00:00.000Z')
  });
  const artifact = buildPublicKnowledgeLibraryArtifact(report);
  const reportValidation = validateKnowledgePayload(report, 'inline');
  const artifactValidation = validateKnowledgePayload(artifact, 'inline');

  assert.deepEqual(requestedUrls, [
    HELM_KUBE_PROMETHEUS_STACK_URL,
    HELM_KUBE_PROMETHEUS_STACK_API_URL
  ]);
  assert.equal(report.download.mode, 'live-fetch');
  assert.equal(report.download.strategy, 'artifacthub-page-then-package-api-readme');
  assert.equal(report.download.usedRole, 'fallback');
  assert.equal(report.download.fallbackUsed, true);
  assert.equal(report.download.usedUrl, HELM_KUBE_PROMETHEUS_STACK_API_URL);
  assert.equal(report.download.usedContentType, 'text/markdown');
  assert.equal(report.download.attemptedCount, 2);
  assert.equal(report.download.attempts[0].role, 'primary');
  assert.equal(report.download.attempts[0].status, 'rejected');
  assert.equal(report.download.attempts[0].reason, 'content-not-extractable');
  assert.equal(report.download.attempts[1].role, 'fallback');
  assert.equal(report.download.attempts[1].status, 'used');
  assert.equal(report.source.url, HELM_KUBE_PROMETHEUS_STACK_URL);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadStrategy, 'artifacthub-page-then-package-api-readme');
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.selectedAttemptIndex, 1);
  assert.equal(report.centralLibraryCandidate.llmRefinementInput.reviewPacket.downloadEvidence.usedUrl, HELM_KUBE_PROMETHEUS_STACK_API_URL);
  assert.equal(report.summary.unitTypeComplete, true);
  assert.ok(report.unitsByType.fact.some(unit =>
    unit.path === 'chart.kube-prometheus-stack.grafana.enabled'
    && unit.factKind === 'chart-value'
  ));
  assert.equal(reportValidation.valid, true);
  assert.equal(artifactValidation.valid, true);
});
