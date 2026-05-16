# infra-agent Roadmap

This document is the durable product and engineering plan for future sessions.
It refines the earlier phase plan with the current implementation state and with
runtime patterns learned from `learning-claude-code`.

## Active Development Priority

The next development phase is feature-first IaC context compilation, not
additional upload-boundary modeling or a larger standalone agent harness.
`infra-agent` should act as a specialist CLI and skill surface that compiles
Terraform, Pulumi, Helm, and eventually Argo CD/Kubernetes repositories into
semantic, low-token, cacheable context for Codex, Claude Code, Cursor, OpenCode,
and similar coding agents.

Codex/Claude Code should own file editing, shell execution, approvals, git
diffs, PR creation, rollback, and user-facing safety workflows. `infra-agent`
should own repo-specific IaC understanding: inventory, semantic dependencies,
compact knowledge units, changed-context impact, risk hints, provider/chart/
package references, and cache-aware handoff artifacts. Do not make `v0` a new
coding agent, deployment system, security scanner, or approval sandbox.

Keep Claude Code style safety principles inside the CLI where they protect
outputs: read-only defaults, dry-run versus mutation separation, secret
redaction, compact handoff, and explicit refusal to apply/deploy. Do not add
team-upload, backend-readiness, or remote-publication boundary stages unless a
real customer workflow explicitly requires shared artifact publishing.

Prioritize work that makes infrastructure edits more accurate and token
efficient:

1. Extract compact JSON units from public provider/package/chart/official-doc
   sources and internal local or repo-curated sources.
2. Analyze those units into the five core contracts: `fact`, `guidance`,
   `example`, `diagnostic`, and `recipe`.
3. Retrieve units deterministically by domain, version, resource/module/chart/
   component identity, target path, validation issue, planned action, risk,
   freshness, and privacy scope.
4. Build a metadata `knowledge index` over extracted/packed units, including
   compact budget `unitIndex` summaries, before planner handoff.
5. Validate facts, packs, units, and index artifacts through `knowledge
   validate` before reuse.
6. Feed selected units into planner prompts and edit-plan builders so they
   change real Terraform, Pulumi, and Helm behavior under tight token budgets.
7. Prove the value with workflows such as Terraform moved blocks, Pulumi
   aliases and stack config, Helm values migration, provider replacement risk,
   and validation-derived repair diagnostics.
8. Add diff-aware changed-context and scoped pack outputs so another agent can
   inspect fewer files for a specific change while still seeing affected
   modules, charts, stacks, Argo CD applications, Kubernetes resources, and
   risk hints.
9. Use semantic-unit hash caching, not repo-level caching alone. Cache file
   parses, Terraform module inventories, Pulumi stack summaries, Helm chart
   summaries, Argo CD application linkages, provider references, graph
   snapshots, and generated packs independently so unchanged context can be
   reused without re-tokenizing or re-analyzing the repo.

Legacy team-upload boundary code is sealed off from active development on
`agent-2`. The registry path is read-only artifact discovery and download of
reviewed `infra-agent.knowledge-units` payloads, not remote write/upload
execution.

Agent-2 reset policy:

- Treat team-upload and upload-boundary implementation as archived legacy
  ballast from `agent-1`. It is not part of the active product surface and must
  not receive new feature work.
- Prefer aggressive but staged reduction: keep active context-compiler
  commands covered, remove stale public docs, and delete hidden implementation
  only when no active CLI/parser/validator path depends on it.
- Keep only the safety properties that belong in a context compiler:
  read-only defaults, secret redaction, hash/freshness checks, schema
  validation, compact handoff contracts, and explicit refusal to execute
  apply/deploy/state mutations.
- Move engineering effort to `inventory`, `changed`, scoped `pack`, `refs`,
  `cache status`, semantic graph, and five-unit extraction quality.

Recent RAG progress moved the canonical public extraction targets into real
planner, edit-plan, and runtime behavior. Canonical public pack fixtures now
feed prompt regressions, compact unit search text is shared, Terraform
moved-block RAG is covered across all five unit types, Helm and Pulumi config
semantics are derived from compact facts, Helm/Pulumi edit plans consume those
facts, and runtime selection is scoped to current source/target context to avoid
target drift. The oversized knowledge pack ranking/contract coverage has been
split so `npm run test:structure` passes again. Terraform public Registry-shaped
docs now drive moved-block runtime behavior under a tight unit budget without
raw-doc leakage or provider-specific edit-plan branches. Compact Helm,
Terraform, and Pulumi units also influence validation command selection before
the six-command cap, including Helm template/lint, Terraform fmt/validate/plan,
and matching-stack Pulumi preview commands.

The current registry RAG implementation also supports target-scoped
`infra-agent.knowledge-units` artifact discovery by structured metadata. Public
or internal registries can describe Terraform provider/module, Pulumi
package/module, and Helm chart artifacts generically. Runtime knowledge
selection now keeps only the selected target per requested domain, preserves
selected workflow recipes, and routes planner RAG signals through the shared
planner knowledge unit selector. Future planner work should add new signals or
ranking reasons to that selector instead of scanning all compact units directly
inside planner branches.

The canonical public extraction target API and first target regressions now
exist for the agreed public examples, and current work should keep using the
canonical public target resolver plus compact target summaries:

