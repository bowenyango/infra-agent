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

The current repository includes a minimal TypeScript CLI skeleton with four commands:

- `infra-agent inspect [workspace]`
- `infra-agent validate [workspace]`
- `infra-agent run "<task>" [--workspace <path>]`
- `infra-agent agent "<task>" [--workspace <path>] [--planner auto|llm|rule-based] [--max-turns <n>] [--approve-write-risk <low|medium|high>] [--approve-write-path <path>] [--json] [--json-full]`

Current behavior is intentionally runtime-foundation oriented:

- `inspect` detects Helm charts, Pulumi projects, and Terraform roots
- `validate` reports validator availability and the validation plan implied by the workspace
- `run` builds a structured preflight state from the task, workspace facts, validator availability, assumptions, blockers, and next actions
- `run` now also shows the effective approval policy derived from repo profile defaults, workspace config, and explicit approval flags
- `agent` runs a bounded agent decision loop on top of the preflight state through a pluggable planning model
- `agent` now prefers an OpenAI-compatible LLM planner when an API key is configured, with rule-based fallback for local testing
- `agent` exposes `--max-turns <n>` to keep bounded loop experiments explicit from the CLI
- `agent --json` emits a compact `infra-agent.agent-result` payload for other
  agents; use `--json-full` only when debugging the complete runtime state
- `agent` can resume past approval-required pauses by rerunning with explicit approval flags such as `--approve-write-risk high` and an optional `--approve-write-path charts/payments-api`
- `inspect` resolves the knowledge-cache root used for future docs/schema
  context. `INFRA_AGENT_KNOWLEDGE_CACHE` is the explicit user override;
  otherwise `infra-agent.config.json` may set a workspace-relative
  `knowledgeCache.root`; otherwise the CLI uses the user cache directory.

LLM planner environment variables:

- `INFRA_AGENT_OPENAI_API_KEY` or `OPENAI_API_KEY`
- `INFRA_AGENT_MODEL` default `gpt-5-mini`
- `INFRA_AGENT_OPENAI_BASE_URL` or `OPENAI_BASE_URL` default `https://api.openai.com/v1`

Development verification commands:

- `npm run lint`
- `npm run test`
- `npm run smoke`
- `npm run verify`

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
