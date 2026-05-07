# Context, Validation, And Impact Reference

Load this reference only for tasks that require official documentation, module
semantics, replacement analysis, rename detection, or topology graph planning.

## Source Priority

1. Repository files and examples
2. Lockfiles, provider schemas, chart schemas, and module validation rules
3. Native tool output such as `helm template`, `terraform validate`,
   Terraform plan JSON, and Pulumi preview events
4. Official docs for the exact resolved version
5. LLM inference, marked as uncertain until validated

Do not pass full docs to the model when a schema, focused excerpt, or validator
message is enough.

## Agent-Facing Output

- Prefer `infra-agent agent "<task>" --workspace <workspace> --json` when
  another agent will consume the result.
- Use `infra-agent doctor <workspace> --json` first when the caller needs to
  confirm package, Node, planner configuration, workspace, validation-plan, and
  external IaC CLI readiness without running the agent loop.
- Use `infra-agent planner-providers --json` first when the caller only needs
  static LLM planner adapter capability metadata. This is read-only catalog
  data, not a live provider check or credential report.
- If a compact agent result already exists, prefer
  `readiness.plannerProviderCatalog` as the read-only discovery pointer before
  running the catalog command. Run `infra-agent planner-providers --json` when
  the pointer is absent or the full catalog report is needed.
- The `--json` agent output is compact and uses kind
  `infra-agent.agent-result`.
- Read `readiness` first for planner mode, workspace blocker status, selected
  validation plan status, and validators required by that selected plan. Use
  its `doctorCommand` only when a fuller package, Node, planner, workspace, and
  tool readiness report is needed. When readiness is warn or fail, suggested
  commands should include that read-only doctor command without removing active
  approval-continuation commands.
- Use `--json-full` only for debugging because it includes the complete runtime
  state and can carry more context than another agent should need.
- Process exit codes are part of the handoff contract for automation: `0`
  success, `1` fatal error, `2` validation blocked, `3` approval required, `4`
  clarification required, `5` no safe action, `6` repair budget exhausted, and
  `7` `run` preflight blockers.

### Compact Contract Checklist

Before routing another agent from compact JSON, prefer fields that are already
contract-checked by the parser:

- `handoffCheckpoint` first: confirm `compact: true`,
  `primaryArtifact: agent --json`, `debugArtifact: agent --json-full`,
  `mutationAllowed: false`, raw-content exclusions, durable section names,
  routing `summary`, section `budgets`, and `continuation` reason/command
  metadata before reading deeper sections.
- `harness.stateSummary`, `harness.targeting`, `harness.workPlan`,
  `harness.lifecycleEvents`, `harness.turnTrace`, and
  `harness.plannerHandoff` for current run state, selected target posture,
  derived progress, and next control action.
- `harness.plannerConfig` for requested/effective planner mode and non-secret
  LLM provider/model/base URL source metadata plus provider capabilities such
  as transport, endpoint path, response format, JSON-object support, and
  streaming posture. It is not credential metadata and does not prove live
  provider reachability unless a read-only doctor report explicitly reports
  configured readiness.
- `infra-agent.planner-provider-catalog` JSON, when used, must have
  `mutationAllowed=false` and `liveProviderCheck=false`; treat it as static
  adapter metadata only.
- `readiness.plannerProviderCatalog` for the compact discovery pointer to the
  static catalog command. Validate schema version, exact command,
  `mutationAllowed=false`, `liveProviderCheck=false`, `plannerOnly=true`,
  supported provider ids, and count consistency before using it for handoff.
- `harness.toolTrace` and `harness.toolPermissionSummary` for permission
  posture before asking for raw tool output or native CLI reruns.
- `readiness.doctorCommand` when readiness is warn or fail; this is read-only.
- `knowledgeCache` and `knowledgeContext` for cache source, packet inclusion,
  token estimates, and omitted context reasons without raw excerpts.
- `validation.selectedPlan`, `validation.commands`,
  `validation.issueSummary`, `validation.issueDetails`, `validation.issues`,
  and `validation.safetyBlockers` for validation intent, execution, blocker
  grouping, capped issue detail, and mutation-prevented safety gates.
