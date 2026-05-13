# Architecture

## Design Goal

`infra-agent` should behave as a bounded infrastructure configuration agent, not as a general-purpose autonomous coding system.

The runtime should be optimized for:

- repository inspection
- controlled configuration editing
- validation-driven iteration
- safety and approvals
- non-Infra contributor usability

A future product layer may sit on top of this runtime:

- a local visualization server for inferred infrastructure topology

## Current Compact Query Harness

The current CLI surface is centered on a bounded query harness rather than a
general worker swarm. `infra-agent agent --json` emits the compact
`infra-agent.agent-result` handoff payload; `--json-full` is reserved for
debugging the complete runtime state.

The compact result preserves durable routing state:

- root task, workspace, target, outcome, and exit-code posture
- query, loop, repair, lifecycle, turn-trace, and planner-handoff metadata
- tool trace and aggregate tool-permission posture
- readiness status plus a read-only `doctorCommand`
- selected validation plan, executed validation summaries, grouped issue
  posture, capped issue samples, safety blockers, and identity conflict
  aggregates
- knowledge cache source, retrieved context budget summaries, and extracted
  knowledge fact summaries
- approval resume metadata that records required scope but does not grant
  approval

Report commands are read-only transformations over saved handoff artifacts:
`identity-report` consumes compact agent results, and `impact-report` consumes
infra graph JSON. Neither command reruns validators or authorizes remediation.

`knowledgeFacts` is the compact extracted-fact surface. Runtime builds it from
cache/local `knowledge-pack` data for selected targets, planner prompts receive
only budgeted summaries, and `agent --json` exposes the same bounded counts,
source metadata, stale-source counts, and omitted-fact counts without raw docs,
cache content, or full schemas. `--context-fact-limit` belongs to the immutable
query config beside packet/token context budgets so approval resume commands can
preserve the same planner context shape.

## Knowledge Retrieval Core

The knowledge system is a core product layer, not a secondary cache. Its job is
to make infrastructure edits more accurate and less token-heavy than a generic
coding harness that rereads repositories and official docs on every run.

Knowledge retrieval should be deterministic before it is semantic. The runtime
should select knowledge by domain, provider/package/chart, version, resource or
module/component identity, target path, validation issue, planned action, risk
type, freshness, and privacy scope. Vector search may be added later for broad
discovery, but it is not the default retrieval mechanism for hard
infrastructure facts.

Reusable knowledge should be normalized into five unit types:

- `fact`: machine-consumable constraints such as required fields, types,
  defaults, enum-like values, replacement-sensitive fields, identity fields,
  companion fields, and mutual exclusions.
- `guidance`: short JSON-carried explanations that help the planner understand
  when a fact, pattern, or risk applies.
- `example`: bounded code or configuration samples, included only when a
  concrete edit needs them and ranked behind repo-local and team-curated
  examples.
- `diagnostic`: validation, plan, preview, or provider failure signatures such
  as duplicate identity, missing config, replacement cascades, and
  rename/import/alias review hints.
- `recipe`: safe multi-step infrastructure workflows such as Terraform moved
  blocks, Pulumi aliases, stack config changes, Helm values migration, and
  import/state repair review.

Public-reference knowledge and internal knowledge use the same extraction and
validation workflow but different storage and privacy policies. Public provider,
package, chart, and official-doc units may be shared through a team registry.
Repo-local and organization-private module, component, chart, policy, example,
and incident-derived units remain private unless explicitly opted into a safe
team cache. Local curated internal units are declared in
`infra-agent.config.json` as safe workspace-relative
`knowledgeSources.curatedUnits` files and enter packs as `internal-team`
context. Prebuilt `infra-agent.knowledge-units` artifacts are declared under
`knowledgeSources.unitArtifacts`; they preserve reviewed unit payloads while
rebasing planner source accounting to the artifact file for fingerprinting,
budgeting, or to a secret-free URL that `knowledge prefetch` downloads into the
local cache before extraction. Shared public or internal catalogs can be
declared under `knowledgeSources.unitArtifactRegistries`; registry JSON is
read-only discovery metadata that expands into the same artifact pipeline for
the requested domain and target. Planner prompts receive compact context
packets derived from these units, never raw caches, full docs, full schemas, or
unbounded examples.

