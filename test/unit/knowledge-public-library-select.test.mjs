import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publicLibraryEntryMatchesSelector,
  resolvePublicKnowledgeLibraryRegistryEntrySelection
} from '../../src/knowledge/public-library-select.ts';

const baseEntry = {
  version: 'unversioned',
  versionRef: {
    value: 'unversioned',
    kind: 'pinned-version',
    mutable: false,
    source: 'url-path'
  },
  versionResolution: {
    requestedVersion: 'unversioned',
    resolvedVersion: 'unversioned',
    status: 'pinned',
    mutable: false,
    source: 'url-path'
  },
  tags: ['public-reference'],
  llmRefinement: {
    status: 'not-run',
    mode: 'offline-review',
    inputRef: 'artifact.llmRefinementInput',
    reviewPacketHash: 'a'.repeat(64),
    outputContract: 'infra-agent.public-knowledge-url-report',
    unitTypes: ['fact', 'guidance', 'example', 'diagnostic', 'recipe'],
    unitCounts: {
      fact: 1,
      guidance: 1,
      example: 1,
      diagnostic: 1,
      recipe: 1
    },
    missingUnitTypes: [],
    qualityStatus: 'ready',
    qualityScore: 100,
    qualityWarningCount: 0,
    reviewRequired: true
  },
  artifact: {
    path: 'knowledge/public-library/example.json',
    contentHash: 'b'.repeat(64),
    mediaType: 'application/vnd.infra-agent.public-knowledge-library-artifact+json',
    artifactId: 'artifact-id',
    unitPayloadHash: 'c'.repeat(64),
    sourceContentHash: 'd'.repeat(64),
    unitCount: 5,
    qualityStatus: 'ready',
    versionRef: {
      value: 'unversioned',
      kind: 'pinned-version',
      mutable: false,
      source: 'url-path'
    },
    versionResolution: {
      requestedVersion: 'unversioned',
      resolvedVersion: 'unversioned',
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    },
    reviewRequired: true
  }
};

function entry(overrides) {
  return {
    ...baseEntry,
    ...overrides,
    artifact: {
      ...baseEntry.artifact,
      ...(overrides.artifact ?? {})
    },
    llmRefinement: {
      ...baseEntry.llmRefinement,
      ...(overrides.llmRefinement ?? {})
    }
  };
}

test('public library selector matches deterministic Terraform resource aliases', () => {
  const terraformEntry = entry({
    coordinates: 'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket',
    ecosystem: 'terraform',
    artifactKind: 'terraform-provider-resource',
    providerAddress: 'hashicorp/aws',
    version: '5.37.0',
    versionRef: {
      value: '5.37.0',
      kind: 'pinned-version',
      mutable: false,
      source: 'url-path'
    },
    versionResolution: {
      requestedVersion: '5.37.0',
      resolvedVersion: '5.37.0',
      status: 'pinned',
      mutable: false,
      source: 'url-path'
    },
    sourceName: 'resource:aws_s3_bucket'
  });

  assert.equal(publicLibraryEntryMatchesSelector(terraformEntry, {
    domains: ['terraform'],
    provider: 'hashicorp/aws',
    resource: 'aws_s3_bucket'
  }), true);
  assert.equal(publicLibraryEntryMatchesSelector(terraformEntry, {
    resource: 'resource:aws_s3_bucket'
  }), true);
});

test('public library selector matches deterministic Pulumi package and resource aliases', () => {
  const pulumiEntry = entry({
    coordinates: 'pulumi/package/@pulumi/aws/unversioned/resource/aws:s3/bucket:Bucket',
    ecosystem: 'pulumi',
    artifactKind: 'pulumi-package-resource',
    providerAddress: '@pulumi/aws',
    sourceName: 'aws:s3/bucket:Bucket',
    resourceToken: 'aws:s3/bucket:Bucket'
  });

  assert.equal(publicLibraryEntryMatchesSelector(pulumiEntry, {
    domains: ['pulumi'],
    packageName: 'aws',
    resource: 's3/bucket'
  }), true);
  assert.equal(publicLibraryEntryMatchesSelector(pulumiEntry, {
    packageName: '@pulumi/aws',
    resource: 'Bucket'
  }), true);
  assert.equal(publicLibraryEntryMatchesSelector(pulumiEntry, {
    resource: 'aws:s3/bucket'
  }), true);
});

test('public library selector matches Helm chart and repository/chart aliases', () => {
  const helmEntry = entry({
    coordinates: 'helm/chart/prometheus-community/kube-prometheus-stack/unversioned',
    ecosystem: 'helm',
    artifactKind: 'helm-chart-docs',
    providerAddress: 'prometheus-community/kube-prometheus-stack',
    sourceName: 'chart:kube-prometheus-stack',
    chart: 'kube-prometheus-stack'
  });

  assert.equal(publicLibraryEntryMatchesSelector(helmEntry, {
    domains: ['helm'],
    chart: 'kube-prometheus-stack'
  }), true);
  assert.equal(publicLibraryEntryMatchesSelector(helmEntry, {
    chart: 'prometheus-community/kube-prometheus-stack'
  }), true);
});

test('public library selector reports ambiguous candidates before selection succeeds', () => {
  const first = entry({
    coordinates: 'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket',
    ecosystem: 'terraform',
    artifactKind: 'terraform-provider-resource',
    providerAddress: 'hashicorp/aws',
    version: '5.37.0',
    sourceName: 'resource:aws_s3_bucket'
  });
  const second = entry({
    coordinates: 'terraform/provider/hashicorp/aws/5.37.0/resource/aws_s3_bucket_policy',
    ecosystem: 'terraform',
    artifactKind: 'terraform-provider-resource',
    providerAddress: 'hashicorp/aws',
    version: '5.37.0',
    sourceName: 'resource:aws_s3_bucket_policy'
  });

  assert.throws(
    () => resolvePublicKnowledgeLibraryRegistryEntrySelection([first, second], {
      filter: {
        domains: ['terraform'],
        provider: 'hashicorp/aws'
      }
    }),
    /selector matched 2 entries/
  );
});