- Terraform: HashiCorp AWS provider docs at
  `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
- Pulumi: `@pulumi/aws` / Pulumi AWS package/provider docs.
- Helm: `kube-prometheus-stack`.

These examples are the canonical v0 targets for proving public provider,
package, and chart extraction through generic behavior, not special parser
branches. Live tests remain opt-in when network access is unavailable. Stable
regression tests use cached fixtures generated from these same targets and
verify source identity, compact five-unit JSON shape, redaction, and
target-specific signals instead of brittle full-document golden output from
public `latest` pages.

The recommended knowledge workflow is now:

1. `knowledge sources`
2. `knowledge prefetch`
3. `knowledge extract` and/or `knowledge pack`
4. `knowledge index`
5. `knowledge validate`

This is the v0 RAG path for public and internal Terraform/Pulumi/Helm
knowledge. Do not make a Vector DB required for planner accuracy, and do not
write provider-specific parsers for the canonical examples.

Near-term user-facing command direction:

1. Keep `inspect`, `knowledge sources/prefetch/extract/pack/index/validate`,
   and `graph` as the current stable surfaces.
2. Add or evolve a repo `inventory` output from `inspect` so agents can read a
   compact list of tools, environments, modules, charts, stacks, values layers,
   and deployment linkages.
3. Add a diff-aware `changed` surface that accepts a base/head comparison and
   returns changed files, affected components, suggested files to inspect,
   omitted unrelated domains, and risk hints. This should be read-only and
   cache-aware.
4. Add a scoped agent `pack` surface that emits markdown or compact JSON for a
   path, module, chart, stack, environment, or changed-component set.
5. Add `cache status` style visibility for semantic-unit cache hits, misses,
   invalidations, and reused outputs.
6. Add compact `refs` lookups for Terraform/Pulumi/Helm interfaces only when
   they are tied to repo usage or the requested scope. Public reference lookup
   is supporting context, not the product center.

## Current Baseline

The repository already has a working TypeScript CLI skeleton with:

- `inspect`, `validate`, `run`, and bounded `agent` commands
- workspace inspection for Helm, Pulumi, and Terraform
- domain-focused targeting and validation selection
- a query loop with planner mode selection and bounded turn config
- controlled file tools and validation tools
- edit plans for selected Helm, Pulumi, and Terraform config workflows
- approval signals for higher-risk writes
- fixtures and smoke tests across mixed-domain workspaces

Recent implementation slices are documented in `docs/HANDOFF.md`. Future
sessions must preserve committed work and any newly discovered uncommitted
changes unless the user explicitly asks to rewrite history or discard work.

## Product Target

`infra-agent` should become an installable IaC context compiler CLI and an
agent-facing skill package for infrastructure configuration work. It is not a
general coding assistant and should not compete with Codex or Claude Code as
the operator-facing harness.

The CLI should help Infra and non-Infra users:

- inspect an existing infrastructure repo
- infer repository-specific conventions from concrete files
- retrieve only task-relevant official, public-registry, team, and repo-local
  knowledge
- compile agent-ready markdown/JSON context for a target path, module, chart,
  stack, environment, or git diff
- identify which files another agent should inspect and which files/domains are
  likely irrelevant for the current change
- provide compact provider, package, chart, and values references tied to how
  the current repo actually uses them
- expose semantic dependency graph JSON and diff-aware impact summaries
- provide risk hints such as IAM policy changes, public ingress changes,
  image-tag changes, sync-policy changes, state/rename risk, or replacement
  cascades
- validate syntax, schema, module inputs, and provider constraints
- explain update, replace, rename, and dependency impact before another tool
  edits, reviews, or plans deployment

Final safety decisions remain outside the product boundary. Human reviewers,
CI/policy engines, and the calling coding agent decide whether to approve,
apply, merge, roll back, or create a PR.

## Claude Code Patterns To Keep

Borrow the runtime architecture, not the full product surface.

- Snapshot immutable query config at loop entry.
- Keep mutable runtime state separate from config.
- Treat tool calls and tool results as first-class events.
- Write tool results back into state in one deterministic place.
- Preserve permission and approval facts as structured state.
- Use progressive disclosure for context: metadata first, detailed references only
  when needed.
- Keep agent-facing skills lean; move detailed domain references behind links.
- Summarize tool activity for operator visibility without making summaries part of
  correctness.

Avoid copying these into v0:

- multi-agent orchestration
- background daemon behavior
- chat or terminal UI productization
- broad coding-agent tools
- speculative autonomous deploy/apply flows

## Architecture Target

The product should settle into seven layers.

1. **Installable CLI**
   - publishable package shape
   - stable `bin/infra-agent.js`
   - compact JSON output for other agents
   - clear exit codes for blocked, failed validation, and completed runs

2. **Agent Skill Surface**
   - bundled `skills/infra-configuration/SKILL.md`
   - instructions for other agents to call the CLI instead of hand-editing IaC
   - minimal trigger metadata and deeper references loaded only when needed

3. **Bounded Runtime and Handoff Internals**
   - immutable query configuration and mutable runtime state where still needed
   - compact JSON handoff contracts for other agents
   - deterministic tool-result writeback for validation and inspection results
   - no autonomous apply/deploy loop in v0
   - approval and policy state only where needed to block CLI-owned mutation
     paths or explain why a result is read-only

4. **Repository and Domain Tools**
   - repository search/read tools and narrowly scoped write helpers only where
     existing behavior requires them
   - Helm, Pulumi, and Terraform inspection adapters
   - Argo CD Application and Kubernetes manifest discovery as read-only graph
     and changed-context sources
   - native CLI wrappers with structured outputs
   - safe shell boundaries for validation only

5. **Knowledge and Context System**
   - version-aware local cache for official docs, examples, schemas, and
     extracted units
   - public-reference registry for provider, package, chart, and official-doc
     knowledge units that can be downloaded consistently across workspaces
   - internal registry workflow for repo-local and team-private knowledge units
     stored locally, in repo-curated packs, or behind opt-in team backends
   - structured extraction into `fact`, `guidance`, `example`, `diagnostic`,
     and `recipe` units from cached docs, schemas, examples, validation output,
     plan/preview output, and repo-local code
   - semantic-unit hash cache for file parses, module/chart/stack summaries,
     Argo CD linkages, provider references, graph snapshots, and generated
     agent packs
   - scoped markdown/JSON packs for Codex/Claude Code consumption
   - repo-local and validator-derived units as the highest priority source
   - provider, module, chart, and validation schemas preferred over prose where
     available
   - deterministic retrieval and ranking by domain, version, resource/module/
     component identity, target path, validation issue, planned action, risk,
     freshness, and privacy scope before any vector-style discovery

6. **Semantics and Validation Layer**
   - YAML syntax parsing before any YAML write is accepted
   - Helm schema/lint/template validation
   - Terraform fmt/validate plus provider/module schema extraction
   - Pulumi config/preview plus language-level checks when project type is known
   - semantic constraints for exclusive options, required companions, defaults,
     replacement risk, and dependency relationships

7. **Change Impact and Graph Layer**
   - normalized infra graph JSON first
   - Argo CD -> Helm -> Kubernetes and Terraform/Pulumi -> Kubernetes/resource
     edges where they can be derived from repo evidence
   - diff-aware changed-context summaries with suggested files and omitted
     unrelated context
   - risk hints, not final safety judgments
   - state/rename impact analysis before any web UI
   - local topology visualization only after graph data is reliable

## Knowledge Strategy

Use a deterministic infra-knowledge model.

Do not bundle full official docs into the package. Full docs go stale, create a
large install, and can mismatch provider versions. Instead:

- bundle only durable retrieval logic, parsers, validation adapters, and small
  hand-authored rules
- persist official docs, examples, schemas, summaries, and extracted knowledge
  units in a local versioned cache
- publish public-reference provider/package/chart/official-doc knowledge units
  to a shared registry so agents can download already-extracted data instead of
  reprocessing public sources per workspace
- let internal knowledge use the same extraction, validation, packing, and
  retrieval workflow while choosing local, repo-curated, or opt-in team storage
  according to privacy scope
- accept prebuilt `infra-agent.knowledge-units` artifacts as read-only local or
  URL-backed sources, and expand read-only registry JSON into matching artifact
  sources for the requested domain and target with optional SHA-256 artifact
  hash checks
- build deterministic `infra-agent.knowledge-index` metadata artifacts from
  extracted or packed units so retrieval can use source-linked unit metadata
  without a Vector DB or raw source replay
- dynamically fetch or refresh official sources when the cache is missing, stale,
  or for a different provider/chart/package version
- reuse repo-local cached facts only after path/hash fingerprints still match
  the current workspace
- always prefer repo-local files, lockfiles, installed provider schemas, chart
  schemas, and validator output over generic docs prose

Cache invalidation should be semantic-unit based. A changed Helm values file
should invalidate its file parse, chart summary, linked Argo CD application
context, affected graph nodes, and generated packs for that scope, but it should
not force unrelated Terraform modules, Pulumi stacks, provider references, or
other chart summaries to be reprocessed. Every cache entry must be safe to
describe in compact output: use paths, content hashes, source ids, versions,
freshness, and omission counts, but do not expose secrets or raw credential-like
values.

The core context-compiler outputs should be:

- **inventory**: compact repo/tool/environment/module/chart/stack/application
  summaries.
- **graph**: normalized semantic nodes and edges with source evidence and
  confidence.
- **pack**: scoped markdown or JSON for another agent to read before editing.
- **changed context**: base/head diff impact, affected components, suggested
  inspection files, omitted unrelated context, and risk hints.
- **refs**: compact provider/package/chart references tied to the requested
  scope or actual repo usage.
- **cache report**: hit/miss/reused/invalidated posture for semantic units and
  generated outputs.

Canonical v0 public extraction targets:

- Terraform provider docs: HashiCorp AWS provider,
  `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