- `validation.identityConflictSummary` before
  `validation.identityConflicts`; the summary is the authoritative total and
  omission surface.
- `approval.resume` only as approval-request metadata. Use its primary signal
  `pendingScope` counts, and additional pending approval scope to decide what
  to ask the user about, but do not treat any of those fields as approval.
- `approval.resume.compactCommand`, `approval.resume.debugCommand`, and
  `approval.resume.additionalCommands` only as scoped rerun helpers. They
  preserve query-loop budget flags and CLI-selected planner flags. Prefer
  asking the user about each additional command separately instead of combining
  approval scopes by default.
- `approval.grants` only as supplied-scope metadata. It shows approval already
  passed into the current run, not permission to expand write paths, write
  risks, or native tool categories. Suggested rerun/export commands preserve
  those grants for the same task so approved scope is not accidentally dropped.
- `handoffCheckpoint.continuation.command` must match `approval.resume.command`
  for approval-required runs; neither field grants approval by itself.
- `harness.workPlan` is derived progress only. Treat its
  `mutationAllowed=false`, step budgets, `skippedStepCount`, current step,
  blocker kind, and next-control action as routing metadata; do not edit it as
  a todo list.
- `harness.targeting` is derived targeting metadata only. Use its selected
  target, candidate budget, score gap, ambiguity flags, and recommended action
  before asking for raw preflight state or rescanning unrelated directories.
- `harness.toolTrace` is a compact tail window over recent tool summaries. Use
  `preservedWindow`, first/last included turn indexes, and `latestTurnIndex` to
  decide whether raw debug output is actually needed.

## Official Docs Strategy

Use a hybrid cache:

- Store fetched docs and examples in a local version-aware cache.
- Cache by source, provider/module/chart/package, version, URL or path, hash,
  fetched time, and stale-after policy.
- Refresh dynamically when the requested version is missing or stale.
- Prefer local provider and chart schemas over cached prose.

Current cache foundation:

- The CLI has `KnowledgeSource`, `KnowledgeCacheEntry`,
  `RetrievedContextPacket`, `KnowledgeFactSet`, and `KnowledgePack` types.
- The local cache adapter stores JSON entries with source metadata, content hash,
  fetched time, and stale-after policy.
- The resolved cache root is visible from workspace inspection. Precedence is:
  `INFRA_AGENT_KNOWLEDGE_CACHE`, then workspace-config
  `knowledgeCache.root`, then the user cache directory.
- Workspace-config cache roots must be relative paths inside the workspace;
  absolute or escaping paths should be rejected before any cache write.
- Context retrieval is cache-first and returns compact
  `RetrievedContextPacket` excerpts instead of whole documents.
- Missing or stale sources can be refreshed through an explicit fetcher. If
  fresh retrieval fails but a version-scoped cached entry exists, the retriever
  may return the stale entry with medium confidence.
- A first official URL fetcher abstraction exists, but automatic official-doc
  selection from planner/runtime flows is not implemented yet.
- Terraform Registry context selection now exists for Terraform resource and
  data-source docs. It uses `required_providers` plus `.terraform.lock.hcl`
  provider versions when available, then retrieves compact packets through the
  cache layer.
- Terraform agent runs load cached Terraform Registry packets for selected
  Terraform roots into planner prompts. The runtime does not automatically fetch
  missing docs from the network yet.
- Helm chart context selection exists for repo-local `values.schema.json`, Helm
  schema docs, and chart `home`/`sources` metadata. Treat local chart schema
  packets as higher authority than external chart docs.
- Helm agent runs load selected chart schema packets into runtime prompts for
  Helm-focused tasks. External Helm/chart docs should only appear when already
  present in the version-aware cache or fetched by a deliberate prefetch path.
- Helm chart dependency context includes local `Chart.lock` packets and
  dependency repository/version sources from `Chart.yaml` and `Chart.lock`.
  Only HTTP(S) repositories should become external fetch candidates.
