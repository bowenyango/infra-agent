# infra-agent

`infra-agent` is a TypeScript CLI and agent-facing skill surface for compiling
Infrastructure as Code repositories into semantic, low-token context for tools
such as Codex, Claude Code, Cursor, and OpenCode.

The product goal is narrow on purpose:

- inspect existing `Pulumi`, `Terraform`, `Helm`, and Kubernetes-adjacent repo
  structure
- extract compact facts, guidance, examples, diagnostics, and recipes
- build inventory, graph, changed-context, and scoped pack artifacts
- validate saved knowledge artifacts before another agent uses them
- use hash and freshness metadata to avoid repeated parsing and token waste
- leave editing, command execution, approvals, rollback, and PR workflows to the
  host coding agent and human operator

## Scope

Version `v0` is intentionally constrained.

- Single CLI entrypoint: `infra-agent`
- Single repository workspace per run
- Focus on `Pulumi`, `Terraform`, and `Helm`, with graph hooks for
  Kubernetes/Argo CD relationships where repo evidence exists
- Read-only context extraction, graph, validation, and handoff artifacts by
  default
- Markdown/JSON artifacts intended for downstream coding agents
- No automatic `pulumi up`
- No automatic `terraform apply`
- No automatic `helm upgrade`
- No secret material generation

## Non-Goals

The first version will not attempt to be:

- a general-purpose coding agent
- a multi-agent orchestration platform
- a background daemon
- a deployment operator
- a remote execution system
- a replacement for Codex, Claude Code, Terraform plan, Pulumi preview, Helm,
  Checkov, tfsec, OPA, or human review

## Development Standards

Future agents and contributors must read the repository-root `AGENTS.md`
before making changes. It defines the required workflow, safety boundaries,
validation policy, context discipline, documentation rules, and commit
expectations for this project.

Tests are split by responsibility under `test/unit/`, `test/integration/`,
and `test/contract/`, with narrow shared fixtures under `test/support/`.
`npm run test:unit`, `npm run test:integration`, and `npm run test:contract`
run the layered suites; `npm run test:all` runs the complete regression suite.
`npm run test:isolated` reruns every unit, integration, and contract shard in
its own Node process to catch cross-shard state coupling.
`npm test` runs the structure guard before the complete regression suite.
Focused checks use `npm run test:focused -- --test-name-pattern "<pattern>"
<runner-or-shard>`.
`npm run test:structure` enforces category-runner discovery, blocks misplaced
test-like files, nested test shards, and the old broad smoke harness, and keeps
`.test.mjs` shards under 1,000 lines and support helpers under 1,000 lines. It
also blocks committed `.only`/`.skip` tests and protects the expected
CI/script gates. See `docs/TESTING.md` for the extension rules.

## Core Design Direction

The active direction is an IaC context compiler, not another harness. A coding
agent asks `infra-agent` for focused infrastructure context, then uses its own
editing, command execution, approval, rollback, and PR workflow.