- Pulumi package/provider docs: AWS.
- Helm chart docs: `kube-prometheus-stack`.

These targets now anchor the first network-backed extraction checks and cached
fixtures used by ordinary tests. They must continue to normalize into the same
five JSON unit families as every other public or internal source.

The cache key should include at least:

- source kind: `terraform-registry`, `pulumi-docs`, `helm-docs`, `chart-docs`,
  `repo-example`, or `module-readme`
- provider, module, chart, or package name
- resolved version or version constraint
- URL or local path
- content hash or ETag when available
- fetched time and stale-after policy

Knowledge packs should separate five unit types:

- `fact`: compact JSON constraints and relationships used by edit planning,
  validation prechecks, and impact analysis.
- `guidance`: short JSON-carried explanations with `appliesWhen`, `avoidWhen`,
  and risk notes.
- `example`: bounded snippets or config samples, included only when an edit
  needs concrete shape guidance.
- `diagnostic`: validation, plan, preview, or provider error signatures with
  likely causes and review-only remediation guidance.
- `recipe`: safe procedural workflows for rename, import, alias, moved block,
  stack config, values migration, and similar infrastructure changes.

The planner should receive compact retrieved context packets, not whole
documents. Each packet should include selected unit summaries, source, version,
confidence, freshness, privacy scope, omission counts, and why it was selected.
Vector search is not a core requirement for v0 RAG; exact metadata retrieval,
schema facts, validators, plan/preview diagnostics, and deterministic ranking
are the default path for accuracy and token efficiency.

Budget summaries should expose `unitIndex` posture when available. Treat
multi-source source-level omitted distribution as an estimate until a later
slice makes per-source omission accounting exact.

## Knowledge Extraction And Storage Plan

This is a core product area. Infrastructure agents become materially better
when they can reuse source-linked, versioned, validated facts about providers,
resources, modules, components, and charts instead of relearning the same public
or repository-local material on every run.

Current progress as of 2026-05-13:

| Area | Status | Current capability | Main gap |
| --- | --- | --- | --- |
| Local knowledge cache | Partial | Version-aware local JSON entries with source metadata, content hash, stale-after policy, cache-root resolution, and fingerprint-checked reuse for repo-local extraction outputs | No structured fact index or remote backend |
| Official docs source selection | Partial | Terraform Registry source selection for used resources/data sources; Helm source selection from `values.schema.json`, `Chart.yaml`, and `Chart.lock`; Pulumi source selection for project config, YAML runtime official docs, package-level Pulumi Registry docs from project manifests, and resource-level Pulumi Registry docs from deterministic Pulumi YAML resource tokens plus conservative Node.js/TypeScript import/require constructor evidence | Pulumi resource-level docs source selection is not yet component, dynamic alias/dataflow, generated-code, or non-Node-language coverage |
| Official docs retrieval | Partial | Explicit `prefetch` and `knowledge prefetch` can fetch bounded official/external sources through mocked-testable fetchers; public URL-backed docs get a default stale-after policy; HTML official-doc responses are normalized into compact Markdown cache entries in the explicit fetch path; `knowledge sources` reports fresh/stale/missing cache posture without fetching; prefetch results report previous cache posture for each source | Agent loop remains cache-only for automatic runs; live refresh is still deliberate |
| Repo-local semantics | Partial | Helm schema, Helm chart metadata/dependency facts, Terraform variables/validation blocks, Pulumi stack config, local Terraform provider schema exports, local Terraform module interface facts, conservative Node.js/TypeScript Pulumi component interface and child-resource facts, and bounded Helm schema knowledge packs | Non-Node Pulumi component discovery and dynamic/deeper component internals are not implemented |
| Structured knowledge extraction | Partial | Normalized `KnowledgeFact` / `KnowledgeFactSet` contracts, explicit `KnowledgeUnit` / `KnowledgeUnitSet` contracts for `fact`, `guidance`, `example`, `diagnostic`, and `recipe`, cache-first extraction, validation, bounded packs, runtime fact loading, planner prompt summaries, compact `knowledgeFacts`, result-card counts, deterministic fact/unit ranking, focused Terraform provider schema facts, local Terraform module input/output facts, Pulumi config facts, Pulumi component input/output/child-resource facts, cached Pulumi config/YAML/package/resource docs facts selected from YAML and Node.js/TypeScript constructor evidence, local Helm metadata/dependency facts, cached Helm chart-doc markdown `chart-value` facts, fact-derived required-input guidance, provider/Helm diagnostics, Terraform/Helm/Pulumi workflow recipes, conservative markdown section extraction for explicit examples, best practices, troubleshooting/errors, and upgrade/migration workflows, local curated internal units, prebuilt unit artifact sources, canonical public target resolver/summaries, knowledge unit metadata index, budget summary `unitIndex`, `knowledge index` CLI, index validation through `knowledge validate`, and structured local freshness summaries for stale or unchecked repo-derived facts | Runtime/edit-plan use of markdown-derived diagnostic and recipe units, Non-Node Pulumi language discovery, dynamic/deeper component internals, exact multi-source pack source-level omitted distribution, and real team storage backends are pending |
| Shared artifacts | Partial | Active branch keeps local cache, plan-only artifact manifests, validated prebuilt `infra-agent.knowledge-units`, read-only artifact registries, storage-policy metadata, and a lean `knowledge publish` command that stages validated unit artifacts into a workspace-relative content-addressed shared store plus registry JSON. Legacy team-upload/backend-readiness/upload boundary implementation remains removed. | No S3/GCS/Azure/Postgres backend, no credential read, no live backend check, no upload command generation, and no approval/token/lease runtime boundary in v0 |

Archived note: the 2026-05-10 upload-boundary addenda were part of the sealed `agent-1` safety-surface expansion. They are intentionally removed from the active `agent-2` roadmap.

Target artifact families:

- `infra-agent.knowledge-unit`: the normalized retrieval unit for
  infrastructure RAG. Unit types are `fact`, `guidance`,
  `example`, `diagnostic`, and `recipe`; every unit carries source,
  version or commit, confidence, freshness, privacy scope, source locator,
  extraction method, and token-budget metadata.
- `infra-agent.knowledge-source`: selected source metadata for official docs,
  local schemas, examples, module READMEs, chart metadata, and configured
  internal curated unit files.
- `infra-agent.knowledge-cache-entry`: raw or lightly normalized fetched/local
  content, stored by version-sensitive source id.