- Helm chart metadata extraction treats `Chart.yaml` and sibling `Chart.lock`
  files as local `chart-metadata` sources. The extractor emits compact
  `chart-metadata` and `chart-dependency` facts for safe chart identity,
  version, app version, type, home/source URLs, and dependencies without raw
  chart YAML. Prefer locked dependency versions from `Chart.lock` when present,
  and keep lock digests and generated timestamps out of planner-facing facts.
- Pulumi project config context includes local `pulumi-config` sources from
  `Pulumi.yaml` and sibling `Pulumi.<stack>.yaml` files. The extractor builds a
  compact JSON summary for declared config keys, safe types/defaults, and safe
  stack values, then emits `pulumi-config-parameter` facts without raw YAML,
  `secure` entries, or secret-like keys.
- Pulumi package docs context includes public `pulumi-docs:package:<slug>`
  sources from safe project-root `@pulumi/*` dependencies. Cached markdown
  package module tables, bullets, and headings can emit bounded
  `pulumi-docs-guidance` facts without raw package docs or package manifest
  content. These facts are public-reference and advisory; they do not prove
  resource usage or replace `pulumi preview`.
- The CLI exposes `infra-agent knowledge sources`, `knowledge prefetch`,
  `knowledge extract`, `knowledge validate`, and `knowledge pack` for the
  cache-first learning workflow. Prefer `--domain`, `--target`,
  `--max-sources`, and `--max-facts` to keep retrieval and pack size bounded
  before running the agent. The top-level `infra-agent prefetch` remains a
  compatible alias for bounded cache refresh.
- Repo-derived fact sets include local source fingerprints for files such as
  `values.schema.json`, `Chart.yaml`, `Chart.lock`, Terraform module files,
  provider schema exports, and Pulumi project/stack YAML. Use
  `infra-agent knowledge validate <knowledge.json> --workspace <workspace>` to
  recheck those fingerprints before reusing saved knowledge after code changes.

The CLI package should bundle retrieval logic and small durable rules, not full
Terraform, Pulumi, Helm, or provider documentation.

Current extraction direction:

- Convert cached official docs, repo-local schemas, examples, module READMEs,
  Pulumi config/component metadata, and Helm chart metadata into compact
  `knowledge-facts` before planner use. Implemented local extractors now cover
  Terraform Registry markdown, Helm `values.schema.json` chart values, compact
  Terraform provider-schema facts, Terraform local module interfaces, and
  Pulumi config parameters and cached Pulumi docs guidance for config, YAML,
  package, and resource docs, plus Helm chart metadata and dependency facts.
- Facts should carry source id, URL or local path, provider/chart/module name,
  version or commit, content hash, extraction method, confidence, stale posture,
  local source fingerprint metadata for repo-derived sources, and a short
  locator back to the source.
- Useful fact families include provider/resource arguments, required/defaulted
  attributes, enum-like values, nested blocks, replacement-sensitive fields,
  identity fields, module inputs/outputs, Pulumi config/component parameters,
  Helm chart values, chart metadata, chart dependencies, and minimal examples.
- Public provider/chart facts should live in the resolved user cache or an
  explicit team cache by default. User repositories should only commit small
  reviewed curated packs, not bulk generated cache data.
- Private module/component/chart facts must stay local unless the workspace
  explicitly configures a team backend. A future S3-compatible backend should
  store content-addressed packs and keep metadata sufficient for staleness and
  source provenance checks.
- Other agents should prefer validated facts over raw docs. If fact extraction
  is unavailable, use bounded retrieved context packets and keep confidence
  lower than validator/schema-derived facts.

## Validation Layers

Always validate syntax before domain validation.

- YAML: parse touched `.yaml` and `.yml` files before accepting writes. The CLI
  uses its bundled `yaml` npm dependency for ordinary YAML parsing.
- Helm files under `templates/` are Go templates, not plain YAML. Do not block
  them with raw YAML parsing; rely on `helm template` for rendered syntax.
- Helm: run `helm lint` and `helm template`; use `values.schema.json` when
  present; optionally validate rendered manifests with Kubernetes schemas.
- Terraform: run `terraform fmt -check` and `terraform validate`; use provider
  schemas and plan JSON when initialized and safe.
