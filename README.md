# infra-agent

`infra-agent` is a TypeScript CLI agent for generating, modifying, and validating `Pulumi` and `Helm` configuration in a controlled repository workspace.

The product goal is narrow on purpose:

- read an infrastructure repository with tools
- understand existing `Pulumi` and `Helm` patterns
- generate or modify configuration safely
- validate every change with `helm lint`, `helm template`, and `pulumi preview`
- stop before destructive actions unless explicitly approved

## Scope

Version `v0` is intentionally constrained.

- Single CLI entrypoint: `infra-agent`
- Single repository workspace per run
- Single task at a time
- Focus on `Pulumi` and `Helm` only
- File generation and modification only
- Validation-first workflow
- No automatic `pulumi up`
- No secret material generation

## Non-Goals

The first version will not attempt to be:

- a general-purpose coding agent
- a multi-agent orchestration platform
- a background daemon
- a deployment operator
- a remote execution system

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

If validation fails, the agent should continue iterating until the failure is resolved or a real blocker is reached.

## Current CLI Surface

The current repository includes a minimal TypeScript CLI skeleton with three commands:

- `infra-agent inspect [workspace]`
- `infra-agent validate [workspace]`
- `infra-agent run "<task>" [--workspace <path>]`
- `infra-agent agent "<task>" [--workspace <path>]`

Current behavior is intentionally preflight-oriented:

- `inspect` detects Helm charts and Pulumi projects
- `validate` reports validator availability and the validation plan implied by the workspace
- `run` builds a structured preflight state from the task, workspace facts, validator availability, assumptions, blockers, and next actions
- `agent` runs a single-step agent decision loop on top of the preflight state through a pluggable planning model
The current planning model is rule-based rather than LLM-backed, but the runtime now has a dedicated agent decision boundary that can later be replaced by a real model client.

## Safety Contract

The agent must respect clear execution boundaries.

- Read-only repo inspection is allowed by default.
- File writes are controlled and scoped to the active workspace.
- Validation commands are expected and should be treated as normal execution.
- Destructive actions require explicit approval.
- Secrets and credentials must never be written into source-controlled files.

## Repository Documents

- [Development Plan](./docs/PLAN.md)
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
