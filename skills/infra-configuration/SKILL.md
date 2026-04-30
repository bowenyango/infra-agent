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
README, and durable docs. Use `infra-agent --version` as a cheap installation
check before running repository-specific commands. Use
`infra-agent doctor <workspace> --json` when another agent needs a structured,
read-only readiness report before planning edits. Doctor output may report
whether the LLM planner is configured, but it must not expose API keys.

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

   Use `--context-packet-limit <n>` or `--context-token-budget <n>` when the
   caller needs a stricter retrieved-doc context budget.
   If the result pauses on a tool-category approval, rerun with
   `--approve-tool-category <category>` only after the user approves that native
   operation category.

4. Prefer `--json` when another agent will consume the result. This returns the
   compact `infra-agent.agent-result` payload; reserve `--json-full` for
   debugging the whole runtime state. Read `harness.turnTrace` for the bounded
   action flow and `harness.toolTrace` for budgeted recent tool summaries before
   asking for raw logs. Read `harness.toolPermissionSummary` to separate
   workspace writes, native CLI calls, and stack/state mutation-risk tools. Read
   `readiness` for planner mode, workspace blocker status, selected validation
   plan status, and validator availability required by that selected plan before
   asking for a full doctor report. Read `knowledgeContext` to see which
   retrieved docs or schemas were included or omitted by context budget. For
   replacement or duplicate-provider failures, read
   `validation.identityConflicts` before raw stderr or long guidance strings; it
   can include Terraform `resourceAddress` and Pulumi `resourceName` locators,
   `riskCategory` triage grouping, and `reviewSteps` for rename vs replacement
   triage.
   Use `infra-agent identity-report <agent-result.json>` when you need a
   focused read-only incident report from an existing compact result; do not
   pass graph JSON, full debug state, native plan/preview JSON, or raw logs.
   The input must be compact `infra-agent.agent-result` schema version 1.
   LLM planner prompts may include the same blockers as
   `runtimeIdentityConflicts`; treat those fields as read-only triage context.
   If `suggestedCommands` includes an `agent --json > agent-result.json` export
   followed by `identity-report agent-result.json --json`, use it as a
   read-only reporting path.
   Also treat the process exit code as control-flow metadata: `0` succeeded,
   `2` validation-blocked, `3` approval-required, `4` clarification-required,
   `5` no-safe-action, `6` repair-budget-exhausted, and `7` `run` preflight
   blockers. `1` remains fatal CLI/runtime failure.
5. If the result asks for approval, do not work around it. Ask the user or rerun
   with the requested approval flags only when the user has approved that scope.
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