- `infra-agent.knowledge-facts`: extracted facts such as provider/resource
  arguments, required attributes, defaults, enum-like values, nested blocks,
  replacement-sensitive fields, identity fields, examples, chart values, module
  inputs/outputs, Pulumi component config shape, chart metadata, and chart
  dependencies.
- `infra-agent.knowledge-pack`: a bounded, validated bundle of facts and
  units for one provider version, resource type, chart version, module,
  component, or repo target. Repo-local pack sources carry compact safe
  path/hash fingerprints so reuse can be rejected when local files change.
- `infra-agent.knowledge-index`: a deterministic metadata index over extracted
  or packed units. It records source-linked selectors, target summaries,
  counts, freshness, privacy scope, budget posture, and validation metadata
  without raw docs or provider-specific parser state.
- `infra-agent.knowledge-artifact-manifest`: a plan-only local manifest for
  persisted extraction or pack artifacts. It records byte-level artifact hash,
  storage-policy summary, source ids, required validation commands, and
  `mutationAllowed=false`. It is not a publication or upload request.
- `infra-agent.curated-knowledge-units` and read-only unit artifact registry
  payloads: reviewed local or explicitly configured catalogs that can feed the
  same extract, validate, rank, pack, and index path without remote writes.
- `infra-agent.knowledge-shared-artifact-publish`: a report from explicit
  local-file shared artifact staging. It records the source unit artifact,
  content-addressed stored path, registry path, privacy scopes, and whether a
  registry entry was replaced. It does not include credentials, backend URLs,
  live-check results, upload commands, approval tokens, or execution leases.

Extraction rules:

- Every fact must carry source id, source URL or local path, version or commit,
  extraction method, confidence, and a short source locator.
- Extracted facts are advisory unless confirmed by repo-local schemas,
  validators, provider schemas, plan/preview output, or explicit user/team
  curation.
- Public provider/chart facts should not be committed into every user repo by
  default. Store them in the user cache or a team cache. Repos may commit small
  curated packs only when the team intentionally wants reviewed policy or module
  knowledge in version control.
- Knowledge packs must carry storage/publication metadata so future publication
  gates can distinguish public-reference facts from workspace-private facts.
- Private repo facts must be opt-in. Do not upload or share user module,
  component, chart, or code-derived facts without explicit configuration.
- Planner prompts should receive budgeted fact summaries, not full cached docs
  or full repo files.

Implemented initial CLI surfaces:

- `infra-agent knowledge sources <workspace> [--domain helm|pulumi|terraform] [--target <path>] [--json]`
  - lists selected knowledge sources without fetching.
- `infra-agent knowledge prefetch <workspace> ...`
  - aliases the bounded explicit cache update path.
- `infra-agent knowledge extract <workspace> [--domain ...] [--target ...] [--source <id>] [--out <knowledge.json>] [--units-out <dir>] [--manifest-out <manifest.json>] [--json]`
  - extracts normalized facts and five-unit artifacts from cached docs,
    repo-local schemas, examples, modules, components, charts, and configured
    curated/unit-artifact sources. `--out` persists the generated report;
    `--units-out` additionally writes one standalone
    `infra-agent.knowledge-units` artifact per extracted source.
- `infra-agent knowledge validate <knowledge.json> [--workspace <workspace>] --json`
  - validates schema, source links, count consistency, freshness/fingerprints,
    confidence labels, compact pack/index/manifest posture, and secret safety
    before facts or units are used by a planner.
- `infra-agent knowledge pack <workspace> [--domain ...] [--target <path>] [--source <id>] [--max-units <n>] [--max-facts <n>] [--out <pack.json>] [--manifest-out <manifest.json>] --json`
  - builds a bounded `knowledge-pack` for local handoff. `--manifest-out` writes
    a plan-only local artifact manifest with no backend URL, bucket,
    credential, upload command, or remote write posture.
- `infra-agent knowledge index <workspace> ...`
  - builds a deterministic metadata index from bounded units before planner
    reuse. The index is the preferred lookup surface for public/internal
    five-unit RAG and must remain source-linked, compact, raw-content-free, and
    parser-neutral.
- `infra-agent knowledge publish <knowledge-units.json> --workspace <workspace>
  --store-dir <dir> --registry <registry.json> ...`
  - validates a standalone `infra-agent.knowledge-units` artifact, stores it by
    SHA-256 under a workspace-relative shared directory, and updates a
    `infra-agent.knowledge-unit-registry` JSON file. It is the retained team
    collaboration path for shared knowledge artifacts. It is intentionally not
    the old safety-boundary stack: no cloud client, credential read, live check,
    upload command, approval chain, write token, lease, or runtime execution
    boundary is created.

Removed from active CLI surface:

- Legacy team-upload, backend-readiness, publication-readiness, and upload
  boundary commands. Future remote shared-catalog work should extend the lean
  artifact store/publish contract instead of reviving the old boundary chain.

Recommended storage layers:

- Local default: current filesystem cache under the resolved knowledge-cache
  root. Implemented behind a `KnowledgeStore` interface so retrieval and
  prefetch can be tested against injected stores before remote backends exist.
- Repo-curated: small reviewed packs under a workspace-relative configured path,
  never automatic bulk cache commits. Saved repo-derived fact sets should be
  revalidated with `knowledge validate --workspace` so file hash drift is
  detected before reuse. Saved compact packs, indexes, and manifests should
  also pass `knowledge validate` before handoff.
- Shared catalogs: explicitly configured `infra-agent.knowledge-units`
  artifacts and registries that can be discovered, downloaded into the local
  cache, hash-checked, and validated. `knowledge publish` can also stage unit
  artifacts into a workspace-relative shared directory and update the registry
  file. Remote shared storage remains future work: no cloud SDK client,
  credential read, live backend check, generated upload command, or remote
  metadata-index mutation in v0.
- Package-bundled: only schemas, extractors, validators, and small durable rules.
  Do not bundle full provider docs.

Measurable milestones:

1. **Knowledge Fact Schema**
   - Add `KnowledgeFact`, `KnowledgeFactSet`, and parser contract.
   - Acceptance: unit tests reject missing source ids, unsupported fact kinds,
     stale/invalid version metadata, and secret-looking values.
2. **Official Docs Extractor Tool**
   - Extract Terraform Registry resource/data-source arguments and examples from
     cached markdown/JSON; add a Helm chart values extractor for schema/docs.
   - Acceptance: mocked cached docs produce deterministic facts for at least
     three Terraform resource types and two Helm chart/schema cases.
3. **Repo Knowledge Pack**
   - Extract module/component/chart facts from local Terraform modules, Pulumi
     projects/components, Helm charts, examples, and READMEs.
   - Acceptance: fixture workspace produces a bounded pack with module inputs,
     chart values, chart metadata/dependencies, Pulumi stack config shape,
     source locators, and no secrets.
