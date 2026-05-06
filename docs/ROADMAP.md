# infra-agent Roadmap

This document is the durable product and engineering plan for future sessions.
It refines the earlier phase plan with the current implementation state and with
runtime patterns learned from `learning-claude-code`.

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

`infra-agent` should become an installable CLI and an agent-facing skill package
for infrastructure configuration work. It is not a general coding assistant.

The CLI should help Infra and non-Infra users:

- inspect an existing infrastructure repo
- infer repository-specific conventions from concrete files
- retrieve only task-relevant official and local context
- generate or modify Helm, Pulumi, and Terraform configuration
- validate syntax, schema, module inputs, and provider constraints
- explain update, replace, rename, and dependency impact before deployment
- stop before destructive operations or state mutations unless explicitly approved

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

3. **Harness Runtime**
   - immutable `QueryLoopConfig`
   - mutable `AgentRuntimeState`
   - bounded planner decisions
   - deterministic tool-result writeback
   - approval and policy gates before writes or state suggestions

4. **Repository and Domain Tools**
   - repository search/read/write tools
   - Helm, Pulumi, and Terraform inspection adapters
   - native CLI wrappers with structured outputs
   - safe shell boundaries for validation only

5. **Knowledge and Context System**
   - version-aware local cache for official docs and examples
   - dynamic retrieval for missing or stale official material
   - structured extraction of provider/resource/chart/module facts from cached
     docs, schemas, examples, and repo-local code
   - repo-local facts as the highest priority source
   - provider, module, and chart schemas preferred over prose where available
   - opt-in team cache backends after the local fact schema is stable

6. **Semantics and Validation Layer**
   - YAML syntax parsing before any YAML write is accepted
   - Helm schema/lint/template validation
   - Terraform fmt/validate plus provider/module schema extraction
   - Pulumi config/preview plus language-level checks when project type is known
   - semantic constraints for exclusive options, required companions, defaults,
     replacement risk, and dependency relationships

7. **Change Impact and Graph Layer**
   - normalized infra graph JSON first
   - state/rename impact analysis before any web UI
   - local topology visualization only after graph data is reliable

## Knowledge Strategy

Use a hybrid model.

Do not bundle full official docs into the package. Full docs go stale, create a
large install, and can mismatch provider versions. Instead:

- bundle only durable retrieval logic, parsers, validation adapters, and small
  hand-authored rules
- persist official docs, examples, schemas, and summaries in a local versioned
  cache
- dynamically fetch or refresh official sources when the cache is missing, stale,
  or for a different provider/chart/package version
- always prefer repo-local files, lockfiles, installed provider schemas, chart
  schemas, and validator output over generic docs prose

The cache key should include at least:

- source kind: `terraform-registry`, `pulumi-docs`, `helm-docs`, `chart-docs`,
  `repo-example`, or `module-readme`
- provider, module, chart, or package name
- resolved version or version constraint
- URL or local path
- content hash or ETag when available
- fetched time and stale-after policy

The planner should receive small retrieved context packets, not whole documents.
Each packet should include source, version, confidence, excerpt or structured
schema facts, and why it was selected.

## Knowledge Extraction And Storage Plan

This is a core product area. Infrastructure agents become materially better
when they can reuse source-linked, versioned, validated facts about providers,
resources, modules, components, and charts instead of relearning the same public
or repository-local material on every run.

Current progress as of 2026-05-05:

| Area | Status | Current capability | Main gap |
| --- | --- | --- | --- |
| Local knowledge cache | Partial | Version-aware local JSON entries with source metadata, content hash, stale-after policy, and cache-root resolution | No structured fact index or remote backend |
| Official docs source selection | Partial | Terraform Registry source selection for used resources/data sources; Helm source selection from `values.schema.json`, `Chart.yaml`, and `Chart.lock` | Pulumi docs source selection is not implemented; source selection is not yet broad provider/resource coverage |
| Official docs retrieval | Partial | Explicit `prefetch` and `knowledge prefetch` can fetch bounded official/external sources through mocked-testable fetchers | Agent loop remains cache-only for automatic runs; live refresh is still deliberate |
| Repo-local semantics | Partial | Helm schema, Helm chart metadata/dependency facts, Terraform variables/validation blocks, Pulumi stack config, local Terraform provider schema exports, local Terraform module interface facts, and bounded Helm schema knowledge packs | Pulumi component durable packs and external chart-doc fact extraction are not implemented |
| Structured knowledge extraction | Partial | Normalized `KnowledgeFact` / `KnowledgeFactSet` contracts plus cache-first extraction, validation, bounded packs, runtime fact loading, planner prompt summaries, compact `knowledgeFacts`, result-card counts, deterministic fact ranking, focused Terraform provider schema facts, local Terraform module input/output facts, Pulumi config facts, and local Helm metadata/dependency facts | Pulumi docs, Pulumi component facts, external chart docs beyond local metadata/dependencies, and team storage backends are pending |
| Team storage | Planned | Cache root can be local, environment-selected, or workspace-relative; persisted knowledge artifacts can emit plan-only manifests with artifact hashes, storage policy, publishable/blocked source ids, and remote writes disabled | No S3/GCS/Azure/Postgres backend implementation |

