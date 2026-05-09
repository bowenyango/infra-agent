import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  contentLooksLikeHtml,
  decodeHtmlEntities,
  htmlToMarkdown,
  normalizeOfficialKnowledgeContent
} from '../../src/knowledge/official-doc-normalize.ts';
import { fetchOfficialKnowledgeSource } from '../../src/knowledge/retrieve.ts';
import { writeKnowledgeCacheEntry } from '../../src/knowledge/cache.ts';
import { extractKnowledgeFactSetFromCacheEntry } from '../../src/knowledge/facts.ts';

test('official doc normalization detects HTML by content type and document shape', () => {
  assert.equal(contentLooksLikeHtml('# Markdown', 'text/markdown'), false);
  assert.equal(contentLooksLikeHtml('<!doctype html><html></html>', 'text/plain'), true);
  assert.equal(contentLooksLikeHtml('<main><h1>Docs</h1></main>', null), true);
  assert.equal(contentLooksLikeHtml('# Docs\n\n- item', null), false);
  assert.equal(contentLooksLikeHtml('# Docs', 'text/html; charset=utf-8'), true);
});

test('official doc normalization decodes common HTML entities', () => {
  assert.equal(
    decodeHtmlEntities('Use &lt;code&gt;, A&amp;B, &#35; heading, and &#x2713;.'),
    'Use <code>, A&B, # heading, and \u2713.'
  );
});

test('official doc normalization converts common HTML blocks to Markdown', () => {
  const normalized = normalizeOfficialKnowledgeContent({
    contentType: 'text/plain',
    contentTypeHeader: 'text/html',
    content: [
      '<!doctype html>',
      '<html>',
      '<head><style>.hidden { display: none; }</style><script>alert("x")</script></head>',
      '<body>',
      '<main>',
      '<h1>Pulumi AWS Bucket</h1>',
      '<p>Create <code>aws.s3.Bucket</code> resources &amp; configure inputs.</p>',
      '<ul>',
      '<li><a href="/registry/">bucket</a> - Name of the bucket.</li>',
      '<li><code>acl</code> - Canned ACL to apply.</li>',
      '</ul>',
      '</main>',
      '</body>',
      '</html>'
    ].join('')
  });

  assert.equal(normalized.contentType, 'text/markdown');
  assert.equal(normalized.normalized, true);
  assert.equal(normalized.normalization, 'html-to-markdown');
  assert.match(normalized.content, /^# Pulumi AWS Bucket/m);
  assert.match(normalized.content, /Create `aws\.s3\.Bucket` resources & configure inputs\./);
  assert.match(normalized.content, /- bucket - Name of the bucket\./);
  assert.match(normalized.content, /- `acl` - Canned ACL to apply\./);
  assert.doesNotMatch(normalized.content, /script|style|alert|href|<main|<\/html>/i);
});

test('official doc normalization passes through non-HTML content', () => {
  const content = '# Docs\n\n- `field` - A field.';
  const normalized = normalizeOfficialKnowledgeContent({
    contentType: 'text/markdown',
    contentTypeHeader: 'text/markdown',
    content
  });

  assert.equal(normalized.contentType, 'text/markdown');
  assert.equal(normalized.content, content);
  assert.equal(normalized.normalized, false);
  assert.equal(normalized.normalization, undefined);
});

test('official knowledge fetcher normalizes HTML responses before cache writes', async () => {
  const source = {
    kind: 'pulumi-docs',
    name: 'pulumi-docs:resource:aws:s3/bucket',
    packageName: '@pulumi/aws',
    module: 'aws:s3/bucket:Bucket',
    url: 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
  };
  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-05-09T00:00:00.000Z',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null
      },
      text: async () => [
        '<!doctype html>',
        '<html><body>',
        '<script>window.secretToken = "hidden";</script>',
        '<h1>Bucket</h1>',
        '<table>',
        '<tr><th>Name</th><th>Type</th><th>Description</th></tr>',
        '<tr><td><code>bucket</code></td><td>string</td><td>Name of the bucket to create.</td></tr>',
        '</table>',
        '</body></html>'
      ].join('')
    })
  });

  assert.ok(fetched);
  assert.equal(fetched.contentType, 'text/markdown');
  assert.equal(fetched.staleAfter, '2026-06-08T00:00:00.000Z');
  assert.equal(fetched.metadata?.retrieval, 'official-url');
  assert.equal(fetched.metadata?.normalization, 'html-to-markdown');
  assert.match(fetched.content, /^# Bucket/m);
  assert.match(fetched.content, /\| `bucket` \| string \| Name of the bucket to create\. \|/);
  assert.doesNotMatch(fetched.content, /<html|<script|secretToken|contentHash|authorization/i);
});

