# Testing

This repository keeps tests split by responsibility and runs them through
stable category entrypoints.

## Commands

- `npm run test:unit`: domain helpers, planner helpers, extraction, ranking,
  validation models, and focused output helpers.
- `npm run test:integration`: CLI and runtime flows that exercise multiple
  modules together.
- `npm run test:contract`: compact JSON, graph, report, and handoff schema
  contracts.
- `npm run test:all`: all category suites.
- `npm run test:coverage`: all category suites with Node's native coverage
  gate over `src/**/*.ts` (minimum 85% lines, 75% branches, 90% functions).
- `npm run smoke:knowledge-resource`: final resource-knowledge acceptance smoke
  for the one-shot `knowledge resource` CLI path.
- `npm test`: structure guard plus all category suites.
- `npm run package:check`: package dry-run for shipped file surface.
- `npm run verify`: full local gate: lint, structure, unit, integration,
  contract, smoke, e2e, coverage, and package dry-run.
- `npm run test:focused -- --test-name-pattern "<pattern>" <runner-or-shard>`:
  focused checks while developing.

## Live Network Knowledge Extraction

Normal CI and the default local test commands do not fetch public docs. The
live network extraction smoke in
`test/integration/cli-knowledge-network-extraction-main.test.mjs` is opt-in:

```sh
INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1 npm run test:integration -- cli-knowledge-network-extraction-main
```

Without `INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1`, the shard only verifies that the
canonical public extraction targets are defined and then returns without using
the network. With the env var set, it fetches the canonical targets into a temp
cache, validates cache/source shape and normalized content, and validates any
emitted `infra-agent.knowledge-units` payloads. If the machine cannot reach the
network, the shard no-ops safely rather than requiring committed skips.

The canonical v0 live targets are:

- Terraform: HashiCorp AWS provider docs at
  `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
- Pulumi: Pulumi AWS package/provider docs at
  `https://www.pulumi.com/registry/packages/aws/api-docs/`.
- Helm: `kube-prometheus-stack` public chart docs.

Do not turn live public docs into brittle full-content goldens. Assert source
identity, cache write/read shape, normalization metadata or content type,
redaction/no raw HTML, stable target identity signals, and schema-valid
five-unit payloads when extraction emits units.

## Knowledge Index Validation

The durable knowledge regression path is:

```sh
infra-agent knowledge sources <workspace> --json
infra-agent knowledge prefetch <workspace> --json
infra-agent knowledge extract <workspace> --json
infra-agent knowledge pack <workspace> --json
infra-agent knowledge index ... --json
infra-agent knowledge validate <artifact.json> --json
```

Run the canonical public RAG acceptance shards directly while changing
extraction or packing:

```sh
npm run test:unit -- knowledge-canonical-public-extraction
npm run test:unit -- knowledge-canonical-public-pack
```

Focused tests should prove the canonical public target resolver, target
summaries, `infra-agent.knowledge-units`, metadata index output, budget
`unitIndex`, and index validator stay generic for Terraform, Pulumi, and Helm.
Use HashiCorp AWS provider docs, `@pulumi/aws`, and
`kube-prometheus-stack` only as regression anchors; do not add
provider-specific parser assertions for those examples. The canonical public
fixtures intentionally use generic heading variants to prevent
provider-specific parser coupling.

Index tests should assert deterministic metadata, count consistency, source
identity, privacy scope, redaction, stale/unchecked source posture, and
validation failure on forged or drifted metadata. They should not require a
Vector DB, raw cached docs, full examples, live network access, or public-doc
goldens. Multi-source pack source-level omitted distribution remains an
estimate, so tests should not require exact per-source omitted allocation yet.

## Resource Knowledge Acceptance Smoke

Run the resource-knowledge smoke before a user-facing acceptance check:

```sh
npm run smoke:knowledge-resource
```

The smoke seeds a temporary workspace-local knowledge cache and exercises the
one-shot resource report path for Terraform, Pulumi, and Helm. It does not use
the network, global cache, shared registry, upload path, or infrastructure
mutation commands.

The equivalent user-facing command shapes are:

```sh
infra-agent knowledge resource <workspace> --domain terraform --resource resource:aws_s3_bucket --max-units 20 --json
infra-agent knowledge resource <workspace> --domain pulumi --resource pulumi:aws:s3/bucket:Bucket --max-units 20 --json
infra-agent knowledge resource <workspace> --domain helm --resource argocd:payments-api-prod --max-units 50 --json
```