- Pulumi: run `pulumi preview`; inspect stack config; run language checks when
  the project type makes them obvious.
- Policy tools such as `tflint`, `checkov`, `conftest`, and `kubeconform` should
  be workspace-configured until the repo proves they are standard.

## Module Semantics

Capture constraints as structured facts:

- required field
- defaulted field
- enum
- mutually exclusive fields
- exactly-one or at-least-one groups
- field implies another required field
- selected mode disables other fields
- identity field
- likely replacement field
- dependency edge

Each fact needs a source and confidence. Low-confidence LLM-inferred facts should
not block a run unless confirmed by repo files or tools.

Current implemented source:

- Helm `values.schema.json` is detected during workspace inspection.
- The first extraction pass records `required-field`, `defaulted-field`, `enum`,
  and `exactly-one-group` facts from chart values JSON Schema.
- Terraform variable blocks are detected during workspace inspection.
- The first Terraform extraction pass records `required-field`,
  `defaulted-field`, `type-constraint`, `validation-rule`, and
  validation-derived `enum` facts from `.tf` variable declarations.
- These facts are focused to top candidate targets before being sent to the
  planner.
- Terraform tfvars edit plans now block requested environment values that
  violate extracted enum facts.
- Pulumi `Pulumi.yaml` and `Pulumi.<stack>.yaml` files are detected during
  workspace inspection.
- The first Pulumi extraction pass records `type-constraint`,
  `defaulted-field`, and `configured-field` facts without exposing secret
  `secure` values.
- Pulumi stack edit plans use these facts to reuse established config keys and
  namespaces before falling back to project names.
- Pulumi preview missing-config failures are promoted into runtime
  `required-field` facts sourced from `pulumi-preview`.
- Compact `agent --json` output includes `harness.turnTrace` for bounded
  harness flow. Prefer it over raw turn objects: it includes action kind,
  action family, terminal status, execution status, tool count, changed-file
  count, validation issue count, and approval signal count without full runtime
  snapshots.
- `harness.turnTraceBudget` and `harness.lifecycleEvents` describe the preserved
  turn/lifecycle windows with total, included, omitted, and event-kind counts.
  Treat these as contract fields; unsupported lifecycle event names or
  inconsistent counts should block secondary reports.
- Compact `agent --json` also includes `harness.toolTrace`, a bounded tail
  window of recent deterministic tool summaries with first/last included turn
  indexes, latest tool turn, and `omittedCount`. Prefer it over full tool
  result payloads when deciding what happened in the run.
- `harness.toolPermissionSummary` aggregates permission categories such as
  workspace mutations, native CLI calls, and stack/state mutation-risk tools.
  Use it before recommending any follow-up that may mutate state or stacks.
- Workspace approval policy can require tool-category approval. When compact
  output reports `tool-category-approval-required`, use
  `--approve-tool-category <category>` only after explicit user approval.
- Planner prompts include `retrievedContextBudget` and only budgeted retrieved
  context packets. Compact `agent --json` exposes `knowledgeContext` with
  packet counts, token estimates, and omitted reasons so downstream agents can
  avoid loading raw cached docs unless necessary.
- `agent --context-packet-limit <n>` and `agent --context-token-budget <n>`
  override retrieved context budgets for a run without changing cache contents.
- Pulumi `AlreadyExists` or duplicate-name failures are classified as
  create-before-delete ordering conflicts when they occur during Pulumi
  preview/up/update. AWS Route failures can also expose route table and
  destination facts. DNS/domain failures such as CloudFront
  `CNAMEAlreadyExists`, API Gateway custom domain `ConflictException`, and
  Route53 `InvalidChangeBatch` are also classified as non-repairable ordering
  blockers with alias/domain/record metadata when the CLI output exposes it.
  Security group rule `InvalidPermission.Duplicate` and IAM OIDC provider
  `EntityAlreadyExists` failures are classified the same way with rule peer,
  security group, or OIDC URL metadata when parseable.
  Load balancer listener rule `PriorityInUse` failures are classified the same
  way with listener ARN and priority metadata when parseable.
