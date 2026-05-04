# infra-agent

`infra-agent` is a TypeScript CLI agent for generating, modifying, and validating infrastructure configuration in a controlled repository workspace.

The product goal is narrow on purpose:

- read an infrastructure repository with tools
- understand existing `Pulumi`, `Terraform`, and `Helm` patterns
- generate or modify configuration safely
- validate every change with infrastructure-aware validators
- stop before destructive actions unless explicitly approved
- help non-Infra contributors succeed without guessing repository conventions

## Scope

Version `v0` is intentionally constrained.

- Single CLI entrypoint: `infra-agent`
- Single repository workspace per run
- Single task at a time
- Focus on `Pulumi`, `Terraform`, and `Helm` only
- File generation and modification only
- Validation-first workflow
- No automatic `pulumi up`
- No automatic `terraform apply`
- No secret material generation

## Non-Goals

The first version will not attempt to be:

- a general-purpose coding agent
- a multi-agent orchestration platform
- a background daemon
- a deployment operator
- a remote execution system

## Development Standards

Future agents and contributors must read the repository-root `AGENTS.md`
before making changes. It defines the required workflow, safety boundaries,
validation policy, context discipline, documentation rules, and commit
expectations for this project.

## Core Design Direction

The agent will follow a tool-driven loop rather than a prompt-only workflow.

1. Inspect the repository and detect relevant infrastructure files.
2. Build structured task state from the repository, user intent, and validation results.
3. Propose the next action through a bounded planning and execution loop.
4. Read, patch, or create only the files required for the task.
5. Run validators and use the output to refine the result.
6. Produce a final summary of files changed and major decisions.

## Validation Contract

Every artifact produced by the agent must be validated where applicable.

- Helm: `helm lint`
- Helm: `helm template`
- Pulumi: `pulumi preview`
- Terraform: `terraform fmt -check`
- Terraform: `terraform validate`

If validation fails, the agent should continue iterating until the failure is resolved or a real blocker is reached.

## Current CLI Surface

The current repository includes a minimal TypeScript CLI skeleton with these commands:

- `infra-agent --version`
- `infra-agent doctor [workspace] [--json]`
- `infra-agent inspect [workspace]`
- `infra-agent validate [workspace]`
- `infra-agent graph [workspace] [--terraform-plan <plan.json>] [--pulumi-preview <preview.json>] [--target <root>]`
- `infra-agent identity-report <agent-result.json> [--json]`
- `infra-agent prefetch [workspace] [--domain helm|pulumi|terraform] [--target <path>] [--max-sources <n>]`
- `infra-agent run "<task>" [--workspace <path>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>]`
- `infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--max-turns <n>] [--max-repair-attempts <n>] [--context-packet-limit <n>] [--context-token-budget <n>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--approve-tool-category <category>] [--json] [--json-full]`

Current behavior is intentionally runtime-foundation oriented:

- `doctor` reports package, installed agent-facing surface, Node engine,
  workspace inspection, validation plan, LLM planner configuration, and
  Helm/Pulumi/Terraform executable readiness without mutating the workspace
- `inspect` detects Helm charts, Pulumi projects, and Terraform roots
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
- `prefetch` explicitly fills the version-aware knowledge cache for selected
  Terraform/Helm official docs; it is bounded by `--max-sources` and skips
  repo-local schema files that do not require network retrieval
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
  root string-array handoff fields, query/loop budget consistency, compact
  trace arrays, readiness checks, and `validation.identityConflicts` before
  producing derived reports.
  The compact payload includes `harness.queryConfig`, an immutable snapshot of
  the turn, repair-attempt, and retrieved-context budgets used for the run, plus
  `harness.turnTrace`, a bounded per-turn trace inspired by Claude Code's query
  harness design. It exposes action kind, terminal status, execution status,
  execution skip reason, tool count, changed-file count, validation issue
  count, and approval signal count without exposing full runtime snapshots. The
  companion `harness.turnTraceBudget`, `harness.turnTraceLimit`, and
  `harness.turnTraceOmittedCount` fields make the trace window and omitted
  count explicit for downstream handoff.
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
  `harness.plannerHandoff` reports the last action, active blocker, and next
  control action so another agent can route the run without reading raw
  decisions, prompts, or runtime arrays.
  `harness.lifecycleEvents` is a budgeted event stream for query start,
  decisions, tool execution, approval gates, and terminal outcome. It keeps
  lifecycle routing explicit with total, included, omitted, and event-kind
  counts, without timestamps or raw tool output. Compact result consumers
  validate supported lifecycle event names, event count consistency, and the
  preserved `harness.turnTraceBudget` window before deriving reports.
  `harness.toolTrace` is a budgeted list of recent deterministic tool summaries
  plus total, included, omitted, latest-turn, and permission-category counts, so
  downstream agents can inspect execution evidence and permission posture
  without loading raw tool output.
  `harness.toolPermissionSummary` aggregates workspace mutations, native CLI
  calls, and stack/state mutation-risk tools.
  Result cards, snapshots, and human output also report repair attempts as
  `used/max` so downstream agents can distinguish unused repair capacity from
  an exhausted repair loop. Result cards also summarize retrieved knowledge
  context packet inclusion, token estimate use, omission reasons, and validation
  blocker counts from the compact issue summary.
  `readiness` summarizes the planner mode, workspace blockers, selected
  validation plan, and only the validators required by that selected plan. It
  also includes a `doctorCommand` for a fuller read-only package/Node/tool
  report. `validation.selectedPlan` mirrors the selected validation targets and
  commands, including executed and failed command counts, so downstream agents
  can tell what validation was intended before raw tool output is requested.
  `validation.commands` carries a budgeted list of recent executed validation
  commands with pass/fail status, short stdout/stderr previews, and structured
  unsafe-command rule metadata when a mutation command is blocked.
  `validation.issueSummary` groups active validation blockers by issue kind and
  repairability with counts, source-command counts, omitted issue/group totals,
  and booleans for repairable, non-repairable, unsafe-command, YAML syntax, and
  identity-conflict blockers. `validation.issueDetails` reports the sampling
  budget and omitted count for the capped `validation.issues` detail array.
  `validation.safetyBlockers` isolates unsafe validation command and YAML syntax
  blockers with explicit mutation-prevented posture.
  `approval.resume` carries a structured continuation command, active approval
  scope, and signal count for approval-required runs so downstream agents do
  not need to scrape prose before asking for explicit user approval.
  readiness report when another agent needs it. Result cards include the same
  readiness posture, and suggested commands surface the read-only doctor command
  first when readiness has warnings or failures.
  Retrieved official-doc/schema context is budgeted before planner handoff, and
  compact results expose `knowledgeContext` with packet/token counts and
  omitted-context reasons instead of raw excerpts.
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
  consumers validate identity conflict engine/issue-kind alignment, supported
  risk categories, identity field shape, review steps, source command, and
  reporting-only `mutationAllowed=false` posture before deriving reports.
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
  same scoped continuation path; it is reporting only and does not bypass the
  approval requirement.
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
- `INFRA_AGENT_MODEL` default `gpt-5-mini`
- `INFRA_AGENT_OPENAI_BASE_URL` or `OPENAI_BASE_URL` default `https://api.openai.com/v1`

When both names are present, `INFRA_AGENT_*` values take precedence.

Development verification commands:

- `npm run lint`
- `npm run test`
- `npm run smoke`
- `npm run e2e`
- `npm run verify`

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