Acceptance output should be an `infra-agent.knowledge-resource-report` with
`mutationAllowed: false`, one matched target, scoped suggested files, cache
posture, compact refs, a bounded `knowledge-pack`, all five unit types, and a
field-aware `unitIndex`. The acceptance-ready summary must report
`acceptanceStatus: "ready"`, `cacheReady: true`, `unitTypeComplete: true`,
all five `includedUnitTypes`, an empty `missingUnitTypes` array, and non-zero
`unitCounts` for `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.
It must not include raw source content, secret values, or unrelated resource
sources.

For acceptance routing, treat `summary.acceptanceStatus` as the authoritative
readiness field. `summary.recommendedAction` remains a coarse next-step hint
for legacy callers and can be less precise than the five-state acceptance
status.

Non-ready summaries are expected guardrails, not failures by themselves:
`unmatched-resource` means the resource identity did not resolve to a target,
`cache-refresh-needed` means selected sources need prefetch/extract/pack before
the report is reusable, `partial-unit-coverage` means the selected units do not
cover all five unit types under the current budget, and `empty-knowledge-pack`
means no units were included even though a target resolved.

## Public Knowledge URL Acceptance Smoke

When the user provides only a public documentation URL and does not want a
workspace-scoped report, use the URL-only extraction path:

```sh
infra-agent knowledge from-url https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/s3_bucket --max-units 20 --out /tmp/infra-agent-s3-url-knowledge.json --library-out /tmp/infra-agent-s3-library-artifact.json --json
infra-agent knowledge from-url https://www.pulumi.com/registry/packages/aws/api-docs/s3/bucket/ --max-units 20 --out /tmp/infra-agent-pulumi-bucket-url-knowledge.json --library-out /tmp/infra-agent-pulumi-bucket-library-artifact.json --json
infra-agent knowledge from-url https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/ --max-units 20 --out /tmp/infra-agent-helm-kube-prometheus-stack-url-knowledge.json --library-out /tmp/infra-agent-helm-kube-prometheus-stack-library-artifact.json --json
infra-agent knowledge validate /tmp/infra-agent-s3-url-knowledge.json --json
infra-agent knowledge validate /tmp/infra-agent-s3-library-artifact.json --json
infra-agent knowledge library-stage /tmp/infra-agent-s3-library-artifact.json --workspace <workspace> --store-dir knowledge/public-library --registry knowledge/public-library-registry.json --json
infra-agent knowledge pack <workspace> --domain terraform --resource aws_s3_bucket --json
```

The Terraform output should be an `infra-agent.public-knowledge-url-report` with
`mutationAllowed: false`, `domain: "terraform"`, source identity
`resource:aws_s3_bucket`, `summary.unitTypeComplete: true`, all five
`includedUnitTypes`, an empty `missingUnitTypes` array,
`summary.qualityStatus: "ready"`, grouped compact `unitsByType` entries for
`fact`, `guidance`, `example`, `diagnostic`, and `recipe`, and no raw source
content. Compact units should carry `sourceId` and `sourceLocator` instead of
duplicating the full source object, strip Markdown links from summaries and
steps, exclude example facts from `fact`, and avoid default-budget
`recipe.markdown.*` entries when a domain workflow recipe is available. The
report should also expose a `centralLibraryCandidate` with public-reference
scope, quality metadata, unit counts, `unitRef: "report.unitsByType"`, a
hub-style `classification.coordinates` value, a `classification.versionRef`
value that marks `latest` as a mutable `floating-alias`, an explicit
`classification.versionResolution` value that resolves live `latest`
metadata when provider versions metadata is available and marks local-content
fixture runs unresolved without fetching, and an `llmRefinementInput` contract
that points to structured report fields instead of raw docs. The LLM input
should include a deterministic review packet with
classification, version-reference stability, version resolution, source hash,
compact `downloadEvidence` with a trace hash, compact `sourceOutline`
headings/signals, compact `unitDigest` path samples and
identity/replacement signal counts, unit counts, quality signals, review
checks, and rejection criteria so future refinement starts from bounded
evidence. Live
download behavior should expose `download.mode`, `download.strategy`,
`download.attempts`, `download.usedUrl`, and `download.fallbackUsed` so tests
can prove Registry JavaScript-shell pages fall back to provider raw docs after
a rejected or failed primary attempt. When live `latest` metadata resolves to
a concrete Terraform provider version, tests should prove raw-doc fallback
tries the resolved provider tag before branch refs such as `main` or `master`.
Pulumi Registry resource URL tests should prove the output has
`domain: "pulumi"`, source identity such as
`pulumi-docs:resource:aws:s3/bucket`, a stable coordinate such as
`pulumi/package/@pulumi/aws/unversioned/resource/aws:s3/bucket:Bucket`, all
five unit types, `sourceOutline` signals for inputs/examples/imports, and
`download.strategy: "official-url-primary-only"` with no Terraform fallback
attempts.
Artifact Hub Helm chart URL tests should prove the output has
`domain: "helm"`, source identity such as
`chart-docs:prometheus-community/kube-prometheus-stack`, a stable coordinate
such as `helm/chart/prometheus-community/kube-prometheus-stack/unversioned`,
all five unit types, `sourceOutline` signals for values/examples, chart value
facts such as `chart.kube-prometheus-stack.grafana.enabled`, and
either `download.strategy: "official-url-primary-only"` for directly
extractable chart docs or
`download.strategy: "artifacthub-page-then-package-api-readme"` when the chart
page is not extractable and the official Artifact Hub package API README is
selected. Helm URL tests must still prove no Terraform fallback attempts are
used.
With
`--library-out`, the command should also write an
`infra-agent.public-knowledge-library-artifact` containing the same compact
units, public-reference classification, download trace, quality summary,
source outline, version resolution, `unitPayloadHash`, and
`llmRefinementInput`, without raw source content, credentials, upload commands,
or backend URLs.
`knowledge validate` should accept both the URL report and the library
artifact. Report validation should
reject drifted source IDs, inconsistent summary counts, candidate
classification drift, version-reference drift, version-resolution drift,
source-outline drift, unit-digest drift, missing or unsafe discovery tags, LLM
review packet drift, embedded raw content, and secret-like compact unit text.
Artifact validation should reject drifted coordinates, inconsistent source metadata, malformed
download traces, drifted LLM download evidence, mismatched unit counts, bad
`unitPayloadHash`, drifted LLM review packet fields including unit digest,
missing or unsafe discovery tags, embedded raw content, or secret-like compact
unit text.
`knowledge library-stage` should only accept a valid public library artifact,
copy it into a workspace-relative
content-addressed local store, and update an
`infra-agent.public-knowledge-library-registry` entry keyed by the stable
coordinate, content hashes, and `versionRef` metadata. It must refuse
malformed registries rather than overwriting them and must not perform remote
upload, credential reads, backend probes, or
publication approval. When a staged local registry path or secret-free registry
URL is configured under `knowledgeSources.publicLibraryRegistries`,
`knowledge prefetch` should cache URL registries first, then `knowledge
sources`, `extract`, `pack`, and `resource` should discover the matching
`public-knowledge-library-artifact` by Terraform provider/resource usage,
expand artifact URLs or relative artifact paths, verify the registered
SHA-256, preserve `public-reference` storage policy, and emit compact units
without raw Markdown sections. `knowledge validate` should accept valid
`infra-agent.public-knowledge-library-registry` payloads and reject coordinate
drift, version-reference drift, unsafe artifact URLs, malformed hashes,
unsupported media types, bad quality states, missing review posture, and raw
content. This path can fetch
the URL live; tests should continue to use offline fetcher fixtures, mocked
fetch, and the internal `--content <file>` helper so default CI does not
require network access or socket listeners.

## Layout

- Put unit shards directly under `test/unit/`.
- Put integration shards directly under `test/integration/`.
- Put contract shards directly under `test/contract/`.
- Put only narrow shared fixtures or capture helpers under `test/support/`.
- Do not add nested test shard directories. Category runners discover only
  direct `.test.mjs` files.
- Do not restore a broad `test/support/cli-smoke-harness.mjs` helper or a
  monolithic `test/cli-smoke.test.mjs` shard.

`test/run-category.mjs` discovers category shards in stable filename order, so
new direct shard files do not need manual runner imports.

## Guardrails

`npm run test:structure` enforces the test layout:

- no root-level `.test.mjs` shards
- no nested category shards
- no test-like files outside direct `test/unit`, `test/integration`, or
  `test/contract` `.test.mjs` shards
- no broad smoke harness helper imports
- no committed `.only` or `.skip` tests
- `.test.mjs` shards at or below 1,000 lines
- `test/support/*.mjs` helpers at or below 1,000 lines
- category runners must use `test/run-category.mjs`
- `test/run-isolated.mjs` must reuse category discovery and execute each shard
  in a separate Node process
- `package.json` must keep category, coverage, and verification scripts wired
  into the expected gates
- `.github/workflows/verify.yml` must keep read-only permissions, concurrency,
  timeouts, separated category jobs, coverage, smoke/e2e, and package dry-run
  gates

When a shard approaches the size cap, split it by behavior before adding more
coverage.

Existing structure risk: some legacy shards are already oversized. Do not add
new coverage to those shards; prefer focused new shards or smaller splits.

## CI

GitHub Actions intentionally reports failures by layer instead of hiding them
behind one aggregate job:

- `static`: lint, test-structure guard, and package dry-run.
- `unit`, `integration`, `contract`: category-specific test jobs.
- `isolated-shards`: reruns every shard in an independent Node process after
  the category gates.
- `smoke-e2e`: realistic CLI smoke and E2E checks after the category gates.
- `coverage`: native Node coverage thresholds after static and category gates.