- Terraform plan/apply failure output is classified as
  `terraform-create-before-delete-conflict` when it exposes the same
  provider-exclusive identities. The classifier extracts Terraform resource
  types from `with ...` addresses or `resource` blocks, then emits route,
  listener, DNS, security rule, OIDC, and duplicate identity metadata when
  parseable. Treat this as a blocker for review of moved blocks, import/state
  repair, lifecycle `create_before_destroy`, or explicit delete-before-create
  sequencing; do not run apply as part of this skill.
- Runtime exclusive-identity classification reuses the graph exclusive identity
  specs when the resource type is parseable. Downstream agents should preserve
  `conflictFamily`, `conflictLabel`, and `conflictSuggestedAction` metadata
  because these compact fields are usually enough to explain bucket, named
  resource, Kubernetes object, security rule, DNS, listener, and OIDC identity
  conflicts without loading broad provider docs.
- Runtime conflicts may include Terraform `resourceAddress` or Pulumi
  `resourceName` metadata parsed from native CLI diagnostics. Use these fields
  as review locators for moved blocks, aliases, import/state repair, or manual
  sequencing analysis, not as approval to mutate state or stack history.
- Kubernetes `AlreadyExists` runtime failures may also include
  `kubernetesNames` and `kubernetesNamespaces` metadata parsed from native CLI
  output such as `services "payments-api" already exists` or
  `resource default/payments-api`. Use these fields as identity context, not as
  approval to delete or replace an existing cluster object.
- AWS named-resource runtime failures may include `duplicateIdentity` parsed
  from provider messages such as `repository with name ... already exists`,
  `Role with name ... already exists`, or safe Terraform
  `creating <resource> (<name>)` context. Use that field to explain the
  physical identity before suggesting moved blocks, aliases, import, or
  sequencing.
- Compact `agent --json` output also exposes these blockers through
  `validation.identityConflicts`. Prefer that array for agent-to-agent handoff:
  it includes the engine, issue kind, conflict code/family/label, resource type,
  IaC locator fields, parsed identity fields, `riskCategory`, suggested review
  action, and source command without requiring raw stderr parsing.
- `validation.identityConflictSummary` is the authoritative count surface for
  runtime exclusive-identity blockers. Check total, included, omitted, engine,
  and risk-category counts before treating the sampled conflict array as
  exhaustive.
- `validation.identityConflicts[].riskCategory` groups incidents for triage.
  Treat `create-before-delete-ordering`, `dns-or-domain-ownership`,
  `physical-name-ownership`, `kubernetes-object-ownership`, and
  `exclusive-identity-review` as review queues, not as proof that a moved block,
  alias, import, state move, deletion, or replacement is safe.
- `validation.identityConflicts[].reviewSteps` is a compact review checklist for
  downstream agents. It should guide logical rename vs real replacement triage
  and native plan/preview reruns. Provider-family checks can call out route
  table/destination, listener priority, security permission peer, DNS/domain
  ownership, OIDC URL, physical AWS name, or Kubernetes name/namespace
  ownership. The checklist must remain read-only until explicit approval covers
  any state, stack, import, alias, or sequencing change.
- `infra-agent identity-report <agent-result.json>` renders an existing compact
  result into `infra-agent.identity-conflict-report`. Use it when a downstream
  agent or human operator needs only the incident summary and checklist. Each
  incident carries `mutationAllowed=false`; the report is triage context, not a
  remediation approval. The input must be compact `infra-agent.agent-result`
  JSON with `schemaVersion=1` and `validation.identityConflicts`, not graph
  JSON, full debug state, or native plan/preview output. The report output is
  contract-checked for source schema, incident count consistency, engine/risk
  grouped counts, string-valued identities, and `mutationAllowed=false`.
- Runtime exclusive-identity blockers may add suggested commands that export
  compact agent JSON to `agent-result.json` and render it through
  `identity-report`. Treat this as a read-only handoff path for incident
  reporting.