4. **Planner Consumption**
   - Implemented 2026-05-05: runtime loads bounded `knowledge-pack` facts from
     cache/local sources, planner prompts receive capped `knowledgeFacts`
     summaries, `--context-fact-limit` controls the budget, compact
     `agent --json` exposes root-level `knowledgeFacts`, and the compact parser
     validates fact counts, omitted counts, source provenance, stale counts,
     handoff budgets, and raw-field exclusion.
   - Implemented 2026-05-05: `knowledge-pack` now ranks facts before truncation
     so small budgets prefer local schema facts, required inputs, type/default
     constraints, identity/replacement signals, target-local sources, and fresh
     high-confidence facts before examples or low-value attributes.
   - Implemented 2026-05-05: local Terraform provider schema exports are
     compacted to the selected root's used resources/data sources, then
     converted into provider-versioned `argument`, `attribute`, and
     `nested-block` facts without exposing the full `provider_schemas` JSON.
   - Implemented 2026-05-05: literal local Terraform module calls are
     discovered as `terraform-module` sources and converted into ranked
     `module-input` / `module-output` facts from compact module interface
     summaries, without exposing raw `.tf` content.
   - Implemented 2026-05-05: Pulumi project and stack config are discovered as
     `pulumi-config` sources and converted into ranked
     `pulumi-config-parameter` facts from compact local summaries, without
     exposing raw YAML, secure values, or secret-like keys.
   - Implemented 2026-05-05: Helm `Chart.yaml` and sibling `Chart.lock` files
     are discovered as local `chart-metadata` sources and converted into ranked
     `chart-metadata` and `chart-dependency` facts. Locked dependencies from
     `Chart.lock` take precedence over declared dependency ranges, and raw chart
     YAML, lock digests, and generated timestamps stay out of packs, runtime
     facts, and CLI JSON.
   - Implemented 2026-05-06: Pulumi projects now select bounded public
     `pulumi-docs` sources for official configuration docs and YAML runtime
     docs from `Pulumi.yaml`/stack-file metadata. These sources are listed and
     prefetched through the existing public-reference cache path.
   - Implemented 2026-05-06: cached `pulumi-docs:config` and
     `pulumi-docs:yaml` markdown entries now extract bounded
     `pulumi-docs-guidance` facts through the `pulumi-docs-markdown`
     extraction method. These are medium-confidence public-reference guidance
     facts and do not include raw docs, HTML, examples, or secret-looking
     values.
   - Implemented 2026-05-06: Pulumi project-root `package.json` manifests now
     select package-level Pulumi Registry API docs sources for safe `@pulumi/*`
     dependencies, excluding `@pulumi/pulumi`. These sources are URL-backed,
     public-reference, target-filtered, deduped by cache id, and do not expose
     raw package manifest content or local dependency specs.
   - Implemented 2026-05-07: Pulumi YAML projects now record deterministic
     `resources.<name>.type` tokens, use them for targeting details, and select
     resource-level Pulumi Registry API docs sources such as
     `pulumi-docs:resource:aws:s3/bucket`. Source selection uses safe
     `@pulumi/*` dependency versions when available and remains
     public-reference/cache-first.
   - Implemented 2026-05-07: Node.js/TypeScript Pulumi projects now scan
     bounded project-root source files for conservative `@pulumi/*`
     import/require bindings plus explicit resource constructors such as
     `new aws.s3.Bucket(...)`. That parser records compact evidence locators,
     skips comments, strings, generated/test/declaration files and ignored
     directories, and selects the same public-reference resource docs path
     without exposing raw source code. Package dependencies still provide
     version context only; they do not prove resource usage.
   - Implemented 2026-05-07: cached Pulumi Registry resource docs markdown can
     extract bounded medium-confidence `argument` facts from resource input
     tables or bullets. Compact `knowledgeFacts` accepts these resource facts
     while continuing to reject raw docs URLs, cache payloads, and stale-source
     high-confidence facts.
   - Implemented 2026-05-07: cached Pulumi Registry package docs markdown can
     extract bounded medium-confidence `pulumi-docs-guidance` facts from
     package module tables, bullets, and headings selected by safe project-root
     `@pulumi/*` dependencies. These package docs facts stay
     public-reference/advisory, rank below local Pulumi config facts, enter
     compact planner prompts through `knowledgeFacts`, and exclude raw docs,
     package manifests, URLs, cache timestamps, and content hashes from compact
     handoff.
   - Implemented 2026-05-07: cached Helm chart-doc markdown can extract bounded
     medium-confidence `chart-value` facts from chart values tables, bullets,
     and headings selected from chart `home`, `sources`, or dependency HTTP(S)
     docs sources. These chart-doc facts remain cache-first public-reference
     advisory context, rank below local `values.schema.json`, `Chart.yaml`, and
     `Chart.lock` facts, cannot be promoted above medium confidence, enter
     planner prompts only through compact `knowledgeFacts`, and exclude raw
     markdown, external URLs, cache timestamps, and content hashes from compact
     handoff.
   - Implemented 2026-05-08: conservative Node.js/TypeScript Pulumi
     `ComponentResource` classes are discovered as local `pulumi-component`
     sources. The extractor emits high-confidence `pulumi-component-input` and
     `pulumi-component-output` facts from constructor args interfaces/types and
     public output property declarations, skips generated/test/declaration
     paths and secret-like fields, preserves recheckable source fingerprints,
     ranks local component interface facts above public docs guidance, and
     excludes raw source content from packs, planner prompts, and compact
     handoff.
   - Implemented 2026-05-09: the same conservative Node.js/TypeScript
     `ComponentResource` path now emits high-confidence
     `pulumi-component-child-resource` facts for child Pulumi resource
     constructors declared inside detected component class bodies. Facts carry
     only the child resource name, Pulumi type token, source locator, and safe
     related paths; constructor argument objects, raw source/import text,
     generated/test files, root-level resources, and secret-like names remain
     excluded. These facts rank as local component evidence below required
     component inputs and above public Pulumi docs guidance.
   - Implemented 2026-05-08: `knowledge validate --workspace` reports a
     structured `infra-agent.knowledge-freshness-summary` with stale and
     unchecked local source counts, affected fact counts, safe source ids,
     source kinds/names, stale reasons, and safe workspace-relative
     stale/missing paths. Compact `knowledgeFacts` now exposes
     `uncheckedSourceCount`, result cards mirror stale/unchecked source posture,
     and stale or unchecked source facts are not handed off as high-confidence
     compact context.
   - Remaining: non-Node Pulumi language discovery, dynamic/deeper component
     internals, optional markdown normalization for live official docs, and
     opt-in team storage backends.
5. **Refresh And Staleness**
   - Implemented for local repo-derived facts. Changing a local source file or
     deleting a fingerprinted file marks derived facts stale during
     `knowledge validate --workspace`, reports safe stale/missing paths, and
     prevents stale or unchecked sources from producing high-confidence compact
     handoff facts.
   - Implemented 2026-05-09 for public official-doc cache posture:
     `knowledge sources` reports `fresh`, `stale`, and `missing` cache status
     for URL-backed public docs without fetching, text output marks when
     deliberate `knowledge prefetch` is recommended, and prefetch results
     expose each source's previous cache posture while preserving existing
     prefetch status values.
   - Implemented 2026-05-09 for explicit official-doc fetch normalization:
     `fetchOfficialKnowledgeSource` converts HTML-shaped official-doc responses
     into compact Markdown cache entries for existing Pulumi and Helm markdown
     extractors, strips high-noise HTML blocks, preserves TTL behavior, and
     leaves fresh cache entries untouched.
   - Remaining: opt-in team storage backends.
