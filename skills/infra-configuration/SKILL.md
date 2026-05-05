---
name: infra-configuration
description: Use this skill when generating, modifying, reviewing, or validating Helm, Pulumi, or Terraform configuration in an infrastructure repository. Prefer the infra-agent CLI and its structured inspection, planning, validation, approval, and impact-analysis workflow over ad hoc file edits.
---

# Infra Configuration

Use `infra-agent` as the specialist harness for infrastructure configuration
tasks. The skill exists to keep other agents from loading an entire repo or
guessing infrastructure conventions from generic IaC knowledge.

If the CLI is installed from a local checkout, use `npm link` from the
`infra-agent` repository and then call `infra-agent` from the target workspace.
The installable package intentionally includes only the CLI runtime, skills,
`AGENTS.md`, README, and durable docs. Use `infra-agent --version` as a cheap
installation check before running repository-specific commands. Use
`infra-agent doctor <workspace> --json` when another agent needs a structured,
read-only readiness report before planning edits. Doctor output verifies the
installed agent-facing surface and may report whether the LLM planner provider
adapter is configured, including non-secret capability metadata, but it must
not expose API keys. If a caller wants to verify a specific OpenAI-compatible
model or gateway before running the agent, pass `--model <name>`,
`--openai-base-url <url>`, and `--llm-provider openai-compatible` to `doctor`;
credentials must still come from environment variables.

## Workflow

1. Identify the workspace root.
2. Run inspection before editing:

   ```sh
   infra-agent inspect <workspace>
   ```

3. For a concrete user task, run the bounded agent:

   ```sh
   infra-agent agent "<task>" --workspace <workspace>
   ```

   To select an OpenAI-compatible planner model for one run, add
   `--model <name>` or `--llm-model <name>` plus
   `--openai-base-url <url>` when using a gateway. Do not pass API keys as CLI
   arguments; use `INFRA_AGENT_OPENAI_API_KEY` or `OPENAI_API_KEY`.
   Use `--context-packet-limit <n>` or `--context-token-budget <n>` when the
   caller needs a stricter retrieved-doc context budget.
   If the result pauses on a tool-category approval, rerun with
   `--approve-tool-category <category>` only after the user approves that native
   operation category.

