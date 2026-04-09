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
- `infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>]`

Current behavior is intentionally preflight-oriented:

- `inspect` detects Helm charts and Pulumi projects
- `validate` reports validator availability and the validation plan implied by the workspace
- `run` builds a structured preflight state from the task, workspace facts, validator availability, assumptions, blockers, and next actions
- `agent` runs a bounded agent decision loop on top of the preflight state through a pluggable planning model
- `agent` now prefers an OpenAI-compatible LLM planner when an API key is configured, with rule-based fallback for local testing
- `agent` can resume past approval-required pauses by rerunning with explicit approval flags such as `--approve-write-risk high` and an optional `--approve-write-path charts/payments-api`

LLM planner environment variables:

- `INFRA_AGENT_OPENAI_API_KEY` or `OPENAI_API_KEY`
- `INFRA_AGENT_MODEL` default `gpt-5-mini`
- `INFRA_AGENT_OPENAI_BASE_URL` or `OPENAI_BASE_URL` default `https://api.openai.com/v1`

Development verification commands:

- `npm run lint`
- `npm run test`
- `npm run smoke`
- `npm run verify`

The current agent runtime now supports one real vertical slice:

- inspect the highest-confidence Helm and Pulumi targets
- generate a scoped ingress edit plan for a Helm chart when the task clearly requests ingress work
- generate a bounded readiness/liveness probe edit plan for a Helm chart when the task clearly requests chart health checks
- generate a bounded Pulumi stack config edit plan when the task clearly requests stack-level config changes
- write the planned files into the workspace
- run Helm or Pulumi validation commands after the write step

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
