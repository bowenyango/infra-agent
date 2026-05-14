# Development Plan

## Objective

Build a TypeScript CLI agent named `infra-agent` that can safely read, generate, modify, and validate infrastructure configuration in an existing repository by using AI-guided planning, repository-aware tools, structured state, and mandatory validation.

The current optimized roadmap lives in [Roadmap](./ROADMAP.md). Treat that
document as the active next-step plan when it conflicts with this older phase
breakdown.

## Current Priority Override

The active priority is functional RAG capability for infrastructure changes.
Future development should focus on extracting, validating, analyzing,
retrieving, and applying the five compact JSON knowledge unit types:

- `fact`
- `guidance`
- `example`
- `diagnostic`
- `recipe`

Safety remains required, but it should stay at Claude Code harness weight:
permission classification, dry-run separation, explicit approval before
mutation, compact handoff, and secret redaction. Do not continue expanding the
fine-grained `knowledge team-upload-*` dry-run boundary chain unless a concrete
product requirement needs it. Existing boundary contracts may be maintained,
but new work should prioritize user-visible RAG behavior and infra edit
accuracy.

Shared public and internal knowledge should flow through read-only
`infra-agent.knowledge-units` artifacts. Single artifacts can be configured
directly, and larger catalogs can be configured as
`knowledgeSources.unitArtifactRegistries` so agents discover matching
provider, Helm, Pulumi, or internal unit payloads without rerunning extraction
or loading raw docs into prompts.

Canonical public RAG acceptance is anchored on three extraction targets:
HashiCorp Terraform AWS provider docs
`https://registry.terraform.io/providers/hashicorp/aws/latest/docs`
(`hashicorp/aws`), Pulumi AWS `@pulumi/aws`
`https://www.pulumi.com/registry/packages/aws/api-docs/`, and Helm
`kube-prometheus-stack`
`https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack/`.
Extraction and packing must stay generic/extensible; the tests intentionally
use generic heading variants so future parsers do not couple to those specific
providers or charts.

The initial infrastructure domains are:

- `Pulumi`
- `Terraform`
- `Helm`

The primary product user is a non-Infra contributor who needs help producing correct configuration without already knowing repository-specific infrastructure conventions.

A future expansion target, after the CLI runtime is stable, is a local visualization server that can render the expected infrastructure topology inferred from repository configuration.

## Product Principles

- Narrow domain before broad autonomy
- Validation before completion
- Safety before convenience
- Reuse existing repository patterns before introducing new ones
- Prefer explicit infrastructure decisions over inferred defaults
- Help non-Infra users succeed without hiding repository constraints
- Prefer repository-backed decisions over generic IaC best practices

## Version 0 Scope

The first implementation should support:

- accepting a single task from CLI input
- operating on a single repository workspace
- inspecting repo structure and identifying relevant `Pulumi`, `Terraform`, and `Helm` files
- reading and patching files
- generating missing configuration files only when needed
- running `helm lint`
- running `helm template`
- running `pulumi preview`
- running `terraform fmt -check`
- running `terraform validate`
- iterating on failures using validation output
- surfacing clarification and approval boundaries in language a non-Infra user can act on
- printing a final structured summary

## Explicit Non-Goals

Do not build these in the first phase:

- automatic apply or deploy flows
- multi-agent orchestration
- remote execution
- long-lived daemon mode
- IDE integration
- chat UI
- automatic secret creation
- speculative repository-wide migrations
- provider visualization server before the CLI runtime is stable

## Delivery Phases

### Phase 1: Foundations

Deliver repository foundations and design constraints.

- establish product plan
- establish engineering rules
- define architecture boundaries
- define repository conventions
- define the first implementation slices
- pin supported infrastructure domains and user boundary
- define validator contract for each supported domain

### Phase 2: CLI Skeleton

Deliver a minimal CLI shell and runtime entrypoint.

- parse user task input
- resolve repository root and workspace
- initialize run context
- print structured execution summaries
- establish failure model and exit codes
- show approval and clarification outcomes explicitly

### Phase 3: Repository Inspection Tools

Deliver the first safe toolset.

- list directories
- search files
- read files
- search file contents
- compute diffs for generated changes
- detect workspace-level agent config
- detect validator availability by domain

### Phase 4: Domain Detection

Teach the agent how to identify infrastructure structure.

- detect `Pulumi` project roots
- detect stack files and environment naming
- detect `Helm` chart roots
- detect `Chart.yaml`, `values.yaml`, and templates
- detect `Terraform` roots, modules, variable files, and environment overlays
- detect shared repository conventions
- distinguish app-level infrastructure edits from platform-level infrastructure edits