4. Prefer `--json` when another agent will consume the result. This returns the
   compact `infra-agent.agent-result` payload; reserve `--json-full` for
   debugging the whole runtime state. Treat compact JSON as contract-checked
   handoff data: root task/workspace metadata, `handoffCheckpoint`, query/loop/
   repair budgets, lifecycle/turn/tool trace entries, tool permission summaries,
   readiness checks, validation plan/command/issue/safety/identity summaries,
   knowledge cache/context summaries, approval resume metadata, and planner
   handoff routing must be structurally valid before another agent acts on
   them. Read `handoffCheckpoint` first for compact/read-only posture, raw
   content exclusions, routing summary, section budgets, continuation reason,
   approval command metadata, durable section names, and `mutationAllowed=false`.
   Then read
   `harness.stateSummary` for runtime counts, `harness.targeting` for selected
   target, candidate score posture, ambiguity flags, and recommended targeting
   action, `harness.workPlan` for derived progress steps, skipped-step count,
   current step, and next control action, and `harness.turnTrace` for the bounded action flow. Read
   `harness.plannerConfig` for requested/effective planner mode, non-secret
   provider/model/base URL source metadata, and
   `harness.plannerConfig.llm.capabilities` before assuming JSON response
   support, structured output support, or streaming behavior,
   `harness.plannerHandoff` for the
   active blocker and next control action,
   `harness.turnTraceBudget` and
   `harness.lifecycleEvents` for capped lifecycle window/count metadata, and
   `harness.toolTrace` for budgeted tail-window recent tool summaries, first
   and last included turn indexes, and latest tool turn before asking for raw
   logs. Read `harness.repairBudget`
   before starting another repair attempt. Read `harness.toolPermissionSummary`
   to separate workspace writes, native CLI calls, and stack/state mutation-risk
   tools. Read
   `readiness` for planner mode, workspace blocker status, selected validation
   plan status, and validator availability required by that selected plan before
   asking for a full doctor report. If readiness is warn or fail, run the
   suggested read-only `doctorCommand` before asking for more raw logs. Read
   `knowledgeCache` for the resolved cache root/source and `knowledgeContext`
   to see which retrieved docs or schemas were included or omitted by context
   budget; the human result card mirrors that packet, token, and omission
   posture without exposing raw excerpts. Read
   `validation.selectedPlan` for intended domain validators,
   `validation.commands` for executed validation command summaries,
   `validation.issueSummary` for grouped blocker posture, and
   `approval.resume` for the primary approval signal, additional pending
   approval scopes, `pendingScope` counts, scoped continuation command,
   compact/debug JSON continuation commands, query-budget-preserving flags,
   CLI-selected planner flags, and per-signal `additionalCommands`; this
   metadata is not approval by itself.
   Read `approval.grants` separately to see explicit approval scope already
   supplied to the current run; supplied grants do not approve any future
   broader operation, but suggested rerun/export commands preserve them for the
   same task. Read `validation.issueDetails` before assuming the
   sampled `validation.issues` array is complete; the sample plus omitted count
   must match the issue summary. Read `validation.safetyBlockers` first when unsafe validation
   commands or YAML syntax gates are present. For replacement or
   duplicate-provider failures,
   read `validation.identityConflictSummary` and
   `validation.identityConflicts` before raw stderr or long guidance strings.
   The summary is the authoritative total/included/omitted count surface; the
   conflict array is a capped sample with Terraform `resourceAddress` and Pulumi
   `resourceName` locators, `riskCategory` triage grouping, and `reviewSteps`
   for rename vs replacement triage.
   Use `infra-agent identity-report <agent-result.json>` when you need a
   focused read-only incident report from an existing compact result; do not
   pass graph JSON, full debug state, native plan/preview JSON, or raw logs.
   The input must be compact `infra-agent.agent-result` schema version 1.
   The generated `infra-agent.identity-conflict-report` is also contract-checked
   for count consistency and `mutationAllowed=false`. LLM planner prompts may
   include the same blockers as `runtimeIdentityConflictSummary` and
   `runtimeIdentityConflicts`; treat those fields as read-only triage context.
   If `suggestedCommands` includes an `agent --json > agent-result.json` export
   followed by `identity-report agent-result.json --json`, use it as a
   read-only reporting path.
   Use `infra-agent impact-report <graph.json> --json` for a read-only graph
   impact handoff. Prefer `summary.sourceProvenance`,
   `summary.impact.reviewTargetBudget`, omitted review target counts, and
   `mutationAllowed=false` over raw graph traversal when deciding what another
   agent should inspect next.
   Also treat the process exit code as control-flow metadata: `0` succeeded,
   `2` validation-blocked, `3` approval-required, `4` clarification-required,
   `5` no-safe-action, `6` repair-budget-exhausted, and `7` `run` preflight
   blockers. `1` remains fatal CLI/runtime failure.
5. If the result asks for approval, do not work around it. Ask the user or rerun
   with the requested approval flags from `approval.resume` only when the user
   has approved that scope.
6. If validation fails, use the structured failure and suggested next action
   before making any manual change.
7. Never run `terraform apply`, `pulumi up`, or deployment commands as part of
   this skill.

## Context Discipline

- Use repo-local facts first: existing files, lockfiles, schemas, examples, and
  validator output.
- Prefer `infra-agent` config semantics from Helm schemas, Terraform variable
  declarations, and Pulumi stack config over raw file dumps when deciding valid
  fields and values.
- Load only the files selected by `infra-agent` unless the task clearly needs
  more.
- Prefer structured CLI output and validation results over long prose docs.
- Treat official docs as version-sensitive; use cached or fetched official
  context only for the provider, chart, module, or package version in the repo.

For detailed strategy, read
`references/context-validation-and-impact.md` only when the task involves
official docs, module semantics, replacement impact, rename detection, or graph
generation.

## Safety Rules

- Do not write secrets or credentials.
- Do not create parallel Helm charts, Pulumi stacks, or Terraform roots when an
  existing target should be modified.
- Treat full-file rewrites, production-targeting changes, and state mutations as
  approval-sensitive.
- Suggest Terraform moved blocks/state moves or Pulumi aliases/state operations
  only as guidance unless the user explicitly approves execution.

## Expected Output

When reporting back, include:

- target workspace and detected domain
- files changed or proposed
- validators run and results
- key assumptions
- unresolved questions or approval needs
- impact notes for replacements, renames, or dependency cascades
