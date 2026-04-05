# Architecture

## Design Goal

`infra-agent` should behave as a bounded infrastructure configuration agent, not as a general-purpose autonomous coding system.

The runtime should be optimized for:

- repository inspection
- controlled configuration editing
- validation-driven iteration
- safety and approvals

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

## 4. Domain Layer

Responsibilities:

- understand Pulumi project structure
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

- detect one chart and one Pulumi stack
- edit a small set of files
- validate the result
- output a clear summary

That vertical slice should be complete before introducing:

- background execution
- multiple tasks
- provider abstraction
- complex approval workflows
- multi-agent behavior