Target artifact families:

- `infra-agent.knowledge-source`: selected source metadata for official docs,
  local schemas, examples, module READMEs, and chart metadata.
- `infra-agent.knowledge-cache-entry`: raw or lightly normalized fetched/local
  content, stored by version-sensitive source id.
- `infra-agent.knowledge-facts`: extracted facts such as provider/resource
  arguments, required attributes, defaults, enum-like values, nested blocks,
  replacement-sensitive fields, identity fields, examples, chart values, module
  inputs/outputs, Pulumi component config shape, chart metadata, and chart
  dependencies.
- `infra-agent.knowledge-pack`: a bounded, validated bundle of facts for one
  provider version, resource type, chart version, module, component, or repo
  target.
- `infra-agent.knowledge-artifact-manifest`: a plan-only publication manifest
  for persisted extraction or pack artifacts. It records artifact hash,
  storage-policy summary, publishable-by-default source ids, blocked source ids
  and reasons, required validation commands, and `remoteWriteAllowed=false`.

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

- `infra-agent knowledge sources <workspace> [--domain helm|pulumi|terraform]
  [--target <path>] [--json]`
  - lists selected knowledge sources without fetching.
- `infra-agent knowledge prefetch <workspace> ...`
  - aliases the current top-level `prefetch` command.
- `infra-agent knowledge extract <workspace> [--domain ...] [--target ...]
  [--source <id>] [--out <knowledge.json>] [--json]`
  - extracts normalized `knowledge-facts` from cached docs, repo-local schemas,
    examples, and module/component/chart code. `--out` explicitly persists the
    generated artifact for later validation or handoff.
- `infra-agent knowledge validate <facts.json|pack.json|manifest.json> [--workspace <workspace>] --json`
  - validates schema, source links, count consistency, stale policy, confidence
    labels, compact pack freshness metadata, artifact manifest publication
    posture, local source fingerprints, and secret safety before facts are used
    by the planner or considered for team-cache staging.
- `infra-agent knowledge pack <workspace> [--target <path>] [--out <pack.json>]
  [--manifest-out <manifest.json>] --json`
  - builds a bounded `knowledge-pack` for handoff or team cache publication.
    `--out` explicitly persists the bounded artifact without changing the
    default stdout-only behavior. `--manifest-out` writes a plan-only manifest
    that still contains no backend URL, bucket, credential, or upload command.

Recommended storage layers:

- Local default: current filesystem cache under the resolved knowledge-cache
  root. Implemented behind a `KnowledgeStore` interface so retrieval and
  prefetch can be tested against injected stores before remote backends exist.
- Repo-curated: small reviewed packs under a workspace-relative configured path,
  never automatic bulk cache commits. Saved repo-derived fact sets should be
  revalidated with `knowledge validate --workspace` so file hash drift is
  detected before reuse. Saved compact packs should also pass
  `knowledge validate` before handoff or team-cache publication. Optional
  manifests should be validated too; manifests with workspace-private or stale
  sources are planning artifacts only until explicit opt-in is recorded.
- Team cache: content-addressed object store plus metadata index. S3-compatible
  storage is a good first remote backend for blobs; add DynamoDB/Postgres only
  when query/index requirements justify it.
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
   - Remaining: add Pulumi official-doc source selection, Pulumi component
     facts, external chart-doc extraction beyond local chart
     metadata/dependencies, local fact refresh/staleness reporting for
     workspace file changes, and opt-in team storage backends.
5. **Refresh And Staleness**
   - Add stale/fresh reporting for facts derived from cache entries and local
     files.
   - Acceptance: changing a cached source hash or local file hash marks derived
     facts stale and prevents silent reuse as high-confidence context.
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
- **Pulumi**: `pulumi preview` with local safe environment defaults, stack config
  inspection, language checks such as `tsc` or package tests when detected, and
  preview JSON/event parsing for replacements and dependency impact.
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
