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
- knowledge cache source and retrieved context budget summaries
- approval resume metadata that records required scope but does not grant
  approval

Report commands are read-only transformations over saved handoff artifacts:
`identity-report` consumes compact agent results, and `impact-report` consumes
infra graph JSON. Neither command reruns validators or authorizes remediation.

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
