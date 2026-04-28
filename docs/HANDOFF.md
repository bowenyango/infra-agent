# infra-agent Handoff Notes

This document captures current development state for future Codex sessions.

## Current Branch State

- Branch: `agent-1`
- Recent completed commits:
  - `d4db75f` Use Helm schema facts in edit plans
  - `4eae18b` Add YAML guards and Helm schema semantics
  - `5397b73` Focus mixed-domain preflight output
- After each completed slice, keep committing intentionally on `agent-1`.
- Do not reset or discard future uncommitted work without explicit user
  approval.

## Historical Slice: Domain-Focused Preflight And Result Output

Files:

- `src/agent/build-run-preflight.ts`
- `src/cli/output.ts`
- `src/domain/task-targeting.ts`
- `test/cli-smoke.test.mjs`

Purpose:

- Keep mixed-domain workspaces focused on the requested domain.
- For Helm-only tasks in a workspace that also has Pulumi, prefer Helm targets in targeting, snapshots, recommended next steps, and validation plan presentation.
- Filter unrelated Pulumi/Terraform blockers and next actions when the task clearly requests Helm only.
- Prioritize requested domain capabilities and validation plan entries in CLI output.

Known validation:

- `npm run test` passed before and after later slices.
- `npm run lint` passed.
- `npm run smoke` passed.

## Historical Slice: Tool Trace Runtime Summary

Files involved:

- `src/query.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`

Purpose:

- Add deterministic `ToolExecutionSummary` records to `AgentRuntimeState`.
- Write a short summary for every executed tool result during query loop writeback.
- Surface recent tool activity as `Tool trace` in agent snapshots and result cards.
- Normalize absolute file paths back to workspace-relative paths where appropriate.

Design reference:

- Inspired by `learning-claude-code` tool-use summaries and query-loop state writeback.
- Kept deterministic and local. No extra LLM summary call was introduced.

Known validation:

- `npm run test`: 144/144 passed.
- `npm run lint`: passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

## Historical Slice: Explicit Query Loop Config

Files involved:

- `src/query-config.ts`
- `src/query.ts`
- `src/types/query.ts`
- `src/agent/run-single-step.ts`
- `src/cli/main.ts`
- `README.md`
- `test/cli-smoke.test.mjs`

Purpose:

- Replace the query loop hard-coded turn limit with `QueryLoopConfig`.
- Preserve default behavior: `maxTurns` defaults to `6`.
- Normalize invalid or too-small config values to a safe minimum of `1`.
- Add `agent --max-turns <n>` CLI support for explicit bounded-loop experiments.
- Export `parseArgs` from `src/cli/main.ts` and guard direct execution so tests can import CLI parsing without running the CLI.

Design reference:

- Inspired by `learning-claude-code/src/query/config.ts`, where query entry snapshots immutable config separately from mutable loop state.
- This is intentionally small: only `maxTurns` moved into config so the boundary is testable before expanding config surface.

Known validation:

- `npm run test`: 144/144 passed.
- `npm run lint`: passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

## Learning From `learning-claude-code`

Useful patterns for `infra-agent`:

- Keep query/runtime config immutable and explicit at loop entry.
- Keep mutable runtime state separate from config.
- Treat tool execution results as first-class runtime events.
- Write tool results back into state in one place.
- Summarize tool activity for operator visibility, but keep summaries non-critical.
- Preserve permission/approval boundaries as runtime facts, not ad hoc prose.

Patterns not currently appropriate:

- Multi-agent orchestration.
- Chat UI or terminal UI productization.
- General-purpose coding-agent surfaces.
- LLM-generated tool summaries.
- Background daemon or remote execution model.

## Historical Suggested Development Plan

1. Review staged vs unstaged changes and decide whether to commit as two or three commits:
   - domain-focused output
   - tool trace summaries
   - query config and `--max-turns`
2. If keeping the new runtime slices, consider staging unstaged files intentionally rather than blanket-adding everything.
3. Add JSON result compacting later if `agent --json` output becomes too large for downstream consumers.
4. Move repair budget from hard-coded planner checks (`repairAttempts < 2`) into explicit runtime config after `maxTurns` is stable.
5. Add result-card coverage for query-loop config, for example showing `Turn budget: used N / max M`.
6. Continue strengthening Terraform parity, especially validation repair paths and safer tfvars/environment disambiguation.
7. Start repository-specific behavior only after the generic Helm/Pulumi/Terraform runtime remains stable.

## 2026-04-28 Roadmap Refresh

New persistent planning artifacts were added for the next sessions:

- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Optimize the prior phase plan using Claude Code-inspired runtime patterns from
  `learning-claude-code`.
- Pin `infra-agent` as both an installable CLI and an agent-facing skill surface.
- Choose a hybrid official-docs strategy: durable parsers/rules in the package,
  version-aware local cache for fetched docs/schemas/examples, and dynamic
  refresh when the repo's provider/chart/package version is missing or stale.
- Prioritize deterministic validators and semantic constraint extraction over
  LLM-only reasoning for module options, exclusive fields, conditional required
  fields, and replacement risk.
- Defer the topology web UI until graph JSON and impact analysis are reliable.

Recommended next implementation slice:

1. Preserve or commit the existing staged/unstaged runtime slices intentionally.
2. Add YAML syntax validation for touched `.yaml` and `.yml` files.
3. Normalize YAML parse failures into `ValidationIssue` records.
4. Add tests for invalid Helm values, Pulumi stack YAML, and workspace config YAML.
5. Then define knowledge-cache and semantic-constraint types.