6. **Team Backend Abstraction**
   - Define a storage interface after local schema and validation settle.
   - Acceptance: local filesystem remains default; mocked S3-compatible adapter
     stores and retrieves content-addressed packs without leaking private data.

## Validation Strategy

Validation should be tool-first and layered.

- **Universal YAML**: parse every touched YAML file before and after edits.
- **Helm**: `helm lint`, `helm template`, values schema checks when
  `values.schema.json` exists, and Kubernetes schema validation through an
  optional adapter such as `kubeconform`.
- **Terraform**: `terraform fmt -check`, `terraform validate`, `terraform
  providers schema -json` where initialized, `terraform plan -json` for impact
  analysis when state/backend access is available, and optional `tflint`.
- **Pulumi**: preview-only `pulumi preview` validation with local safe
  environment defaults, stack config inspection, language checks such as `tsc`
  or package tests when detected, and preview JSON/event parsing for
  replacements and dependency impact. Local backend bootstrap, `pulumi stack
  init`, login, refresh/import, and state mutation remain outside validation;
  bounded native stack config writes require `native-stack-config-write`
  approval.
- **Policy**: optional `conftest`, `checkov`, or organization-specific validators
  should be workspace-configured, not hardcoded as mandatory.

The LLM may propose a repair, but deterministic validators decide whether a
configuration is acceptable.

## Module Semantics Strategy

Infrastructure modules and chart values need a structured semantic model, not
only prompt reasoning.

Represent discovered constraints as `ConfigSemantics` records:

- required fields
- defaulted fields
- enum values
- mutually exclusive groups
- at-least-one and exactly-one groups
- fields that imply new required fields
- fields that become invalid when another mode is selected
- identity fields that often indicate rename vs replacement
- fields likely to force replacement
- dependency edges between resources or rendered objects
- confidence and source for every fact

Sources should be ordered by authority:

1. repo-local schemas and validation blocks
2. native tool schema output and preview/plan output
3. official docs for the exact resolved version
4. examples from the same repo or module
5. LLM-inferred candidates marked as low confidence until a tool confirms them

This layer should drive both generation and explanation. For example, if an
option selects `ingress.enabled=true`, the agent should know that host, class,
TLS, service port, and path semantics may become relevant, and should ask or
infer from repo examples before writing incomplete values.

## Rename And Replacement Strategy

Terraform and Pulumi often describe source-level renames as delete/create
operations. `infra-agent` should add a plan-analysis layer that can distinguish:

- pure source-address renames where the remote resource identity is unchanged
- provider identity changes that require replacement
- field updates that can happen in place
- replacement cascades caused by dependencies
- unknown cases where state inspection is required

The CLI should suggest safe state operations or source-level alias/moved-block
patterns, but v0 should not execute state mutations automatically.

Initial Terraform support should parse plan JSON and compare delete/create pairs
by provider type, stable identity attributes, module path, and dependencies.
When confidence is high, suggest `moved` blocks or state move guidance. When
confidence is medium or lower, ask the user to confirm whether it is a rename.

Initial Pulumi support should parse preview events and identify URN/name/type
changes that may be modeled as aliases or state operations. It should explain
replacement reasons and dependency cascades before suggesting any state change.

## Topology Visualization Strategy

The topology web UI is useful, but it depends on a reliable graph model.

Do this first:

- produce `infra-agent graph --json`
- include resources, logical modules/stacks/charts, dependencies, exposure hints,
  replacement risk, and confidence
- derive graph data from repository facts, rendered Helm manifests, Terraform
  plan/state JSON where available, and Pulumi preview/stack exports where
  available

Only after that should the project add a local web server. The first UI should be
local-only and read the graph JSON. It should start with high-value views:

- VPC/subnet/resource containment
- load balancer to service to workload paths
- security-group or NetworkPolicy reachability hints
- cross-stack/module references
- planned create/update/delete/replace changes

## Next Execution Plan

### Step 1: Stabilize Current Runtime Slices

- Review staged and unstaged work in `docs/HANDOFF.md`.
- Commit or otherwise preserve the current slices intentionally.
- Keep the full local gate passing with `npm run verify` and `git diff --check`.
  For test-only changes, also run the affected layer (`npm run test:unit`,
  `npm run test:integration`, or `npm run test:contract`) and
  `npm run test:structure`.

### Step 2: Make The Agent-Facing Surface Real

- Keep `skills/infra-configuration/SKILL.md` in the repo as the canonical
  instruction surface for other agents.
- Add compact JSON result mode if `agent --json` becomes too verbose.
- Add a documented install path once package metadata is ready to publish or
  install from git.

Status on 2026-04-28:

- `agent --json` now emits a compact `infra-agent.agent-result` payload for
  downstream agents instead of the full runtime state.
- `agent --json-full` remains available for full debug state output.
- `identity-report <agent-result.json>` can render compact identity conflict
  data into `infra-agent.identity-conflict-report` without rerunning validators
  or native IaC commands. The renderer validates compact result
  `schemaVersion=1` before reading `validation.identityConflicts`.
  Validation-blocked runs with runtime exclusive-identity conflicts now include
  suggested commands to export compact JSON and render the focused incident
  report.
- The compact payload includes outcome, target, changed files, result-card
  lines, next steps, suggested commands, validation issue summaries, semantic
  blockers, exclusive-identity conflict summaries with triage risk categories,
  approval signals, and the resolved knowledge-cache root.
- Planner prompts now include compact `runtimeIdentityConflicts` derived from
  runtime validation issues, so LLM decisions can see exclusive-identity risk
  category and review context without parsing raw provider stderr.
- LLM client request/response contracts are testable with injected transports,
  keeping planner tests deterministic and independent of live LLM providers.
- LLM planner mode selection and environment precedence are testable with
  explicit environment maps, avoiding process-wide environment mutation in unit
  tests.
- Agent and doctor commands can now accept non-secret OpenAI-compatible planner
  overrides for provider, model, and base URL. API keys remain env-only,
  compact handoff records `harness.plannerConfig`, and approval continuation
  commands preserve CLI-selected planner flags.
- The OpenAI-compatible planner provider now has a small adapter/capability
  boundary. Request transport details live outside `LLMModelClient`, doctor
  and result-card output summarize non-secret capability posture, and compact
  `harness.plannerConfig.llm.capabilities` is parser-validated before handoff.
- `planner-providers [--json]` now exposes the declared LLM planner adapter
  catalog as a read-only, non-secret text/JSON report for downstream agents.
  It does not inspect workspaces, resolve secrets, or prove live model
  reachability.
- Claude Code harness design notes are persisted in
  `docs/CLAUDE_CODE_AGENT_PATTERNS.md`; compact agent output includes
  `harness.turnTrace` and `harness.toolTrace` for low-noise per-turn and
  tool-summary handoff.
- Retrieved official-doc/schema context is compacted through a shared budget
  helper before planner handoff, and compact output now reports
  `knowledgeContext` packet/token budget metadata.
- Context packet and token budgets are explicit query harness config and can be
  adjusted from the CLI with `--context-packet-limit` and
  `--context-token-budget`.