- Planner prompts expose the same runtime blockers as
  `runtimeIdentityConflictSummary` plus sampled `runtimeIdentityConflicts` so
  an LLM planner can see capped counts, `riskCategory`, locators, parsed
  identity, and review steps without reading raw provider stderr. These fields
  are still review-only blocker context and must not authorize state, stack,
  DNS, Kubernetes ownership, deletion, or sequencing changes.
- Terraform tfvars edit plans use extracted `type-constraint` facts when
  rendering scalar values.
- Result cards expose validation-derived Pulumi preview `required-field`
  semantic blockers in a compact `Semantic blockers` line. Treat a non-`none`
  value there as structured validator-backed context, not generic prose.

## Rename And Replacement Impact

Before accepting delete/create output as a real replacement, compare:

- resource type
- provider/package
- stable identity attributes
- module or stack path
- dependency edges
- old and new logical names

High-confidence source-address renames should produce guidance such as moved
blocks, aliases, or state-move review. The skill should not execute state
mutations by default.

For true replacements, explain:

- field or identity change that triggered replacement
- downstream resources affected by dependency edges
- whether an in-place update appears possible
- whether the confidence came from plan/preview output or heuristic inference

## Graph Planning

Graph JSON should come before a web topology viewer.

Current graph foundation:

- `infra-agent graph --json` emits kind `infra-agent.infra-graph`.
- Graph JSON includes `summary.edgesByKind` and `summary.impact` counters for
  planned changes, dependency edges, possible renames, and replacement
  cascades, plus create-before-delete conflict warnings. `summary.impact` also
  includes `riskLevel`, `primaryConcern`, `recommendedAction`, and review-only
  `reviewSteps`, prioritized `reviewTargets`, `reviewTargetBudget`, and
  `omittedReviewTargets`, with `mutationAllowed=false`, so downstream agents can
  route high-risk ordering conflicts without reimplementing graph heuristics.
  Each compact review target also carries per-target `priority`,
  `mutationAllowed=false`, `recommendedAction`, `riskCategory`, and
  `reviewSteps`; prefer them when deciding the next review queue before loading
  complete edge lists.
- Graph JSON includes `summary.sourceProvenance` so downstream agents can tell
  whether nodes/edges came from workspace inspection, Terraform plan JSON,
  Pulumi preview JSON, or a mix of sources.
- Use `infra-agent impact-report <graph.json> --json` when another agent only
  needs blast-radius context. The derived report preserves source provenance,
  impact counts, capped review-target budgets, omitted review targets, and
  `mutationAllowed=false` without requiring raw graph traversal.
- Base graph nodes and containment/configuration edges are derived from
  workspace inspection facts; plan/preview impact data is attached only when
  explicitly supplied.
- Stable graph snapshots normalize node order, edge order, metadata keys, and
  workspace roots for regression testing. Treat snapshot fixture changes as
  graph contract changes that need review before topology UI work consumes them.
- `infra-agent graph --terraform-plan <plan.json> --target <terraform-root>
  --json` attaches Terraform plan resource actions as `terraform-resource`
  nodes and `planned-change` edges without executing Terraform.
- Matching Terraform delete/create resources may be linked with
  `possible-rename` edges when type, provider, and stable identity fields match.
  The edge includes `score`, `matchingIdentityKeys`, and `reason` metadata.
  Treat these as state-move review candidates, not automatic instructions.
- Terraform plan graph output may include `depends-on` edges between changed
  resources when plan value dependencies or configuration expression references
  identify the relationship. When a replaced/deleted dependency has a changed
  dependent, a `replacement-cascade` edge explains the likely downstream blast
  radius.
- Terraform plan graph resource nodes may include `replacementReasons`,
  `replacementReasonCategories`, `replacementReasonPaths`, and
  `replacementSuggestedActions` metadata derived from native `replace_paths`
  plus known provider immutable/exclusive-identity fields. Cascade edges may
  also include `dependencyReplacementReasons` for the upstream resource.
- Terraform plan graph output may add unchanged dependency resources as
  `metadata.role=dependency-context` nodes when planned values, prior state
  values, or no-op resource changes provide safe metadata. These nodes support
  `depends-on` edges but do not carry `metadata.action` or `planned-change`
  edges, so do not describe them as modified resources.