1. Inspect the repository and detect relevant infrastructure files.
2. Extract structured inventory and five compact knowledge-unit types:
   `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.
3. Build graph and impact context from Terraform modules, Pulumi stacks, Helm
   charts, Kubernetes resources, and Git diff evidence.
4. Rank and pack only the context another agent needs for the requested scope.
5. Validate saved artifacts and freshness hashes before reuse.
6. Produce compact Markdown or JSON handoff output without raw docs, secrets,
   or broad repository dumps.

## Validation Contract

Every artifact produced by the agent must be validated where applicable.

- Helm: `helm lint`
- Helm: `helm template`
- Pulumi: `pulumi preview`
- Terraform: `terraform fmt -check`
- Terraform: `terraform validate`

Pulumi validation commands must remain preview-only. The agent loop must not
bootstrap local Pulumi backends, run `pulumi stack init`, log in, refresh, or
mutate state as part of validation. Bounded native Pulumi stack config writes
use the `native-stack-config-write` tool category and require explicit approval
before execution.

If validation fails, the agent should continue iterating until the failure is resolved or a real blocker is reached.

## Current CLI Surface

The current repository includes a minimal TypeScript CLI skeleton with these commands:

- `infra-agent --version`
- `infra-agent doctor [workspace] [--model <name>] [--openai-base-url <url>] [--llm-provider openai-compatible] [--json]`
- `infra-agent planner-providers [--json]`
- `infra-agent inspect [workspace]`
- `infra-agent inventory [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]`
- `infra-agent pack [workspace] --scope <path|target|env|stack> [--changed] [--base <ref>] [--head <ref>] [--file <path>] [--domain helm|pulumi|terraform] [--json]`
- `infra-agent cache status [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]`
- `infra-agent refs [workspace] --scope <path|target|env|stack> [--domain helm|pulumi|terraform] [--max-units <n>] [--json]`
- `infra-agent validate [workspace]`
- `infra-agent graph [workspace] [--terraform-plan <plan.json>] [--pulumi-preview <preview.json>] [--target <root>]`
- `infra-agent changed [workspace] [--base <ref>] [--head <ref>] [--file <path>] [--domain helm|pulumi|terraform] [--target <path>] [--json]`
- `infra-agent identity-report <agent-result.json> [--json]`
- `infra-agent prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>]`
- `infra-agent knowledge sources [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--json]`
- `infra-agent knowledge prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>] [--json]`
- `infra-agent knowledge extract [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--source <id>] [--out <knowledge.json>] [--units-out <dir>] [--manifest-out <manifest.json>] [--json]`
- `infra-agent knowledge validate <knowledge.json> [--workspace <workspace>] [--json]`
- `infra-agent knowledge pack [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--source <id>] [--max-units <n>] [--max-facts <n>] [--out <pack.json>] [--manifest-out <manifest.json>] [--json]`
- `infra-agent knowledge index [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--source <id>] [--max-units <n>] [--unit-type fact|guidance|example|diagnostic|recipe] [--provider <addr>] [--package <name>] [--chart <name>] [--module <name>] [--version <version>] [--privacy-scope public-reference|workspace-private|internal-team|private-run] [--storage-scope public-reference|workspace-private] [--out <index.json>] [--json]`
- `infra-agent knowledge resource [workspace] --domain <helm|pulumi|terraform> --resource <identity> [--max-units <n>] [--out <report.json>] [--json]`
- `infra-agent knowledge from-url <url> [--max-units <n>] [--out <url-knowledge.json>] [--library-out <library-artifact.json>] [--json]`
- `infra-agent knowledge publish <knowledge-units.json> --workspace <workspace> --store-dir <dir> --registry <registry.json> [--domain helm|pulumi|terraform] [--target <path>] [--name <name>] [--version <version>] [--provider <addr>] [--package <name>] [--chart <name>] [--module <name>] [--allow-workspace-private] [--out <report.json>] [--json]`
- `infra-agent knowledge library-stage <library-artifact.json> --workspace <workspace> --store-dir <dir> --registry <registry.json> [--out <report.json>] [--json]`
- `infra-agent knowledge library-download <public-library-registry.json|registry-url> --coordinate <coordinate> --workspace <workspace> --store-dir <dir> [--out <report.json>] [--json]`
- `infra-agent knowledge library-catalog <public-library-registry.json|registry-url> [--domain helm|pulumi|terraform] [--provider <addr>] [--package <name>] [--chart <name>] [--resource <identity>] [--version <version>] [--tag <tag>] [--quality ready|needs-refinement] [--coordinate <coordinate>] [--out <catalog.json>] [--json]`
- `infra-agent knowledge library-refinement-review <library-artifact.json> [--out <review.json>] [--json]`
- `infra-agent run "<task>" [--workspace <path>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>]`
- `infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--model <name>] [--openai-base-url <url>] [--llm-provider openai-compatible] [--max-turns <n>] [--max-repair-attempts <n>] [--context-packet-limit <n>] [--context-token-budget <n>] [--context-fact-limit <n>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>] [--json] [--json-full]`

Current behavior is intentionally runtime-foundation oriented:

- `doctor` reports package, installed agent-facing surface, Node engine,
  workspace inspection, validation plan, LLM planner configuration, and
  Helm/Pulumi/Terraform executable readiness without mutating the workspace.
  Its JSON also exposes `plannerProviderCatalog` as a compact pointer to the
  static read-only planner adapter catalog.
- `inspect` detects Helm charts, Pulumi projects, and Terraform roots
- `inventory` emits a compact read-only `infra-agent.inventory` report from
  the existing inspection surface. It summarizes tools, target paths,
  environment hints, primary files, validation targets, semantic fact counts,
  knowledge-cache posture, and compact Helm chart identity/version/dependency
  metadata without raw file content or full semantic facts. Repeated `--domain`
  and `--target` filters let downstream agents start from the smallest useful
  repo map before broad file reads.
- `pack` emits a scoped read-only `infra-agent.scoped-pack` report, or compact
  Markdown by default, for a requested path, target name/id, environment hint,
  Pulumi stack, or changed-component set from `--changed`. It selects matching
  inventory targets, suggested files, validation targets, environment hints,
  semantic fact counts, compact Helm chart metadata, optional
  changed-file/risk-hint summaries, and knowledge-cache posture without raw
  file content, validators, git mutation, plan/preview, apply, deploy, or state
  mutation. Read-only git diff collection is used only when `--changed --base`
  is requested.
- `cache status` emits a read-only `infra-agent.cache-status` report for the
  semantic-unit hash cache posture behind selected Terraform, Pulumi, and Helm
  knowledge sources. It summarizes local, fresh, stale, and missing source
  cache entries by domain and target so agents can decide when to reuse cached
  context or deliberately refresh/extract/pack again. It does not fetch,
  prefetch, validate, upload, plan, preview, apply, deploy, mutate state, or
  expose cache entry content, content hashes, or timestamps.
- `refs` emits a read-only `infra-agent.refs` report with compact interface
  facts selected from actual repo usage for a requested scope. It resolves the
  scope the same way scoped packs do, then returns matching targets, reference
  source cache posture, and bounded Helm values/schema, Pulumi config, and
  Terraform/provider/module semantics such as required fields, defaults,
  enum-like values, configured fields, and replacement-sensitive hints when
  present. It is cache-first advisory context, not a generic documentation
  search surface, and it does not fetch live docs, expose raw docs/source/cache
  payloads, run validators, plan, preview, apply, deploy, or mutate state.
- `validate` reports validator availability and the validation plan implied by the workspace
- `graph` emits a normalized `infra-agent.infra-graph` topology foundation
  from workspace inspection facts and can attach read-only Terraform plan JSON
  resource actions when `--terraform-plan` is provided, including
  confidence-scored possible rename edges for matching delete/create pairs,
  dependency edges, replacement-cascade edges, provider-specific replacement
  reason metadata, and Terraform create-before-destroy conflicts for exclusive
  provider identities; it can also attach read-only Pulumi preview event
  actions with `--pulumi-preview`, including advisory Pulumi possible rename
  edges plus preview dependency/cascade edges and replacement reason metadata
  when source metadata is available. When plan or preview metadata exposes
  unchanged dependency resources, graph output can include `dependency-context`
  nodes without `planned-change` edges so agents can explain relationships
  without counting those resources as modified. Shared exclusive-identity rules
  currently cover examples such as AWS Routes, S3 buckets, named AWS resources,
  legacy and VPC-style AWS security group rules, IAM OIDC providers, AWS load
  balancing listener priorities, CloudFront aliases, API Gateway custom
  domains, Route53 records including ACM validation CNAMEs, and Kubernetes
  objects. Graph JSON includes compact source provenance counts under
  `summary.sourceProvenance` plus `summary.impact` counts, `riskLevel`,
  `primaryConcern`, `recommendedAction`, review-only
  `reviewSteps`, prioritized `reviewTargets` with per-target
  `priority`, `mutationAllowed=false`, `recommendedAction`, `riskCategory`, and
  `reviewSteps`, plus root and summary-level `mutationAllowed=false`,
  `reviewTargetBudget`, and `omittedReviewTargets`, and the text output includes
  an `Impact` section for quick handoff. VPC-style security group rule matching keeps TCP/UDP ports
  required but permits omitted ports for
  all-protocol and ICMPv6 rules. A stable graph snapshot fixture now covers the
  cross-domain impact contract before any topology viewer work starts
- `changed` emits a read-only `infra-agent.changed-context` report for a git
  base/head comparison or explicit `--file` list. It maps changed paths to
  detected Helm charts, Pulumi projects/stacks, and Terraform roots, returns
  affected components, suggested inspection files, suggested validation
  targets, unmapped files, and heuristic risk hints. It does not run plan,
  preview, apply, deploy, or mutation commands.
- `prefetch` explicitly fills the version-aware knowledge cache for selected
  Terraform/Helm/Pulumi official docs; it is bounded by `--max-sources` and
  skips repo-local schema/config/code files that do not require network
  retrieval. Prefetch results report each source's previous cache posture
  (`local`, `fresh`, `stale`, or `missing`) without changing the cache-first
  agent loop. HTML official-doc responses fetched through this explicit path
  are normalized into compact Markdown cache entries before extraction; fresh
  cache entries are not rewritten solely to normalize old content.
- `knowledge sources`, `knowledge prefetch`, `knowledge extract`,
  `knowledge validate`, and `knowledge pack` provide the cache-first knowledge
  workflow. `sources` lists selected docs/local schemas/local config sources
  without fetching, marks each source as either public-reference or
  workspace-private for future storage/publication policy, and reports public
  URL-backed cache freshness as `fresh`, `stale`, or `missing` so operators can
  deliberately run `knowledge prefetch` only when needed. `prefetch` aliases the
  bounded cache update path,
  `extract` turns cached docs, local schemas, local modules, local Helm chart
  metadata, cached Helm chart-doc markdown, local Pulumi config summaries, and
  conservative local Pulumi component summaries into
  `infra-agent.knowledge-facts`; it also accepts configured local curated
  `infra-agent.curated-knowledge-units` JSON sources from
  `infra-agent.config.json` under `knowledgeSources.curatedUnits` and converts
  them into internal-team `fact`, `guidance`, `example`, `diagnostic`, and
  `recipe` units without raw content in packs. It also accepts configured
  prebuilt `infra-agent.knowledge-units` artifacts under
  `knowledgeSources.unitArtifacts`, which lets reviewed public or internal unit
  sets enter the same extraction, validation, ranking, and compact pack path
  without rerunning source extraction. `unitArtifacts` may point at a safe
  workspace-relative `path` or a secret-free `url`; URL artifacts are fetched by
  `knowledge prefetch` into the local cache before `extract` or `pack` consumes
  them. Larger shared catalogs can be configured through
  `knowledgeSources.unitArtifactRegistries`, whose read-only registry JSON
  expands into matching artifact entries for the requested domain and target.
  Direct artifacts and registry entries can carry an optional SHA-256
  `artifactContentHash` / `contentHash` so extraction rejects drifted unit
  payloads before planner use. URL-extracted public-reference artifacts can be
  staged with `knowledge library-stage` and then consumed through
  `knowledgeSources.publicLibraryRegistries`, which may point at either a safe
  workspace-relative `infra-agent.public-knowledge-library-registry` `path` or
  a secret-free registry `url`. URL registries are downloaded only through the
  explicit read-only `knowledge prefetch` path; after the registry is cached,
  matching entries are discovered by Terraform provider/resource usage, their
  artifact URLs or relative artifact paths are expanded, artifact content
  hashes are checked, and compact five-type units remain in the
  `public-reference` storage scope. Registry entries also carry `versionRef`
  metadata so a central library can distinguish pinned provider versions from
  mutable aliases such as `latest` while still relying on content hashes for
  reproducible reuse. `knowledge library-catalog <registry.json|registry-url>`
  is the read-only directory view for this shape: it validates a local registry
  file or secret-free registry URL, filters entries by domain,
  provider/package/chart, resource, version, tag, coordinate, or quality, and
  emits raw-content-free classification, resolved artifact download location,
  hash, quality, unit-type coverage, and LLM review-packet metadata so another
  agent can decide what to download or refine before loading the full artifact.
  `knowledge library-download <registry.json|registry-url> --coordinate ...` is
  the manual Hub-style artifact fetch path: it validates the registry, selects
  exactly one coordinate, copies a workspace-path artifact or downloads a URL
  artifact, resolves relative artifact paths from URL registries, verifies the
  registered SHA-256 content hash, validates that the artifact payload still
  matches the registry metadata, and writes it into a workspace-relative
  content-addressed store without embedding raw content in the report.
  `knowledge library-refinement-review <library-artifact.json>` is the
  offline LLM handoff for that downloaded artifact. It validates the artifact
  and emits a raw-content-free `infra-agent.public-knowledge-library-refinement-review`
  report with classification, download evidence, source outline, compact units,
  quality signals, review-packet hash, and a bounded prompt contract for
  model-based refinement. It does not call a model, mutate the artifact,
  upload, or approve publication.
  `validate` checks facts, extraction reports, compact packs, unit artifacts,
  indexes, and plan-only artifact manifests before use. `pack` ranks and emits a
  bounded planner-safe `infra-agent.knowledge-pack` without raw source content;
  `index` emits compact metadata for deterministic retrieval by unit type,
  provider/package/chart/module/version, privacy scope, storage scope, and target
  path. `extract --out` and `pack --out` explicitly persist reusable local
  artifacts, while `--manifest-out` records artifact hashes, source ids,
  storage-policy summary, and `mutationAllowed=false` for review. Pass
  `knowledge validate --workspace <workspace>` to recheck repo-derived source
  fingerprints against current files before another agent consumes saved context.
  `knowledge publish` stages a validated `infra-agent.knowledge-units` artifact
  into a workspace-relative content-addressed shared store and updates a
  `infra-agent.knowledge-unit-registry` JSON file for team reuse. This is a
  thin file-store publisher: it does not create cloud clients, read
  credentials, run live backend checks, generate upload commands, or implement
  approval/token/lease boundaries. Legacy team-upload, backend-readiness, and
  upload-boundary commands remain removed from the active branch.
  Validation reports include a structured freshness summary
  with stale and unchecked source counts, affected fact counts, safe source
  ids, source kinds/names, stale reasons, and safe workspace-relative
  stale/missing paths so saved facts can be re-extracted or rebuilt before
  planner use.
- `knowledge resource` emits a one-shot read-only
  `infra-agent.knowledge-resource-report` for a Terraform, Pulumi, or Helm
  resource identity. Its summary exposes `acceptanceStatus`, `cacheReady`,
  `unitTypeComplete`, `includedUnitTypes`, `missingUnitTypes`, and per-type
  `unitCounts`; `acceptanceStatus` is the authoritative readiness field for
  acceptance routing. This lets another agent distinguish an acceptance-ready
  five-unit context pack from unmatched resources, missing/stale cache entries,
  empty packs, or partial unit coverage under a tight budget.
- `knowledge from-url` emits a read-only
  `infra-agent.public-knowledge-url-report` directly from a public official
  documentation URL without requiring a workspace. It infers the source identity
  from supported URLs such as Terraform Registry provider resource/data-source
  docs, Pulumi Registry resource docs, and Artifact Hub Helm chart docs,
  extracts the same five unit types,
  groups compact source-referenced
  units under `unitsByType`, and reports `unitTypeComplete`, quality status,
  compact byte length, missing/included unit types, and a
  `centralLibraryCandidate` for public-reference reuse. The report also records
  a compact `download` trace and a hub-style central-library coordinate such as
  `terraform/provider/hashicorp/aws/latest/resource/aws_s3_bucket` or
  `pulumi/package/@pulumi/aws/unversioned/resource/aws:s3/bucket:Bucket` or
  `helm/chart/prometheus-community/kube-prometheus-stack/unversioned`,
  plus a
  `classification.versionRef` marker that records whether the URL path used a
  pinned version or a mutable alias such as `latest`. The companion
  `classification.versionResolution` records whether a pinned version was
  already concrete, whether a live `latest` lookup resolved to a specific
  Terraform provider version through provider versions metadata, whether the
  public docs are explicitly unversioned, or whether resolution was unavailable
  because the command used local content or the metadata lookup failed. When a
  live `latest` URL needs provider repository
  raw-doc fallback and the concrete provider version was resolved, fallback
  download attempts prefer the resolved version tag before `main` or `master`
  so the central-library evidence is closer to the published provider release.
  Pulumi Registry resource URLs use a primary official-URL download strategy.
  Artifact Hub Helm chart URLs try the package page first and, when that page
  is not extractable, fall back to the official Artifact Hub package API README
  without attempting Terraform provider repository fallbacks.
  The
  `llmRefinementInput` contract is for explicit offline LLM review. That input
  includes a deterministic `reviewPacket` with classification, version
  reference stability, version resolution, source hash, compact
  `downloadEvidence` including a trace hash, a compact `sourceOutline` with
  headings and section signals, a compact `unitDigest` with high-signal path
  samples and identity/replacement counts, unit counts, quality signals,
  review checks, and rejection criteria so a future model receives structured
  evidence instead of raw docs.
  Default selection favors reusable facts and identity/replacement guidance
  over generic Markdown sections. Use `--library-out` to write a standalone
  `infra-agent.public-knowledge-library-artifact` with the same compact units,
  download trace, source outline, classification, version resolution, quality,
  unit hash, and offline LLM review contract for future registry/download
  workflows. Validate
  the URL report with
  `knowledge validate <url-knowledge.json> --json` before LLM refinement, and
  validate the artifact with
  `knowledge validate <library-artifact.json> --json` before handing it to a
  registry or downloader; validation checks source identity, coordinate
  coherence, required discovery tags, download trace shape, source-outline
  drift, fallback ordering, LLM download evidence drift, version-resolution
  drift, unit counts, `unitPayloadHash` when present, LLM review packet drift,
  and raw content omission. This is the
  public-reference path to use when another agent gives a documentation link
  such as `aws_s3_bucket` and needs compact JSON rather than repo linkage.
- `knowledge library-stage` stages a validated
  `infra-agent.public-knowledge-library-artifact` into a workspace-relative
  content-addressed public-library store and updates an
  `infra-agent.public-knowledge-library-registry` JSON file keyed by the stable
  coordinate plus content hashes, `versionRef` stability metadata, and a compact
  `llmRefinement` index summary with the offline review-packet hash, unit-type
  coverage, quality score, and review-required posture. This is the local
  downloadable-registry shape for future central library workflows.
  It writes only local files under the requested workspace;
  it does not contact a remote backend, read credentials, create upload
  commands, or approve publication. Add the resulting registry, or a
  secret-free URL for an equivalent reviewed public registry, under
  `infra-agent.config.json` -> `knowledgeSources.publicLibraryRegistries` when
  a workspace should reuse reviewed public-reference artifacts through
  `knowledge sources`, `knowledge extract`, `knowledge pack`, or
  `knowledge resource` without re-downloading the public docs. URL-backed
  registries must be cached with `knowledge prefetch` before their artifact
  entries can be discovered and reused. Registry matching covers Terraform
  provider/resource usage, Pulumi package/resource tokens, and Helm chart
  names. `knowledge validate
  <public-library-registry.json> --json` validates registry coordinates,
  artifact locations, media type, hashes, unit counts, LLM-refinement index
  shape, quality status, and review-required posture before a registry is
  shared or configured.
- `knowledge library-catalog` emits a read-only
  `infra-agent.public-knowledge-library-catalog` report from a validated public
  library registry file or secret-free registry URL. Use it as the
  central-library browse/search surface before download reuse: the report keeps
  hub coordinates, domain classification, version metadata, resolved artifact
  path or URL, SHA-256 content hash, quality status, missing unit types, and LLM
  review-packet hash without embedding raw docs or compact unit bodies.
- `knowledge library-download` resolves one catalog coordinate from a validated
  public-library registry file or secret-free registry URL, copies or downloads
  the artifact, checks the exact SHA-256 content hash from the registry,
  validates the downloaded
  `infra-agent.public-knowledge-library-artifact`, checks identity and
  LLM-review metadata drift against the registry entry, and stores the verified
  artifact by content hash under a workspace-relative directory. It is local
  artifact download/reuse, not upload or publication approval.
- `knowledge library-refinement-review` validates a downloaded or locally
  generated `infra-agent.public-knowledge-library-artifact` and emits an
  offline LLM review input report. The report resolves the artifact's compact
  `llmRefinementInput` references into classification, download, source-outline,
  summary, quality, and compact-unit inputs, includes the review-packet hash
  and prompt contract, and keeps `mutationAllowed=false` with no raw docs or
  model execution.
- `agent` loads bounded knowledge facts from cache/local sources for selected
  targets, injects only compact `knowledgeFacts` summaries into planner prompts,
  and exposes the same summary in `agent --json`. `--context-fact-limit`
  controls the fact budget; facts remain advisory and do not replace provider
  schemas, plan/preview output, or validators.
- Terraform roots may include a read-only local provider schema export at
  `.infra-agent/terraform-provider-schema.json` (or
  `.infra-agent/terraform-providers-schema.json`) generated from
  `terraform providers schema -json`. `inspect`, `prefetch`, and the agent
  runtime use compact facts from that file for provider-required fields, field
  types, and nested block shape without loading the full schema JSON into the
  planner prompt. When `.terraform.lock.hcl` is present, local provider schema
  context is tagged with locked provider versions such as
  `hashicorp/aws@5.37.0`. Replacement and ForceNew behavior still comes from
  native plan output plus provider-specific impact rules.
- Terraform roots with literal local module calls such as
  `source = "./modules/worker"` are learned as local `terraform-module`
  knowledge sources. `knowledge extract`, `knowledge pack`, and the agent
  runtime convert the module's variable/output interface into ranked
  `module-input` and `module-output` facts without exposing raw `.tf` content.
  Registry, git, URL, interpolated, absolute, and out-of-workspace module
  sources are ignored by this local extractor.
- Pulumi projects are learned as local `pulumi-config` knowledge sources from
  `Pulumi.yaml` and sibling `Pulumi.<stack>.yaml` files. `knowledge extract`,
  `knowledge pack`, and the agent runtime convert declared config keys,
  project config types/defaults, and safe stack config values into ranked
  `pulumi-config-parameter` facts without exposing raw YAML or `secure` values.
  Secret-like config keys and all secure stack entries are skipped; `pulumi
  preview` remains the authoritative validator for missing or invalid config.
- Pulumi Node.js/TypeScript projects can also expose local `pulumi-component`
  knowledge sources from explicit `pulumi.ComponentResource` or imported
  `ComponentResource` classes inside the project root. `knowledge extract`,
  `knowledge pack`, and the agent runtime convert constructor args
  interfaces/types, public output property declarations, and conservative
  in-class child resource constructors into ranked `pulumi-component-input`,
  `pulumi-component-child-resource`, and `pulumi-component-output` facts with
  recheckable source fingerprints. Child facts carry the resource name, Pulumi
  type token, source locator, and safe related paths, but not constructor
  argument objects or raw source. Generated/test/declaration files and
  secret-like fields are skipped, raw source is not emitted, and `pulumi
  preview` plus project type checks remain authoritative.
- Pulumi project-root `package.json` dependencies on safe `@pulumi/*` packages
  select public Pulumi Registry package docs sources. When those docs are
  already cached as markdown, `knowledge extract`, `knowledge pack`, and the
  agent runtime can use bounded `pulumi-docs-guidance` facts for package
  modules without exposing raw docs or package manifests. These facts are
  advisory, rank below local Pulumi config facts, and do not prove language
  source imports or component internals.
- Pulumi YAML resource tokens and conservative Node.js/TypeScript project-root
  `@pulumi/*` import/require plus explicit constructor evidence can select
  public Pulumi Registry resource docs sources. Cached resource docs markdown
  becomes bounded `argument` facts for resource inputs without exposing raw
  source code or docs. Package dependencies only provide safe package/version
  context; they are not treated as resource usage proof. Component internals,
  dynamic aliases, generated/test files, and non-Node languages remain outside
  this discovery path.
- Helm charts are learned as local `chart-metadata` knowledge sources from
  `Chart.yaml` and sibling `Chart.lock` files. `knowledge extract`,
  `knowledge pack`, and the agent runtime convert chart identity, safe metadata,
  and declared or locked dependencies into ranked `chart-metadata` and
  `chart-dependency` facts without exposing raw chart YAML. When a dependency is
  present in `Chart.lock`, that locked version is preferred over the declared
  range in `Chart.yaml`; native Helm validation remains authoritative.
- Cached Helm chart docs selected from chart `home`, `sources`, or HTTP(S)
  dependency docs can provide bounded medium-confidence `chart-value` facts
  from markdown tables, bullets, and headings. Explicit prefetch normalizes
  HTML chart docs into this Markdown shape before caching when possible. These
  facts are cache-first, public-reference advisory context, rank below local
  `values.schema.json`, `Chart.yaml`, and `Chart.lock` facts, and stay compact
  in planner prompts and
  `agent --json` without raw markdown, external URLs, cache timestamps, or
  content hashes.
- `run` builds a structured preflight state from the task, workspace facts, validator availability, assumptions, blockers, and next actions
- `run` now also shows the effective approval policy derived from repo profile defaults, workspace config, and explicit approval flags
- `agent` runs a bounded agent decision loop on top of the preflight state through a pluggable planning model
- `validate_targets` refuses deploy, apply, state mutation, Helm release
  mutation, and Kubernetes mutation commands before spawning a shell command.
  Blocked commands are surfaced as `unsafe-validation-command` validation
  issues, not executed as best-effort validation.
- LLM planner `validate-targets` decisions are clamped to commands already in
  the selected validation plan, so invented commands are ignored before tool
  execution.
- LLM planner target-path payloads are clamped to known target candidates for
  inspection and Terraform formatting repair, so invented paths cannot expand
  the selected workspace scope.
- LLM planner `payload.actionFamily` values are normalized as metadata. Safe
  supported values are preserved, and missing or unsupported values fall back to
  deterministic runtime, domain, validation, repair, or stop families.
- `agent` now prefers an OpenAI-compatible LLM planner when an API key is configured, with rule-based fallback for local testing
- `agent` and read-only `doctor` accept CLI model overrides through
  `--model`/`--llm-model`, `--openai-base-url`/`--llm-base-url`, and
  `--llm-provider openai-compatible`. API keys remain environment-only, and
  compact handoff records only non-secret planner config metadata.
- The LLM planner provider adapter registry is intentionally narrow and
  planner-only. The current `openai-compatible` adapter declares
  `chat-completions` transport, `/chat/completions` endpoint, JSON-object
  response format, and non-streaming behavior. Doctor output, result cards, and
  compact `harness.plannerConfig.llm.capabilities` expose this metadata for
  handoff without API keys, auth headers, or secret-bearing URLs. This registry
  is not a general provider platform or multi-agent runtime.
- `planner-providers` emits the same adapter catalog as a read-only text or
  JSON report. It does not inspect a workspace, resolve environment values,
  contact a model provider, or prove live reachability. Doctor JSON and compact
  `readiness.plannerProviderCatalog` point to this command without embedding
  the full catalog in every handoff payload.
- LLM planner prompts include compact `runtimeIdentityConflictSummary` and
  `runtimeIdentityConflicts` when native validation reports provider-exclusive
  identity blockers. The summary carries total/included/omitted, engine, and
  risk-category counts, while sampled entries carry risk category, locator,
  identity fields, and review steps without passing long stderr logs as the
  primary planning context.
- `agent` exposes `--max-turns <n>` to keep bounded loop experiments explicit from the CLI
- `agent` exposes `--max-repair-attempts <n>` to keep the validation repair
  loop budget explicit. The default is `2`; `0` disables automatic repair
  attempts and converts repairable validation failures into
  `repair-budget-exhausted` stops.
- `agent` exposes `--context-packet-limit <n>` and
  `--context-token-budget <n>` to keep retrieved official-doc/schema context
  budgets explicit for LLM planner runs and downstream handoff.
- `agent --json` emits a compact `infra-agent.agent-result` payload for other
  agents; use `--json-full` only when debugging the complete runtime state.
  Compact result consumers use a shared shallow contract parser that verifies
  `kind`, `schemaVersion`, `outcome`, required root task/workspace metadata,
  root string-array handoff fields, `handoffCheckpoint`, query/loop budget
  consistency, compact trace arrays, readiness checks, and
  `validation.identityConflicts` before producing derived reports.
  `handoffCheckpoint` is the first routing checkpoint for continuation agents:
  it declares compact/read-only posture, primary/debug artifacts, raw-content
  exclusions, derived routing summary, section budgets, continuation reason and
  command metadata, durable section names, and `mutationAllowed=false`.
  Compact consumers validate checkpoint enums, raw-exclusion flags,
  summary-to-section consistency, budget-to-section consistency, continuation
  command consistency, and read-only mutation posture before trusting the rest
  of the handoff.
  The compact payload includes `harness.queryConfig`, an immutable snapshot of
  the turn, repair-attempt, and retrieved-context budgets used for the run, plus
  `harness.turnTrace`, a bounded per-turn trace inspired by Claude Code's query
  harness design. It exposes action kind, terminal status, execution status,
  execution skip reason, tool count, changed-file count, validation issue
  count, and approval signal count without exposing full runtime snapshots. The
  companion `harness.turnTraceBudget`, `harness.turnTraceLimit`, and
  `harness.turnTraceOmittedCount` fields make the trace window and omitted
  count explicit for downstream handoff. Compact consumers validate turn-trace
  entry enums, count fields, included-index links, and budget/legacy count
  consistency.
  `harness.loopBudget` reports turns used, max turns, remaining turns, and
  whether the loop stopped because the turn budget was exhausted; compact
  consumers validate that it matches root `turnsUsed` and the query max-turns
  budget.
  `harness.repairBudget` reports bounded repair attempts used, max attempts,
  remaining attempts, and whether the repair loop is exhausted; compact
  consumers validate that it matches `harness.queryConfig.maxRepairAttempts`.
  `harness.stateSummary` reports runtime counts for observations, tools,
  writes, validation results/issues, approvals, retrieved context, and semantic
  facts without exposing the full runtime state.
  `harness.targeting` reports the selected target, candidate score posture,
  bounded candidate sample, ambiguity flags, and recommended targeting action
  without exposing raw preflight state.
  `harness.workPlan` reports a derived compact progress plan with readiness,
  targeting, inspection, bounded edit, validation, and handoff steps. It is
  read-only, carries current-step and blocker posture, and is validated against
  planner handoff routing so continuation agents do not need to reconstruct
  progress from raw turn history.
  `harness.plannerHandoff` reports the last action, active blocker, and next
  control action so another agent can route the run without reading raw
  decisions, prompts, or runtime arrays. Compact consumers validate last-action
  enums, blocker issue/signal kinds, stop/clarification coherence, and
  outcome-to-control-action consistency.
  `harness.lifecycleEvents` is a budgeted event stream for query start,
  decisions, tool execution, approval gates, and terminal outcome. It keeps
  lifecycle routing explicit with total, included, omitted, and event-kind
  counts, without timestamps or raw tool output. Compact result consumers
  validate supported lifecycle event names, event entry fields, count and
  `maxEntries` consistency, event-kind count totals, and outcome metadata before
  deriving reports.
  `harness.toolTrace` is a budgeted tail window of recent deterministic tool
  summaries plus total, included, omitted, first/last included turn indexes,
  latest-turn, and permission-category counts, so downstream agents can inspect
  execution evidence and permission posture without loading raw tool output.
  Compact consumers validate tool trace entry shapes, supported safety and
  permission categories, boolean mutation flags, ascending turn indexes, entry
  counts, boundary indexes, and permission-category totals.
  `harness.toolPermissionSummary` aggregates workspace mutations, native CLI
  calls, stack/state mutation-risk tools, approval-required tools, and
  permission category totals. Compact consumers validate that summary counts are
  non-negative integers, category totals equal `totalToolCount`, category keys
  are supported, and category counts match `harness.toolTrace` permission
  provenance when both are present.
  Result cards, snapshots, and human output also report repair attempts as
  `used/max` so downstream agents can distinguish unused repair capacity from
  an exhausted repair loop. Result cards also summarize retrieved knowledge
  context packet inclusion, token estimate use, omission reasons, and validation
  blocker counts from the compact issue summary.
  `readiness` summarizes the planner mode, workspace blockers, selected
  validation plan, and only the validators required by that selected plan. It
  also includes a `doctorCommand` for a fuller read-only package/Node/tool
  report plus `plannerProviderCatalog`, a compact discovery pointer for the
  static read-only LLM planner adapter catalog. Compact consumers validate
  readiness status enums, summary counts, check entry shapes, status/count
  consistency, and static catalog discovery posture before deriving handoff
  posture. `validation.selectedPlan` mirrors the selected validation targets and
  commands, including executed and failed command counts, so downstream agents
  can tell what validation was intended before raw tool output is requested.
  Compact consumers validate selected-plan entry kind, target, command array,
  command-count consistency, executed/failed count bounds, and validator
  availability booleans.
  `validation.commands` carries a budgeted list of recent executed validation
  commands with pass/fail status, short stdout/stderr previews, and structured
  unsafe-command rule metadata when a mutation command is blocked. Compact
  consumers validate command entry shapes, status/exit-code consistency,
  command kind enums, unsafe-command metadata, and command budget counts.
  `validation.issueSummary` groups active validation blockers by issue kind and
  repairability with counts, source-command counts, omitted issue/group totals,
  and booleans for repairable, non-repairable, unsafe-command, YAML syntax, and
  identity-conflict blockers. `validation.issueDetails` reports the sampling
  budget and omitted count for the capped `validation.issues` detail array.
  Compact consumers validate issue summary count arithmetic, group entry shape,
  group budget limits, flag/count consistency, and issue-details omitted-count
  alignment before deriving validation blocker reports.
  `validation.safetyBlockers` isolates unsafe validation command and YAML syntax
  blockers with explicit mutation-prevented posture. Compact consumers validate
  blocker budget fields, supported blocker kinds, non-empty source command and
  message strings, string-or-null unsafe/YAML metadata, repairability booleans,
  and `mutationPrevented=true`.
  `validation.issues` carries a capped sample of validation issue details.
  Compact consumers validate sampled issue entry kind, repairability, message,
  optional guidance and metadata, issue-detail budget limits, omitted-count
  arithmetic, and full-sample agreement with `validation.issueSummary`.
  `approval.resume` carries a structured continuation command, primary approval
  signal, additional pending approval scope, `pendingScope` count summary, and
  signal count for approval-required runs so downstream agents do not need to
  scrape prose before asking for explicit user approval. Compact consumers
  validate approval signal shapes, write-risk and tool-category enums, resume
  arrays, continuation command/null consistency, query-budget flag preservation,
  primary/additional scope consistency, pending-scope counts, and signal count
  coverage; this metadata is not approval by itself.
  `approval.resume.compactCommand` and `approval.resume.debugCommand` preserve
  the same approval scope and query budget while selecting compact or full JSON
  output.
  `approval.resume.additionalCommands` lists one command per non-primary signal
  so downstream agents can ask about additional approval scopes without
  combining them by default.
  `approval.grants` reports the explicit approval scope already supplied to the
  current run, including granted write risks, write paths, tool categories, and
  whether write approval was global or path-scoped. Result cards mirror that
  grant posture so human handoff can distinguish supplied approval from pending
  approval requests. Suggested rerun/export commands preserve these grants so a
  downstream agent does not accidentally re-enter an already-approved gate.
  readiness report when another agent needs it. Result cards include the same
  readiness posture, and suggested commands surface the read-only doctor command
  first when readiness has warnings or failures.
  Retrieved official-doc/schema context is budgeted before planner handoff, and
  compact results expose `knowledgeContext` with packet/token counts and
  omitted-context reasons instead of raw excerpts. Compact consumers validate
  positive budget limits, packet/omission count arithmetic, packet summary
  entry shape, omitted-reason coherence, derived token totals, excerpt-char
  limits, and the absence of raw context fields.
  Extracted provider/resource/chart facts are budgeted separately as
  `knowledgeFacts`, with source counts, stale-source and unchecked-source
  counts, included/omitted fact counts, and raw-field exclusion. Compact
  consumers validate those counts against
  `handoffCheckpoint.budgets.knowledgeFacts` and
  `harness.stateSummary.knowledgeFactCount`, and reject stale or unchecked
  source facts when they are handed off as high-confidence evidence.
  `knowledgeCache` records the resolved cache root and whether it came from the
  environment, workspace config, or the default user cache. Compact consumers
  validate those fields as handoff metadata; path-safety policy stays in the
  cache-root resolver.
  Report commands are covered through the real CLI entrypoint for
  `identity-report --json` and `impact-report --json` so downstream handoff
  paths exercise command parsing, file loading, contract parsing, and JSON
  output together.
  The compact validation payload includes `identityConflicts`, a low-noise
  machine-readable summary of Pulumi/Terraform exclusive-identity blockers
  with engine, conflict family, IaC resource locator when parseable, identity
  fields, risk category, review checklist, source command, and suggested
  review action. `validation.identityConflictSummary` carries total, included,
  omitted, engine, and risk-category counts so downstream agents do not treat
  the capped `identityConflicts` detail list as exhaustive. Compact result
  consumers validate summary count arithmetic, engine/risk-category totals,
  included-sample length, summary coverage for included conflicts, identity
  conflict engine/issue-kind alignment, supported risk categories, identity
  field shape, review steps, source command, and reporting-only
  `mutationAllowed=false` posture before deriving reports.
- `identity-report` renders an existing compact `agent --json` result into a
  read-only `infra-agent.identity-conflict-report` for human operators or other
  agents. It consumes `validation.identityConflicts`; it does not rerun
  Terraform, Pulumi, Helm, or any repair command. The input must be compact
  `infra-agent.agent-result` JSON with `schemaVersion: 1`, not full debug
  output or graph JSON. Reports include `mutationAllowed: false`,
  `incidentSummary`, and `omittedIncidentCount` so capped incident details are
  explicit in downstream handoff. The generated report is parsed through its
  own contract gate before return, including read-only posture, incident count
  consistency, engine/risk grouped counts, string-valued identities, and
  incident-level `mutationAllowed=false`.
  When a run is blocked by runtime exclusive-identity conflicts, suggested
  commands include an `agent --json > agent-result.json` export followed by
  `identity-report agent-result.json --json`.
- `impact-report` renders an existing `graph --json` result into a read-only
  `infra-agent.infra-graph-impact-report`. It consumes `infra-agent.infra-graph`
  JSON, validates schema version 1 and mutation-disallowed impact posture, and
  does not rerun native validators or mutate state. The report includes source
  provenance so downstream agents can distinguish workspace-inspection facts
  from Terraform plan or Pulumi preview impact data. Agents consuming saved
  impact report JSON should validate the
  `infra-agent.infra-graph-impact-report` schema and require
  `mutationAllowed: false` before using it as handoff context.
- `agent` can resume past approval-required pauses by rerunning with explicit
  approval flags such as `--approve-write-risk high` with optional
  `--approve-write-path charts/payments-api`, or
  `--approve-tool-category native-stack-config-write` for workspace-configured
  native operation approvals. The compact `approval.resume` block reports the
  same scoped continuation path, the primary signal it covers, and any
  additional pending approval scope; it is reporting only and does not bypass
  the approval requirement.
- Runtime validation issue classification recognizes Pulumi and Terraform
  provider exclusive-identity failures including CloudFront
  `CNAMEAlreadyExists`, API Gateway domain `ConflictException`, Route53
  `InvalidChangeBatch` record conflicts, load balancer listener rule
  `PriorityInUse`, security group rule `InvalidPermission.Duplicate`, and IAM
  OIDC provider `EntityAlreadyExists`, and reports them as non-repairable
  ordering blockers that require plan/preview/state review before aliases,
  Terraform moved blocks, `deleteBeforeReplace`, lifecycle sequencing, import,
  or state repair. Runtime classification reuses the shared exclusive identity
  specs used by graph impact analysis, so generic bucket, named-resource, and
  Kubernetes duplicate failures can carry the same family labels and suggested
  action metadata without injecting large provider docs into the prompt.
  Kubernetes `AlreadyExists` failures also expose parsed object names and
  namespaces when the CLI output includes them.
  Common AWS named-resource failures, such as ECR repositories and IAM roles
  that already exist, expose the parsed physical name as `duplicateIdentity`.
  Terraform runtime conflicts can also expose `resourceAddress`, and Pulumi
  runtime conflicts can expose `resourceName`, so downstream agents have a
  precise review candidate before considering moved blocks, aliases, import, or
  state repair.
- `inspect` resolves the knowledge-cache root used for future docs/schema
  context. `INFRA_AGENT_KNOWLEDGE_CACHE` is the explicit user override;
  otherwise `infra-agent.config.json` may set a workspace-relative
  `knowledgeCache.root`; otherwise the CLI uses the user cache directory.
- Internally, official-doc context retrieval is cache-first and produces compact
  excerpts for downstream planner use; automatic docs selection is still a
  planned follow-up.
- Terraform Registry context selection can now derive resource/data-source doc
  sources from `required_providers`, `.terraform.lock.hcl`, and Terraform
  resource blocks.
- Terraform agent runs load cached Registry context into planner prompts when it
  is relevant to the selected root; the runtime does not fetch missing docs from
  the network automatically yet.
- Helm chart context selection can derive high-confidence local schema packets
  from `values.schema.json` and cache-backed Helm/chart docs from `Chart.yaml`
  metadata.
- Helm agent runs load selected chart schema context into planner prompts by
  default; external Helm/chart docs are still cache-only unless explicitly
  fetched elsewhere.
- Helm chart context also reads `Chart.lock` and chart dependency metadata, so
  dependency chart names, versions, and HTTP(S) repositories can participate in
  cache selection without fetching non-document URLs such as `file://` or
  `oci://`.
- Knowledge extraction currently promotes selected cache/local entries into
  validated fact sets and bounded packs for Terraform Registry markdown, Pulumi
  docs markdown, Helm `values.schema.json` chart values, local Helm chart
  metadata/dependencies, and cached Helm chart-doc markdown. Optional artifact
  manifests record artifact hashes without credentials or upload commands.
  `knowledge publish` can stage reviewed unit artifacts into a workspace-local
  shared registry for team reuse. Public and internal-team units are publishable
  by default; workspace-private or private-run units require
  `--allow-workspace-private` so the operator explicitly marks that shared
  repository/module knowledge is intended for the team store.

CLI exit codes for downstream agents:

- `0`: command completed successfully
- `1`: fatal CLI or runtime error
- `2`: `agent` stopped with validation blockers
- `3`: `agent` stopped for required approval
- `4`: `agent` stopped for clarification
- `5`: `agent` exhausted the current loop without a safe terminal action
- `6`: `agent` exhausted the repair budget
- `7`: `run` preflight found blockers

## Installation

`infra-agent` currently runs directly from the TypeScript sources with Node
24's type stripping support. From a local checkout:

```sh
npm install
npm link
infra-agent --help
infra-agent --version
infra-agent doctor .
```

For package-shape validation without writing to the user npm cache:

```sh
npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json
```

The package surface is intentionally narrow: `bin/`, `src/`, `skills/`,
`AGENTS.md`, `README.md`, and selected durable docs. Test fixtures, smoke
scripts, and handoff history are excluded from the installable package.

LLM planner environment variables:

- `INFRA_AGENT_OPENAI_API_KEY` or `OPENAI_API_KEY`
- `INFRA_AGENT_LLM_PROVIDER` default `openai-compatible`
- `INFRA_AGENT_MODEL` default `gpt-5-mini`
- `INFRA_AGENT_OPENAI_BASE_URL` or `OPENAI_BASE_URL` default `https://api.openai.com/v1`

When both names are present, `INFRA_AGENT_*` values take precedence.
Agent and doctor CLI flags override non-secret provider/model/base URL env
values for that invocation. API keys are intentionally not accepted as CLI
flags.
The selected provider adapter contributes declarative capability metadata used
by requests and compact handoff: provider id, transport, endpoint path,
response format, JSON-object support, and streaming support. Unsupported
providers fail closed at config resolution, and tests use injected transports
instead of live provider calls.
Read compact `readiness.plannerProviderCatalog` first when an agent result is
already available. Use `infra-agent planner-providers --json` when another
agent needs the full static planner adapter catalog before choosing
`--planner llm`, `--model`, or gateway flags. Use `infra-agent doctor --json`
when it needs package/workspace readiness plus selected non-secret planner
config posture.

Development verification commands:

- `npm run lint`
- `npm run test:structure`
- `npm test`
- `npm run test:coverage`
- `npm run smoke`
- `npm run e2e`
- `npm run package:check`
- `npm run verify`

Use `npm run verify` as the full local gate before committing broad changes; it
includes coverage and package dry-run. Use `npm run test:coverage` when
changing shared runtime logic or reviewing CI coverage posture.

LLM planner tests use injected transports and do not call live providers.

The current agent runtime now supports several bounded real slices:

- inspect the highest-confidence Helm, Pulumi, and Terraform targets
- generate a scoped ingress edit plan for a Helm chart when the task clearly requests ingress work
- generate a bounded readiness/liveness probe edit plan for a Helm chart when the task clearly requests chart health checks
- generate a bounded Pulumi stack config edit plan when the task clearly requests stack-level config changes
- generate a bounded Terraform tfvars config edit plan when the task clearly requests Terraform variable updates
- write the planned files into the workspace
- run Helm, Pulumi, or Terraform validation commands after the write step

The current implementation focus remains:

- stabilize the general runtime across `Helm`, `Pulumi`, and `Terraform`
- preserve strict editing and approval boundaries
- prepare for repository-specific adaptation after the general runtime is stable

Internally, the runtime now follows a Claude Code-inspired shape:

- preflight state assembly
- query loop
- decision generation through a model client
- edit-plan generation
- tool execution
- tool result writeback into runtime state

For a local smoke test, the repository includes a sample workspace:

- `fixtures/sample-workspace/charts/payments-api`
- `fixtures/sample-workspace/infra/payments-api`

## Safety Contract

The agent must respect clear execution boundaries.

- Read-only repo inspection is allowed by default.
- File writes are controlled and scoped to the active workspace.
- Validation commands are expected and should be treated as normal execution.
- Destructive actions require explicit approval.
- Approval policy can be scoped by write risk globally and tightened further for specific repository paths.
- Repository profiles can also provide safer default approval rules when no explicit workspace config is present.
- Repository profiles can now also constrain which edit-plan kinds and target prefixes are allowed by default.
- Workspace config can now override those edit constraints with kind-scoped target prefixes when a repository needs tighter local rules than the profile defaults.
- Workspace config may set `knowledgeCache.root`, but it must be
  workspace-relative so a repository cannot redirect cache writes outside the
  active workspace.
- Terraform changes will ultimately be expected to follow the same bounded edit, validation, and approval model as Helm and Pulumi.
- `scrawlr-infra-cloud` stack edits now prefer existing `non-prod` / `prod` naming conventions over creating speculative new stack files.
- `scrawlr-infra-cloud` stack edits also prefer existing config key namespaces already present in stack files, instead of inventing a new key prefix from project metadata.
- `scrawlr-infra-cloud` environment config values now normalize to deployment labels such as `non-prod` / `prod` instead of copying full stack names like `tenant-shared.non-prod`.
- `scrawlr-infra-cloud` stack selection is now qualifier-aware, so tasks that mention labels like `tenant-shared` prefer matching existing qualified stacks instead of falling back to unrelated ones.
- `scrawlr-infra-apps` app-level Helm edits now distinguish `charts/apps` from `charts/infra`, so ingress/probe style mutations stay scoped to app charts by default.
- `scrawlr-infra-apps` ingress bootstrap for app charts now also injects a minimal `service.port` value when the chart has no existing service block, reducing one common validation repair round.
- Secrets and credentials must never be written into source-controlled files.

## Repository Documents

- [Development Plan](./docs/PLAN.md)
- [Execution Target](./docs/EXECUTION_TARGET.md)
- [Agent Rules](./docs/AGENT_RULES.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Repository Conventions](./docs/REPOSITORY_CONVENTIONS.md)

## Planned Repository Shape

This is the intended structure for the first implementation phase.

```text
infra-agent/
├── docs/
├── src/
│   ├── cli/
│   ├── agent/
│   ├── tools/
│   ├── validators/
│   ├── domain/
│   ├── prompts/
│   └── types/
├── test/
├── package.json
├── tsconfig.json
└── README.md
```

The implementation should follow the design docs first, then introduce code in small vertical slices.