- Tool summaries now carry explicit permission categories, and compact harness
  output aggregates workspace mutations, native CLI calls, and stack/state
  mutation-risk tools.
- Compact `agent --json` output now includes a targeted `readiness` block with
  planner mode, workspace blocker status, selected validation plan status, and
  only validators required by that selected plan, plus a `doctorCommand` for
  the fuller read-only package/Node/tool report.
- Result cards now include compact readiness posture, and suggested commands
  prepend the read-only `doctorCommand` whenever readiness is warn or fail.
- Workspace approval policy can now require explicit approval for tool
  categories, with `--approve-tool-category` used to resume gated native
  operations.
- CLI exit codes now distinguish completed runs, validation blockers, approval
  pauses, clarification pauses, no-safe-action exits, repair-budget exhaustion,
  fatal errors, and `run` preflight blockers for downstream agent control flow.
- Package metadata now exposes the `infra-agent` bin and a narrow installable
  surface containing `bin`, `src`, `skills`, `AGENTS.md`, README, and selected
  durable docs, while excluding fixtures, tests, and handoff history from
  packed installs.
- The installable bin wrapper now preserves the caller working directory, and
  `infra-agent --version` provides a cheap installation self-check.
- `infra-agent doctor [workspace]` now provides a read-only readiness report for
  package metadata, installed agent-facing surface, Node engine, LLM planner
  configuration, workspace inspection, validation plan, and
  Helm/Pulumi/Terraform executable availability without exposing API keys.

### Step 3: Add Syntax Validators

- Add a YAML parsing validator used before accepting YAML writes.
- Normalize validator results into `ValidationIssue` records.
- Add tests with invalid Helm values, Pulumi stack YAML, and generic YAML config.

Status on 2026-04-28:

- Ordinary YAML writes now run `validate_yaml_syntax` before and after the write.
- Invalid YAML is blocked before file mutation and classified as
  `yaml-syntax-failure`.
- Helm files under `templates/` are excluded from raw YAML parsing and remain
  covered by rendered `helm template` validation.
- YAML parse success is treated as a write guard, not as full target validation.
- YAML parsing now uses the project `yaml` npm dependency instead of relying on
  a machine-local Python/PyYAML fallback.

### Step 4: Add Knowledge Cache Interfaces

- Define `KnowledgeSource`, `KnowledgeCacheEntry`, and `RetrievedContextPacket`
  types.
- Implement a local filesystem cache with version/source metadata.
- Add repo-local schema discovery first; add dynamic official-doc fetching later.

Status on 2026-04-28:

- Added `KnowledgeSource`, `KnowledgeCacheEntry`, `KnowledgeCacheWrite`, and
  `RetrievedContextPacket` types.
- Added a local JSON cache adapter with deterministic source IDs, content hashes,
  read/write helpers, and stale-after checks.
- Cache IDs include source kind/name/version/url/path metadata so official docs
  and schemas can be cached per provider/chart/package version.
- Added a knowledge-cache root resolver with explicit env override,
  workspace-config override, and user-cache default. Workspace-config roots must
  be relative paths that stay inside the active workspace.
- `inspect` now exposes the resolved knowledge-cache root and source for
  downstream agents and operators.
- Added a cache-first context retrieval helper that returns compact
  `RetrievedContextPacket` excerpts, fetches missing or stale sources when a
  fetcher is available, and falls back to stale version-scoped cache entries
  with medium confidence when fresh retrieval is unavailable.
- Added a first official URL fetcher abstraction with content-type
  normalization. Tests use mocked fetchers; no test requires external network.
- Added a first Terraform Registry context selection path for Terraform
  resource/data-source docs. It reads `required_providers` and
  `.terraform.lock.hcl` when present, records provider source/version metadata,
  and retrieves compact packets through the cache layer.
- Terraform runs now load cached Terraform Registry context packets for selected
  Terraform roots into runtime state and planner prompts. This path is
  cache-only by default and does not automatically fetch from the network during
  the agent loop.
- Added Helm chart context selection for repo-local `values.schema.json`,
  Helm schema docs, and chart `home`/`sources` metadata from `Chart.yaml`.
  Local chart schema context is emitted directly as a high-confidence packet;
  external Helm/chart docs still go through cache retrieval.
- Helm runs now load selected chart schema context into runtime state and
  planner prompts. External Helm/chart docs remain cache-only inside the agent
  loop unless a separate fetch/prefetch path populates them.
- Helm context selection now includes local `Chart.lock` packets and dependency
  chart repository/version sources from `Chart.yaml` and `Chart.lock`. Only
  HTTP(S) dependency repositories become external fetch candidates.
- Added an explicit `prefetch` CLI path for selected Terraform/Helm knowledge
  sources. It uses the same version-aware cache and is bounded by
  `--max-sources` so dynamic official-doc retrieval stays outside the agent
  loop unless deliberately invoked.
- Added a first normalized `infra-agent.infra-graph` workspace graph with nodes
  and edges derived from inspection facts. This is a topology/impact foundation
  only; plan/preview actions and dependency impact are still future work.
- `infra-agent graph` can now attach read-only Terraform plan JSON resource
  actions as `terraform-resource` nodes with `planned-change` edges. It parses
  `create`, `update`, `delete`, `replace`, `read`, and `no-op` actions, and
  records Terraform `replace_paths` when present.
- Terraform plan graph analysis now marks confidence-scored `possible-rename`
  edges when delete/create pairs share resource type, provider, and stable
  identity fields such as `name`, `bucket`, or `tags.Name`. Strong identity
  fields can raise confidence to high; weak tag-only matches stay medium.
- Terraform plan graph analysis now attaches `depends-on` edges from plan value
  dependencies or configuration expression references, and marks
  `replacement-cascade` edges when a replaced/deleted upstream resource has a
  changed dependent in the same plan graph.
- Terraform plan graph analysis now enriches changed resource nodes and
  replacement-cascade edges with provider-specific replacement reasons derived
  from `replace_paths` plus known immutable or exclusive-identity fields.
- Terraform plan graph analysis now uses the shared exclusive-identity specs to
  mark `create-before-delete-conflict` edges for create-before-destroy
  replacements, and medium-confidence ordering warnings for delete/create pairs
  with the same provider-exclusive identity.
- Terraform plan graph analysis now adds unchanged dependency resources as
  `dependency-context` nodes when planned values, prior state values, or no-op
  resource changes provide safe metadata. These nodes support `depends-on`
  edges without adding `planned-change` edges or change counts.
- `infra-agent graph` can also attach read-only Pulumi preview JSON/event
  actions as `pulumi-resource` nodes with `planned-change` edges. It currently
  parses common `resourcePreEvent.metadata`, `resOutputsEvent.metadata`, and
  simple `steps` shapes.
- Pulumi preview graph analysis now marks advisory `possible-rename` edges for
  delete/create pairs with matching resource type and stable identity fields,
  while avoiding namespace-only Kubernetes matches.
- Pulumi preview graph analysis now also attaches `depends-on` edges from
  preview dependency metadata and marks advisory `replacement-cascade` edges
  when a replaced/deleted upstream resource has a changed dependent.