### Phase 5: Controlled Editing

Deliver deterministic write behavior.

- create file plans before writing
- patch existing files conservatively
- create new files only with clear necessity
- keep edits scoped to task-relevant directories
- prefer `append` and `replace` over full `rewrite`
- classify write risk before execution

### Phase 6: Validation Loop

Deliver the critical refinement workflow.

- run `helm lint`
- run `helm template`
- run `pulumi preview`
- run `terraform fmt -check`
- run `terraform validate`
- normalize validator output into structured feedback
- feed validation failures back into the next action decision
- classify repairable vs non-repairable validation issues

### Phase 7: Approval Boundaries

Introduce explicit safety gates.

- classify tool calls by risk level
- require approval for destructive or production-sensitive actions
- block secret generation and unsafe mutations by default
- expose approval-required pauses separately from ordinary clarification
- support explicit continuation scope after approval

### Phase 8: Domain-Specific Quality

Improve generation quality for real usage.

- enforce Helm values-driven configuration
- enforce Pulumi typed and explicit resource configuration
- enforce Terraform variable-driven configuration and module input clarity
- enforce environment separation and naming consistency
- support organization-specific rules

### Phase 9: Repository Profiles

Teach the agent how to adapt to real infrastructure repositories without losing the general runtime shape.

- load repository profile defaults
- layer workspace overrides on top of profile defaults
- encode domain-specific target constraints
- encode profile-specific validation defaults
- encode profile-specific approval and edit policies

### Phase 10: LLM-First Planning

Move the runtime from bounded rule coverage to bounded AI-guided execution.

- make the LLM planner the primary planner
- keep rule-based planning as deterministic fallback
- pass structured repository facts, policies, and validation issues into prompts
- constrain model outputs to bounded actions and structured payloads
- reject invalid planner actions at the parser boundary

### Phase 11: Non-Infra Contributor Experience

Shape the product for the actual end user.

- explain blockers in repository-specific but non-expert language
- surface missing inputs as concrete questions
- summarize changes, validations, and risks clearly
- avoid requiring users to know internal IaC layout before the first run
- preserve strict safety boundaries while reducing Infra jargon where possible

### Phase 12: Local Visualization Server

Add a local visualization layer after the CLI runtime is reliable across Helm, Pulumi, and Terraform.

- run a local server that reads structured repository facts and agent-derived infra graph data
- render provider-aware topology views instead of raw file trees
- start with AWS-oriented views such as:
  - resources grouped by VPC
  - public vs private subnets
  - security-group-derived reachability
  - load balancer to service to compute paths
  - cross-stack or cross-module references where they can be inferred safely
- keep the visualization local-first and repo-derived rather than cloud-account-derived
- support additional providers later through provider-specific graph adapters
- keep the visualization layer downstream from the CLI runtime so the graph is built from trusted inspection and domain parsing

## Initial Vertical Slice

The first end-to-end slice should solve one narrow workflow:

1. User asks the agent to add or update one service configuration.
2. Agent locates the relevant chart, stack, or Terraform root.
3. Agent reads existing files and infers local conventions.
4. Agent proposes file edits.
5. Agent applies edits.
6. Agent runs validators.
7. Agent refines until validators pass or a blocker is surfaced.
8. Agent prints summary of files created, files modified, and key decisions.

## Required Outputs Per Run

Each successful run should produce:

- files created
- files modified
- validation commands executed
- validation status
- key configuration decisions
- open risks or assumptions
- approval-required actions, if any
- follow-up questions for the user, if the run was blocked on missing inputs

Future local visualization runs should additionally produce:

- a normalized infra graph snapshot
- provider-specific topology sections
- communication or reachability hints with confidence levels
- explicit uncertainty markers where repository configuration is incomplete

## Open Questions To Resolve Before Implementation

- What LLM provider will back the CLI agent?
- Will the first version target monorepos, single-service repos, or both?
- What existing internal repository conventions must be encoded from day one?
- Which actions count as approval-required in your environment beyond `pulumi up`?
- Should the first version support TypeScript Pulumi only, or also Python and YAML Pulumi layouts?
- Which Terraform layouts must be supported first: root-module repos, reusable modules, Terragrunt-style overlays, or a subset?
- Which validation commands should be considered mandatory in repositories that do not support `pulumi preview` or `terraform validate` cleanly out of the box?