## 2026-04-28 YAML Syntax Guard Slice

Files added or updated:

- `src/validators/yaml-syntax.ts`
- `src/tools/ValidateYamlSyntaxTool/ValidateYamlSyntaxTool.ts`
- `src/agent/execute-decision.ts`
- `src/query.ts`
- `src/agent/rule-based-planner.ts`
- `src/model/prompt.ts`
- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/types/tools.ts`
- `src/tools.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a `validate_yaml_syntax` tool that parses planned YAML content before and
  after ordinary YAML writes.
- Block invalid YAML writes before touching files.
- Normalize YAML parse failures into `yaml-syntax-failure` validation issues.
- Preserve newly discovered YAML validation failures in the query loop instead
  of clearing them as stale repair-loop failures.
- Treat YAML parse success as a write guard, not as Helm/Pulumi/Terraform target
  validation. The planner must still run domain validators after writes.
- Skip raw YAML parsing under Helm `templates/` because those files can contain
  Go template syntax; rely on `helm template` for rendered validation.

Implementation note:

- The validator first checks for an installed `yaml` npm package via
  `require.resolve` and only imports it when present.
- In the current workspace it falls back to `python3` with PyYAML. The fallback
  uses a temp file rather than stdin because `spawnSync` with `input` can hang
  in the current sandbox.
- Superseded by the later YAML dependency slice below: current code uses the
  bundled `yaml` npm dependency directly.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 147/147 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

## 2026-04-28 YAML Dependency And Helm Schema Semantics Slice

Files added or updated:

- `package.json`
- `package-lock.json`
- `src/validators/yaml-syntax.ts`
- `src/types/config-semantics.ts`
- `src/types/repository.ts`
- `src/domain/helm-values-schema.ts`
- `src/domain/inspect-workspace.ts`
- `src/model/prompt.ts`
- `src/cli/output.ts`
- `fixtures/sample-workspace/charts/payments-api/values.schema.json`
- `test/cli-smoke.test.mjs`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add the widely used `yaml` npm package as a first-class dependency, with
  lockfile, so installed CLI users are not dependent on local Python/PyYAML.
- Simplify YAML syntax validation to use the bundled dependency directly.
- Add `ConfigSemanticsSummary` and `ConfigSemanticFact` types.
- Detect Helm `values.schema.json` during workspace inspection.
- Extract initial Helm values schema facts:
  - `required-field`
  - `defaulted-field`
  - `enum`
  - `exactly-one-group` from JSON Schema `oneOf`
- Include focused config semantics in the planner user prompt for top candidate
  targets.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 149/149 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Use Helm schema facts in edit-plan builders before LLM planning, starting
   with ingress/service/probe values.
2. Add Terraform variable/validation-block semantics extraction.
3. Add Pulumi stack config key semantics from observed stack files and preview
   missing-config output.
4. Extend validation result cards to show semantic blockers separately from
   validator stderr.

## 2026-04-28 Helm Schema-Aware Edit Plans Slice

Files added or updated:

- `src/agent/edit-plans/helm-schema-semantics.ts`
- `src/agent/edit-plans/helm-ingress.ts`
- `src/agent/edit-plans/helm-ingress-values-repair.ts`
- `src/agent/edit-plans/helm-service-port-repair.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Start consuming extracted Helm values schema facts in edit-plan builders.
- Add a focused helper for Helm semantic lookups so schema logic does not spread
  across individual edit-plan files.
- Use `enum` facts to choose `ingress.className`. For example, if schema allows
  only `alb`, the ingress plan now writes `className: alb` instead of hardcoded
  `nginx`.
- Surface schema rationale in edit-plan rationale when schema facts influence
  generated values.
- Include required `service.port` schema notes in ingress/service-port repair
  rationales when available.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 150/150 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Use required/default Helm schema facts to decide when ingress/service/probe
   values are incomplete before validators fail.
2. Add schema-aware repair for missing required fields beyond `service.port` and
   `ingress.enabled`.
3. Add Terraform variable semantics extraction.

## 2026-04-28 Terraform Variable Semantics Slice

Files added or updated:

- `src/domain/terraform-variables.ts`
- `src/types/config-semantics.ts`
- `src/domain/inspect-workspace.ts`
- `src/agent/edit-plans/terraform-tfvars-config.ts`
- `fixtures/terraform-workspace/terraform/payments-api/main.tf`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add Terraform variable semantic extraction during workspace inspection.
- Emit high-confidence facts for `.tf` variable declarations:
  - `required-field` when a variable has no default
  - `defaulted-field` when a variable has a default
  - `type-constraint` from `type = ...`
  - `validation-rule` from nested `validation` blocks
  - validation-derived `enum` when the condition uses a `contains([...], var.x)`
    pattern
- Reuse the Terraform variable block scanner inside tfvars edit-plan key
  inference so variable-name discovery is no longer duplicated there.
- Add focused prompt coverage so Terraform config semantics are available to the
  planner for top Terraform targets.
- Record the behavior in the roadmap, repo rules, and agent-facing skill
  reference.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 152/152 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Use Terraform enum/type facts in tfvars edit plans before writing values.
2. Add Pulumi stack config semantics from stack YAML and missing-config preview
   output.
3. Start the knowledge-cache type definitions once repo-local schema facts cover
   the three primary domains.

## Current Verification Commands

Use these before handing off or committing:

```sh
npm run test
npm run lint
npm run smoke
git diff --check
```
