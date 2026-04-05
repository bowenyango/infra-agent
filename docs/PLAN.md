# Development Plan

## Objective

Build a TypeScript CLI agent named `infra-agent` that can safely create and modify `Pulumi` and `Helm` configuration in an existing repository by using repository-aware tools, structured state, and mandatory validation.

## Product Principles

- Narrow domain before broad autonomy
- Validation before completion
- Safety before convenience
- Reuse existing repository patterns before introducing new ones
- Prefer explicit infrastructure decisions over inferred defaults

## Version 0 Scope

The first implementation should support:

- accepting a single task from CLI input
- operating on a single repository workspace
- inspecting repo structure and identifying relevant `Pulumi` and `Helm` files
- reading and patching files
- generating missing configuration files only when needed
- running `helm lint`
- running `helm template`
- running `pulumi preview`
- iterating on failures using validation output
- printing a final structured summary

## Explicit Non-Goals

Do not build these in the first phase:

- automatic apply or deploy flows
- multi-agent orchestration
- remote execution
- long-lived daemon mode
- IDE integration
- chat UI

## Delivery Phases

### Phase 1: Foundations

Deliver repository foundations and design constraints.

- establish product plan
- establish engineering rules
- define architecture boundaries
- define repository conventions
- define the first implementation slices

### Phase 2: CLI Skeleton

Deliver a minimal CLI shell and runtime entrypoint.

- parse user task input
- resolve repository root and workspace
- initialize run context
- print structured execution summaries
- establish failure model and exit codes

### Phase 3: Repository Inspection Tools

Deliver the first safe toolset.

- list directories
- search files
- read files
- search file contents
- compute diffs for generated changes

### Phase 4: Domain Detection

Teach the agent how to identify infrastructure structure.

- detect `Pulumi` project roots
- detect stack files and environment naming
- detect `Helm` chart roots
- detect `Chart.yaml`, `values.yaml`, and templates
- detect shared repository conventions

### Phase 5: Controlled Editing

Deliver deterministic write behavior.

- create file plans before writing
- patch existing files conservatively
- create new files only with clear necessity
- keep edits scoped to task-relevant directories

### Phase 6: Validation Loop

Deliver the critical refinement workflow.

- run `helm lint`
- run `helm template`
- run `pulumi preview`
- normalize validator output into structured feedback
- feed validation failures back into the next action decision

### Phase 7: Approval Boundaries

Introduce explicit safety gates.

- classify tool calls by risk level
- require approval for destructive or production-sensitive actions
- block secret generation and unsafe mutations by default

### Phase 8: Domain-Specific Quality

Improve generation quality for real usage.

- enforce Helm values-driven configuration
- enforce Pulumi typed and explicit resource configuration
- enforce environment separation and naming consistency
- support organization-specific rules

## Initial Vertical Slice

The first end-to-end slice should solve one narrow workflow:

1. User asks the agent to add or update one service configuration.
2. Agent locates the relevant chart and stack.
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

## Open Questions To Resolve Before Implementation

- What LLM provider will back the CLI agent?
- Will the first version target monorepos, single-service repos, or both?
- What existing internal repository conventions must be encoded from day one?
- Which actions count as approval-required in your environment beyond `pulumi up`?
- Should the first version support TypeScript Pulumi only, or also Python and YAML Pulumi layouts?
