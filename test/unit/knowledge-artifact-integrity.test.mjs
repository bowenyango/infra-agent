import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve
} from 'node:path';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import {
  buildKnowledgeArtifactManifest,
  hashKnowledgeArtifactFile
} from '../../src/knowledge/artifact-manifest.ts';
import { buildKnowledgePack } from '../../src/knowledge/pack.ts';
import { loadKnowledgeValidationReport } from '../../src/knowledge/validate.ts';

async function buildHelmKnowledgePack(workspaceRoot) {
  const inspection = await inspectWorkspace(workspaceRoot);
  return buildKnowledgePack(inspection, {
    domains: ['helm'],
    targetPaths: ['charts/payments-api'],
    maxFacts: 4
  });
}

async function writePackWithManifest(tempRoot, pack) {
  const artifactPath = join(tempRoot, 'knowledge-pack.json');
  await writeFile(artifactPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
  const manifest = buildKnowledgeArtifactManifest(pack, {
    artifactPath,
    artifactSha256: await hashKnowledgeArtifactFile(artifactPath),
    createdAt: '2026-05-06T00:00:00.000Z'
  });
  const manifestPath = join(tempRoot, 'knowledge-pack.manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    artifactPath,
    manifest,
    manifestPath
  };
}

test('knowledge artifact manifest validation rejects byte drift in the referenced artifact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-artifact-integrity-'));

  try {
    const pack = await buildHelmKnowledgePack('fixtures/sample-workspace');
    const { artifactPath, manifestPath } = await writePackWithManifest(tempRoot, pack);

    const validReport = await loadKnowledgeValidationReport(manifestPath, tempRoot);
    assert.equal(validReport.valid, true);

    await writeFile(artifactPath, `${JSON.stringify(pack, null, 2)}\n `, 'utf8');
    const driftReport = await loadKnowledgeValidationReport(manifestPath, tempRoot);

    assert.equal(driftReport.valid, false);
    assert.ok(driftReport.issues.some(issue => issue.path === '$.artifact.sha256'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge artifact manifest validation rejects metadata drift from the referenced artifact', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-artifact-metadata-'));

  try {
    const pack = await buildHelmKnowledgePack('fixtures/sample-workspace');
    const { manifest, manifestPath } = await writePackWithManifest(tempRoot, pack);
    await writeFile(manifestPath, `${JSON.stringify({
      ...manifest,
      artifact: {
        ...manifest.artifact,
        sourceIds: ['forged-source'],
        sourceCount: manifest.artifact.sourceCount + 1
      }
    }, null, 2)}\n`, 'utf8');

    const report = await loadKnowledgeValidationReport(manifestPath, tempRoot);

    assert.equal(report.valid, false);
    assert.ok(report.issues.some(issue => issue.path === '$.artifact.sourceIds'));
    assert.ok(report.issues.some(issue => issue.path === '$.artifact.sourceCount'));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack validation rechecks local source fingerprints with a workspace', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-freshness-'));

  try {
    const workspaceRoot = join(tempRoot, 'workspace');
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    const pack = await buildHelmKnowledgePack(workspaceRoot);
    const packPath = join(tempRoot, 'knowledge-pack.json');
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');

    const freshReport = await loadKnowledgeValidationReport(packPath, tempRoot, {
      workspaceRoot
    });
    assert.equal(freshReport.valid, true);

    const chartPath = join(workspaceRoot, 'charts/payments-api/Chart.yaml');
    const chartContent = await readFile(chartPath, 'utf8');
    await writeFile(chartPath, `${chartContent}\n# drift\n`, 'utf8');
    const staleReport = await loadKnowledgeValidationReport(packPath, tempRoot, {
      workspaceRoot
    });

    assert.equal(staleReport.valid, false);
    assert.ok(staleReport.staleSourceCount > 0);
    assert.ok(staleReport.issues.some(issue =>
      issue.path.startsWith('$.sources[')
      && /local-file-hash-mismatch/.test(issue.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('knowledge pack validation detects missing local fingerprint files', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-knowledge-pack-missing-fingerprint-'));

  try {
    const workspaceRoot = join(tempRoot, 'workspace');
    await cp('fixtures/sample-workspace', workspaceRoot, { recursive: true });
    const pack = await buildHelmKnowledgePack(workspaceRoot);
    const packPath = join(tempRoot, 'knowledge-pack.json');
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
    await rm(join(workspaceRoot, 'charts/payments-api/values.schema.json'), {
      force: true
    });

    const report = await loadKnowledgeValidationReport(packPath, tempRoot, {
      workspaceRoot
    });

    assert.equal(report.valid, false);
    assert.ok(report.issues.some(issue =>
      issue.path.startsWith('$.sources[')
      && /local-file-missing/.test(issue.message)
    ));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