- Pulumi preview graph analysis now extracts replacement paths from
  `detailedDiff` entries whose kind contains `replace`, falls back to preview
  `diffs` for replacement operations, and enriches resource nodes/cascade edges
  with the same provider-specific replacement reason metadata.
- Pulumi preview graph analysis now adds unchanged preview resources as
  `dependency-context` nodes when `same`/no-op preview metadata is available,
  preserving dependency edges without treating the unchanged resources as
  planned changes.
- Graph summaries now include `edgesByKind` and compact `summary.impact`
  counters for planned changes, dependency edges, possible renames, and
  replacement cascades, plus create-before-delete conflict warnings. The impact
  summary also includes `riskLevel`, `primaryConcern`, `recommendedAction`,
  review-only `reviewSteps`, prioritized `reviewTargets` with per-target
  `priority`, `mutationAllowed=false`, `recommendedAction`, `riskCategory`, and
  `reviewSteps`, plus summary-level `omittedReviewTargets` and
  `mutationAllowed=false` for machine-readable handoff. Text graph output
  includes an `Impact` section with the most relevant rename, cascade, and
  ordering-conflict edges.
- Added a stable graph snapshot helper and cross-domain impact fixture covering
  Terraform and Pulumi planned changes, unchanged dependency context,
  dependency edges, replacement cascades, possible renames,
  create-before-delete conflicts, and replacement reason metadata. This is the
  contract baseline before a topology viewer is introduced.
- Pulumi preview graph analysis uses the same shared exclusive-identity specs
  and flags common exclusive-identity delete/create pairs, including
  `delete-replaced`/`create-replacement` step pairs, as
  `create-before-delete-conflict` edges. Current specs include AWS Routes, S3
  buckets, selected named AWS resources, legacy and VPC-style AWS security
  group rules, IAM OIDC providers, AWS load balancing listener priorities,
  CloudFront aliases, API Gateway custom domains, Route53 records including ACM
  validation CNAMEs, and Kubernetes objects. VPC-style security group rule
  ports are protocol-gated identity fields: graph matching permits omitted
  ports for all-protocol or `icmpv6` rules but keeps TCP/UDP rules conservative.
- Runtime validation issue classification now recognizes Pulumi and Terraform
  `AlreadyExists`/duplicate-name failures plus DNS/domain conflicts such as
  CloudFront `CNAMEAlreadyExists`, API Gateway domain `ConflictException`, and
  Route53 `InvalidChangeBatch`, plus load balancer listener rule
  `PriorityInUse`, security group rule `InvalidPermission.Duplicate`, and IAM
  OIDC provider `EntityAlreadyExists`, then produces guidance for aliases,
  Terraform moved blocks, `deleteBeforeReplace`, lifecycle sequencing, manually
  sequenced replacement, or explicit state/import repair review. When the
  runtime classifier can parse a Pulumi or Terraform resource type, it reuses
  the shared graph exclusive identity spec table and emits spec-backed
  `conflictFamily`, `conflictLabel`, and `conflictSuggestedAction` metadata.
  Runtime conflicts can also preserve Terraform `resourceAddress` and Pulumi
  `resourceName` locators so downstream agents can present concrete review
  candidates without reparsing raw stderr.
  Compact identity conflicts include review-only checklist steps for logical
  rename vs real replacement triage before moved-block, alias, import/state
  repair, or sequencing decisions. Checklist steps can include provider-family
  identity checks such as route table plus destination, listener plus priority,
  security group permission peers, DNS/domain ownership, OIDC URLs, physical
  AWS names, and Kubernetes name/namespace ownership.
  `infra-agent identity-report <agent-result.json>` renders those compact
  conflicts into a focused read-only incident report with
  `mutationAllowed=false` for every incident.
  Kubernetes `AlreadyExists` failures can also include parsed object names and
  namespaces for agent-to-agent handoff. AWS named-resource failures such as
  ECR repository or IAM role duplicates can include parsed physical names as
  `duplicateIdentity`.
- Terraform roots can now ingest an optional local
  `.infra-agent/terraform-provider-schema.json` or
  `.infra-agent/terraform-providers-schema.json` export from
  `terraform providers schema -json`. The runtime extracts compact provider
  schema facts for resources and data sources actually used by the root, and
  exposes a bounded local context packet instead of passing the full schema JSON
  to the planner. Provider schema sources and context packets include locked
  provider version labels from `.terraform.lock.hcl` when available. Treat this
  as shape/type/required-field context; replacement behavior remains driven by
  native plan output and provider-specific impact rules.
- End-to-end automatic network fetching from planner/runtime flows is
  intentionally not implemented yet.

### Step 5: Add Semantic Constraint Extraction

- Extract Helm constraints from `values.schema.json`, rendered manifests, and
  existing values files.
- Extract Terraform variable requirements and validation blocks from `.tf` files.
- Extract Pulumi stack config keys and required-missing-config failures from
  preview output.
- Feed these facts into edit-plan builders before LLM planning.

Status on 2026-04-28:

- Added `ConfigSemanticsSummary` and `ConfigSemanticFact` types.
- Workspace inspection now detects Helm `values.schema.json` files.
- Helm values schema extraction currently emits high-confidence
  `required-field`, `defaulted-field`, `enum`, and `exactly-one-group` facts.
- Terraform variable extraction currently emits high-confidence
  `required-field`, `defaulted-field`, `type-constraint`, `validation-rule`,
  and validation-derived `enum` facts from `.tf` variable blocks.
- Pulumi config extraction currently emits high-confidence `type-constraint`,
  `defaulted-field`, and `configured-field` facts from `Pulumi.yaml` and
  `Pulumi.<stack>.yaml`, without exposing secret `secure` values.
- Focused config semantics are included in the planner user prompt for the top
  candidate targets.
- Helm and Terraform edit-plan builders now consume selected semantics before
  writing values. Helm ingress plans use schema enum facts, and Terraform tfvars
  plans block environment values that violate validation-derived enums.
- Pulumi stack edit plans now consume config semantics to reuse existing config
  keys/namespaces before falling back to project-name heuristics.
- Runtime validation can now promote Pulumi preview missing-config failures into
  high-confidence `required-field` facts, so planner prompts and repairs can use
  validator-discovered semantics.
- Terraform tfvars edit plans now use `type-constraint` facts when rendering
  scalar values, so string variables stay quoted even when values look numeric.
- Result cards now surface validation-derived Pulumi preview `required-field`
  semantic blockers as compact structured output, so downstream agents and
  human operators can see the config path without rereading raw stderr.

### Step 6: Add Impact Analysis

- Refine candidate renames and detect replacement cascades from parsed graph
  actions across Terraform and Pulumi.
- Print guidance without executing state changes.

### Step 7: Add Graph JSON Before Web UI

- Add normalized graph types.
- Generate graph JSON from Helm rendered output, Terraform plan/state facts, and
  Pulumi preview/stack facts.
- Build the web topology viewer only after graph snapshots are stable in tests.

## Near-Term Definition Of Done

The next durable milestone is not the web UI. It is:

- installable local CLI shape
- agent-facing skill checked into the repo
- syntax validation for YAML writes
- first knowledge-cache type definitions
- first semantic constraints used by edit plans
- clear plan-impact output for update vs replacement vs possible rename