- Terraform plan graph output may include `create-before-delete-conflict` edges
  for create-before-destroy replacements that keep the same provider-exclusive
  identity. Delete/create pairs with the same exclusive identity may also be
  marked as medium-confidence ordering warnings.
- `infra-agent graph --pulumi-preview <preview.json> --target <pulumi-project>
  --json` attaches Pulumi preview resource actions as `pulumi-resource` nodes
  and `planned-change` edges without executing Pulumi.
- Terraform roots may carry a local provider schema export at
  `.infra-agent/terraform-provider-schema.json` or
  `.infra-agent/terraform-providers-schema.json`. Use compact facts from this
  source for required provider fields, configured field types, and nested block
  shape, and preserve `.terraform.lock.hcl` provider version labels when they
  are available. Do not paste full provider schema JSON into prompts, and do
  not treat provider schema shape alone as proof that a change is in-place or
  replacement-only; confirm replacement behavior with Terraform plan output and
  provider-specific impact rules.
- Matching Pulumi delete/create resources may also be linked with
  `possible-rename` edges when type and stable identity fields match. Namespace
  alone is not enough evidence for Kubernetes objects.
- Pulumi preview graph output may include `depends-on` edges from dependency
  metadata and `replacement-cascade` edges when a replaced/deleted upstream
  resource has a changed dependent.
- Pulumi preview graph resource nodes may include replacement reason metadata
  derived from replacement-kind `detailedDiff` entries or replacement operation
  `diffs`. Treat unknown paths as provider-reported fallback context, not as a
  complete schema explanation.
- Pulumi preview graph output may add unchanged resources from `same`/no-op
  preview metadata as `metadata.role=dependency-context` nodes. These preserve
  dependency context only and must not be counted as preview changes.
- Pulumi preview graph output may include `create-before-delete-conflict` edges
  for delete/create or delete-replaced/create-replacement pairs that share a
  provider-exclusive identity. Current specs include AWS Routes, S3 buckets,
  selected named AWS resources, legacy and VPC-style AWS security group rules,
  IAM OIDC providers, AWS load balancing listener priorities, CloudFront
  aliases, API Gateway custom domains, Route53 records including ACM validation
  CNAMEs, and Kubernetes objects. Treat this as a high-risk ordering warning:
  use aliases for logical renames, `deleteBeforeReplace` or manual sequencing
  for true replacements with accepted temporary removal, or explicit
  state/import repair after approval.
- The exclusive-identity specs are shared between Terraform and Pulumi graph
  analysis. Add provider/resource specs there before adding provider-specific
  conflict logic elsewhere.
- Security group rule specs combine mutually exclusive source fields such as
  CIDR blocks, IPv6 CIDR blocks, prefix lists, source security groups, and
  `self` into a single overlap-matched identity group. Explain the matched
  source facts before recommending imports, state moves, or delete-before-create
  sequencing.
- VPC-style security group rule specs use the current single-peer field shape:
  `cidrIpv4`, `cidrIpv6`, `prefixListId`, or `referencedSecurityGroupId`
  combined as one peer identity. Keep these separate from legacy
  `aws_security_group_rule` source-list semantics.
- VPC-style security group rule `fromPort` and `toPort` identity groups may be
  omitted only when both sides omit the value and both sides use `ipProtocol`
  `-1` or `icmpv6`. Do not treat ports as generally optional for TCP/UDP
  rules.
- Replacement reason specs are also shared between Terraform and Pulumi impact
  analysis. Add path rules for known immutable or exclusive-identity fields
  before adding one-off graph logic.
- Treat graph confidence as parser confidence, not deploy approval. Replacement
  and rename guidance remains advisory until reviewed against state.

Minimum graph nodes:

- stack, module, chart, and manifest/resource nodes
- provider type and logical address
- environment and workspace target
- create/update/delete/replace action when known
- confidence and source

Minimum graph edges:

- explicit dependencies
- rendered owner or selector relationships
- network or exposure relationships when inferable
- module/stack/chart containment

The UI should remain local-only and downstream of graph JSON.