test('official knowledge fetcher preserves non-HTML markdown responses', async () => {
  const source = {
    kind: 'chart-docs',
    name: 'api:home',
    chart: 'api',
    url: 'https://charts.example.test/api/'
  };
  const content = '# API chart\n\n- `image.repository` - Container image repository.';
  const fetched = await fetchOfficialKnowledgeSource(source, {
    fetchedAt: '2026-05-09T00:00:00.000Z',
    staleAfter: '2026-05-20T00:00:00.000Z',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: name => name.toLowerCase() === 'content-type' ? 'text/markdown' : null
      },
      text: async () => content
    })
  });

  assert.ok(fetched);
  assert.equal(fetched.contentType, 'text/markdown');
  assert.equal(fetched.content, content);
  assert.equal(fetched.staleAfter, '2026-05-20T00:00:00.000Z');
  assert.equal(fetched.metadata?.retrieval, 'official-url');
  assert.equal(fetched.metadata?.normalization, undefined);
});

test('normalized Pulumi resource HTML extracts argument facts without raw HTML', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-normalized-pulumi-docs-'));

  try {
    const source = {
      kind: 'pulumi-docs',
      name: 'pulumi-docs:resource:aws:s3/bucket',
      packageName: '@pulumi/aws',
      module: 'aws:s3/bucket:Bucket',
      url: 'https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/'
    };
    const fetched = await fetchOfficialKnowledgeSource(source, {
      fetchedAt: '2026-05-09T00:00:00.000Z',
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          get: name => name.toLowerCase() === 'content-type' ? 'text/html' : null
        },
        text: async () => [
          '<html><body>',
          '<h1>Bucket</h1>',
          '<table>',
          '<tr><th>Name</th><th>Type</th><th>Description</th></tr>',
          '<tr><td><code>bucket</code></td><td>string</td><td>Name of the bucket to create.</td></tr>',
          '<tr><td><code>secretToken</code></td><td>string</td><td>Secret token should be skipped.</td></tr>',
          '</table>',
          '</body></html>'
        ].join('')
      })
    });
    assert.ok(fetched);
    const entry = await writeKnowledgeCacheEntry(tempRoot, fetched);
    const factSet = extractKnowledgeFactSetFromCacheEntry(entry, {
      now: new Date('2026-05-10T00:00:00.000Z')
    });

    assert.ok(factSet.facts.some(fact =>
      fact.kind === 'argument'
      && fact.path === 'pulumi.resource.aws.s3.bucket.Bucket.bucket'
      && fact.summary === 'Name of the bucket to create.'
      && fact.type === 'string'
      && fact.extractionMethod === 'pulumi-docs-markdown'
    ));
    assert.equal(factSet.facts.some(fact => /secretToken|Secret token/i.test(JSON.stringify(fact))), false);
    assert.doesNotMatch(JSON.stringify(factSet), /<html|<table|<td|contentHash.*<|raw/i);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('htmlToMarkdown strips high-noise blocks before text extraction', () => {
  const markdown = htmlToMarkdown([
    '<article>',
    '<h2>Values</h2>',
    '<svg><text>diagram-only</text></svg>',
    '<noscript>enable JavaScript</noscript>',
    '<p>Useful docs.</p>',
    '<iframe src="https://example.test"></iframe>',
    '</article>'
  ].join(''));

  assert.match(markdown, /^## Values/m);
  assert.match(markdown, /Useful docs\./);
  assert.doesNotMatch(markdown, /diagram-only|enable JavaScript|iframe|svg/i);
});

test('official doc normalization converts Pulumi input tables to Markdown tables', () => {
  const markdown = htmlToMarkdown([
    '<main>',
    '<h2>Inputs</h2>',
    '<table>',
    '<thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>',
    '<tbody>',
    '<tr><td><code>bucket</code></td><td>string</td><td>Name of the bucket to create.</td></tr>',
    '<tr><td><code>acl</code></td><td>string</td><td>Canned ACL to apply.</td></tr>',
    '</tbody>',
    '</table>',
    '</main>'
  ].join(''));

  assert.match(markdown, /^## Inputs/m);
  assert.match(markdown, /\| Name \| Type \| Description \|/);
  assert.match(markdown, /\| --- \| --- \| --- \|/);
  assert.match(markdown, /\| `bucket` \| string \| Name of the bucket to create\. \|/);
  assert.match(markdown, /\| `acl` \| string \| Canned ACL to apply\. \|/);
});

test('official doc normalization converts Helm values tables to Markdown tables', () => {
  const markdown = htmlToMarkdown([
    '<section>',
    '<h2>Parameters</h2>',
    '<table>',
    '<tr><th>Parameter</th><th>Default</th><th>Description</th><th>Required</th></tr>',
    '<tr><td><code>image.repository</code></td><td><code>nginx</code></td><td>Container image repository.</td><td>yes</td></tr>',
    '<tr><td><code>service.port</code></td><td><code>8080</code></td><td>Service port.</td><td>no</td></tr>',
    '</table>',
    '</section>'
  ].join(''));

  assert.match(markdown, /^## Parameters/m);
  assert.match(markdown, /\| Parameter \| Default \| Description \| Required \|/);
  assert.match(markdown, /\| `image\.repository` \| `nginx` \| Container image repository\. \| yes \|/);
  assert.match(markdown, /\| `service\.port` \| `8080` \| Service port\. \| no \|/);
});
