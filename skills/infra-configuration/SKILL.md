---
name: infra-configuration
description: Use this skill when generating, modifying, reviewing, or validating Helm, Pulumi, or Terraform configuration in an infrastructure repository. Prefer the infra-agent CLI and its structured inspection, planning, validation, approval, and impact-analysis workflow over ad hoc file edits.
---

# Infra Configuration

Use `infra-agent` as the specialist harness for infrastructure configuration
tasks. The skill exists to keep other agents from loading an entire repo or
guessing infrastructure conventions from generic IaC knowledge.

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

4. Prefer `--json` when another agent will consume the result.
5. If the result asks for approval, do not work around it. Ask the user or rerun
   with the requested approval flags only when the user has approved that scope.
6. If validation fails, use the structured failure and suggested next action
   before making any manual change.
7. Never run `terraform apply`, `pulumi up`, or deployment commands as part of
   this skill.

## Context Discipline

- Use repo-local facts first: existing files, lockfiles, schemas, examples, and
  validator output.
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