## Runtime Shape

The CLI runtime should be organized into five layers.

### 1. CLI Layer

Responsibilities:

- parse command-line input
- resolve workspace path
- initialize run context
- render run summary and errors

Examples of future commands:

- `infra-agent run "<task>"`
- `infra-agent inspect`
- `infra-agent validate`

The command surface can be renamed later without changing the core runtime. The binary name and the runtime modules should stay decoupled.

### 2. Agent Runtime Layer

Responsibilities:

- own the execution loop
- manage run state
- decide the next action
- mediate between model output and tools

This layer should implement a turn-based loop:

1. load task state
2. build execution context
3. ask the model for the next bounded action
4. execute one tool or one controlled action
5. update state with results
6. continue until done or blocked

## 3. Tool Layer

Responsibilities:

- provide repository-aware capabilities
- keep file and shell operations explicit
- normalize outputs into structured results

Planned tool groups:

- repository tools
- file tools
- Helm tools
- Pulumi tools
- Terraform tools
- validation tools

Initial tool candidates:

- `listDirectory`
- `findFiles`
- `searchText`
- `readFile`
- `patchFile`
- `writeFile`
- `helmLint`
- `helmTemplate`
- `pulumiPreview`
- `terraformFmtCheck`
- `terraformValidate`

## 4. Domain Layer

Responsibilities:

- understand Pulumi project structure
- understand Terraform root and module structure
- understand Helm chart structure
- detect repository conventions
- classify environment-specific config

This layer should be deterministic where possible. The model can assist with decisions, but repository facts should come from code and configuration inspection.

## 5. Validation and Safety Layer

Responsibilities:

- classify risk
- enforce approval boundaries
- run validators
- convert validator output into actionable state

Risk classes should start simple:

- `read_only`
- `write_scoped`
- `validate`
- `approval_required`

## State Model

The runtime should maintain structured task state instead of relying only on transcript history.

Minimum state fields:

- user task
- workspace root
- detected Pulumi roots
- detected Terraform roots
- detected Helm roots
- target service
- target environment
- files read
- files changed
- validator results
- pending questions
- pending approvals
- completion status

## Prompt Strategy

The model should not receive the entire repository.

Instead, context should be reconstructed from:

- user request
- repository facts discovered through tools
- relevant file excerpts
- previous action results
- validation failures
- repository rules

This keeps the system closer to a tool-driven agent runtime than a prompt-only generator.

## First Implementation Boundary

The first code implementation should cover one simple but real path:

- detect one chart, one Pulumi stack, or one Terraform root
- edit a small set of files
- validate the result
- output a clear summary

That vertical slice should be complete before introducing:

- background execution
- multiple tasks
- provider abstraction
- complex approval workflows
- multi-agent behavior

## Future Visualization Layer

After the CLI runtime is stable, add a separate local visualization layer.

### 6. Visualization Layer

Responsibilities:

- consume normalized infra graph data produced from repository inspection and domain parsing
- render human-readable topology views
- expose uncertainty explicitly when repository facts are incomplete
- remain local-first and safe to run without cloud-provider credentials

The first provider-specific target can be AWS.

Expected first views:

- VPC containment
- subnet grouping
- public vs private exposure
- security group adjacency or reachability hints
- service-to-database and load-balancer-to-service relationships

This layer should not parse repositories independently.

Instead, it should sit downstream from the CLI/domain runtime:

1. CLI/domain layers inspect repository facts
2. domain layers normalize those facts into an infra graph
3. visualization layer renders that graph through provider-specific adapters

This keeps graph generation deterministic and keeps the visualization product aligned with the same repository-aware facts used by the CLI agent.
