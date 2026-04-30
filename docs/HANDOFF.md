# infra-agent Handoff Notes

This document captures current development state for future Codex sessions.

## Current Branch State

- Branch: `agent-1`
- Recent completed commits:
  - `65eab57` Suggest identity report handoff commands
  - `453048a` Check identity report schema versions
  - `84bc3c9` Validate identity report inputs
  - `363ef24` Cover identity report file loading
  - `aa0d0f2` Add identity conflict incident reports
  - `7cb7098` Refine identity conflict review steps
  - `06b97a7` Add identity conflict review checklists
  - `c07b81b` Expose runtime resource locators
  - `6337819` Extract AWS named runtime identities
  - `8f84a55` Extract Kubernetes runtime identities
  - `7c423cf` Expose identity conflicts in compact JSON
  - `c9d5a04` Use exclusive specs for runtime conflicts
  - `fe3d114` Classify Terraform runtime identity conflicts
  - `81c051f` Classify listener rule priority conflicts
  - `f0ccb17` Handle all-protocol security rule identity
  - `7423955` Classify security runtime conflicts
  - `2039f49` Add VPC security group rule identity conflicts
  - `15fe5a9` Add security rule identity conflicts
  - `b4d511a` Classify Pulumi DNS identity conflicts
  - `a5cd2a8` Add AWS DNS domain identity rules
  - `526595a` Tag provider schema context with lockfile versions
  - `a20b52b` Add Terraform provider schema context
  - `0082b6a` Add AWS load balancing identity rules
  - `55d9da1` Add stable graph impact snapshot
  - `a5da92f` Enrich graph replacement reasons
  - `9f98219` Add unchanged dependency context nodes
  - `6a81fe5` Detect Terraform exclusive identity conflicts
  - `6ee9012` Generalize Pulumi exclusive identity conflicts
  - `4a6d609` Handle Pulumi replacement steps in route conflicts
  - `2f32398` Detect Pulumi route replacement conflicts
  - `c706bd6` Summarize graph impact output
  - `b9438a7` Add impact dependency cascade edges
  - `09e60c7` Mark Pulumi rename candidates in graph
  - `546ac03` Select Helm dependency context sources
  - `f80aa26` Score Terraform rename candidates
  - `60f863f` Attach Pulumi preview actions to graph
  - `f4adcb1` Mark Terraform rename candidates in graph
  - `3eccc71` Attach Terraform plan actions to graph
  - `f1cc221` Add workspace infra graph foundation
  - `674921b` Add bounded knowledge prefetch command
  - `155d0fd` Load Helm chart context into prompts
  - `640cd0b` Select Helm chart context sources
  - `0657434` Load cached Terraform context into prompts
  - `a7ea04f` Select Terraform Registry context sources
  - `46f3e21` Add cache-backed knowledge retrieval
  - `5a30d1d` Emit compact agent JSON results
  - `f46ef4b` Resolve knowledge cache roots
  - `7a01e78` Surface semantic blockers in result cards
  - `8dff15e` Add knowledge cache foundation
  - `b425ee8` Format Terraform tfvars values using type facts
  - `39196f9` Promote validation issues into config semantics
  - `f4c0f40` Use Pulumi config semantics in edit plans
  - `9a53a35` Extract Pulumi stack config semantics
  - `7ad7fb3` Gate Terraform tfvars plans with enum semantics
  - `3ff220a` Extract Terraform variable semantics
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

## 2026-04-28 Terraform Enum-Gated Tfvars Slice

Files added or updated:

- `src/domain/terraform-config-semantics.ts`
- `src/agent/build-run-preflight.ts`
- `src/agent/edit-plans/terraform-tfvars-config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Use Terraform enum facts before generating tfvars writes.
- Normalize Terraform environment aliases (`development` -> `dev`,
  `production` -> `prod`) through a shared helper.
- Add preflight clarification assumptions when a requested Terraform environment
  violates a variable validation enum.
- Block bounded tfvars edit plans when the environment value would violate the
  extracted enum constraint.
- Include enum rationale in safe Terraform tfvars edit plans.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 154/154 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Pulumi stack config semantics from stack YAML and missing-config preview
   output.
2. Add Terraform type-aware tfvars value formatting for booleans, numbers, and
   simple collection values.
3. Start the knowledge-cache type definitions after Pulumi config semantics land.

## 2026-04-28 Pulumi Stack Config Semantics Slice

Files added or updated:

- `src/domain/pulumi-stack-config.ts`
- `src/domain/inspect-workspace.ts`
- `src/types/config-semantics.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add Pulumi project/stack config semantics during workspace inspection.
- Extract `type-constraint` and `defaulted-field` facts from `Pulumi.yaml`
  `config` declarations.
- Extract `configured-field` facts from `Pulumi.<stack>.yaml` stack config.
- Avoid copying Pulumi secret `secure` values into fact values; record only that
  the key is configured as a secret.
- Include focused Pulumi config semantics in planner prompts for top Pulumi
  targets.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 156/156 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Use Pulumi config semantics in stack edit plans to select existing namespaces
   and avoid introducing parallel config keys.
2. Add Pulumi missing-config preview facts into `ConfigSemantics`, not just
   repair-specific `ValidationIssue` metadata.
3. Start knowledge-cache type definitions and filesystem layout.

## 2026-04-28 Pulumi Semantics-Aware Edit Plans Slice

Files added or updated:

- `src/agent/edit-plans/pulumi-stack-config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Use Pulumi config semantics in stack edit plans before falling back to project
  name or stack text heuristics.
- Prefer stack-specific `configured-field` facts when choosing config keys like
  `<namespace>:environment` and `<namespace>:imageTag`.
- Fall back to project `type-constraint`/`defaulted-field` declaration facts
  when the target stack has no existing value for that key.
- Preserve the previous stack-text namespace fallback for workspaces without
  extracted semantics.
- Add a regression test where `Pulumi.yaml` project `name` drifts but existing
  stack/config facts still point to the repository's established namespace.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 157/157 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Pulumi missing-config preview facts into `ConfigSemantics`, not just
   repair-specific `ValidationIssue` metadata.
2. Add Terraform type-aware tfvars value formatting for booleans, numbers, and
   simple collection values.
3. Start knowledge-cache type definitions and filesystem layout.

## 2026-04-28 Runtime Validation-Derived Semantics Slice

Files added or updated:

- `src/agent/config-semantics-state.ts`
- `src/types/agent.ts`
- `src/types/config-semantics.ts`
- `src/query.ts`
- `src/model/prompt.ts`
- `src/agent/edit-plans/helm-schema-semantics.ts`
- `src/agent/edit-plans/pulumi-stack-config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add runtime-level config semantics that start from inspection facts and can be
  augmented during the validation loop.
- Promote Pulumi missing-config preview failures into high-confidence
  `required-field` facts with `source.kind = pulumi-preview`.
- Merge validation-derived facts without duplicating existing facts.
- Make planner prompts consume runtime semantics rather than only static
  inspection semantics.
- Make Helm/Pulumi edit-plan helpers read runtime semantics, so later
  validation-derived facts can influence repairs.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 158/158 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Terraform type-aware tfvars value formatting for booleans, numbers, and
   simple collection values.
2. Start knowledge-cache type definitions and filesystem layout.
3. Add result-card output for validation-derived semantic blockers.

## 2026-04-28 Terraform Type-Aware Tfvars Formatting Slice

Files added or updated:

- `src/domain/terraform-config-semantics.ts`
- `src/agent/edit-plans/terraform-tfvars-config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Use Terraform `type-constraint` facts before formatting generated tfvars
  values.
- Keep `string` variables quoted even when the requested value looks numeric,
  such as image tag `123`.
- Preserve raw formatting for valid `bool` and `number` variable values.
- Include type facts in Terraform edit-plan rationale.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 159/159 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Start knowledge-cache type definitions and filesystem layout.
2. Add result-card output for validation-derived semantic blockers.
3. Expand Terraform type-aware formatting for simple list/map values when the
   task language can safely identify them.

## 2026-04-28 Knowledge Cache Foundation Slice

Files added or updated:

- `src/types/knowledge.ts`
- `src/knowledge/cache.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add first-class knowledge/context cache types:
  - `KnowledgeSource`
  - `KnowledgeCacheEntry`
  - `KnowledgeCacheWrite`
  - `RetrievedContextPacket`
- Add a local JSON cache adapter with deterministic source IDs, content hashes,
  read/write helpers, and stale-after checks.
- Keep cache IDs version-sensitive by including source kind/name/version/url/path
  metadata in the source hash.
- Do not add network fetching yet; this is only the durable local storage and
  typing layer for later official-doc retrieval.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 161/161 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add result-card output for validation-derived semantic blockers.
2. Add a cache root resolver and workspace-config override for knowledge cache
   location.
3. Add dynamic official-doc fetchers only after cache root policy is explicit.

## 2026-04-28 Result-Card Semantic Blockers Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Surface validation-derived config semantics directly in result cards instead
  of leaving them only in planner prompts or raw validation stderr.
- Add a `Semantic blockers` result-card line.
- Currently reports high-confidence Pulumi preview `required-field` facts, for
  example missing stack config discovered by `pulumi preview`.
- Keep the output compact by showing at most three structured blockers with
  target kind, target path, config path, and semantic source.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 161/161 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a cache root resolver and workspace-config override for knowledge cache
   location.
2. Add compact JSON result output if downstream agent usage starts carrying too
   much prose.
3. Add dynamic official-doc fetchers only after cache root policy is explicit.

## 2026-04-28 Knowledge Cache Root Resolver Slice

Files added or updated:

- `src/knowledge/cache-root.ts`
- `src/types/knowledge.ts`
- `src/types/repository.ts`
- `src/domain/inspect-workspace.ts`
- `src/cli/output.ts`
- `fixtures/configured-workspace/infra-agent.config.json`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a deterministic knowledge-cache root resolver before adding dynamic
  official-doc fetching.
- Resolve cache roots with clear precedence:
  `INFRA_AGENT_KNOWLEDGE_CACHE`, then workspace config
  `knowledgeCache.root`, then user cache directory.
- Expand `~` for the explicit environment override and `XDG_CACHE_HOME`.
- Keep repo-provided `knowledgeCache.root` safe by requiring a
  workspace-relative path that stays inside the active workspace.
- Add the resolved cache root/source to workspace inspection and `inspect`
  output so downstream agents can see where persistent context will live.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 165/165 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a compact JSON result mode if downstream agent usage starts carrying too
   much prose.
2. Add a first dynamic official-doc fetcher using the resolved cache root and a
   no-network fallback path.
3. Start impact-analysis graph types before building any topology UI.

## 2026-04-28 Compact Agent JSON Result Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Make `agent --json` usable by other agents without forcing them to ingest the
  full runtime state, preflight, and turn history.
- Add compact payload kind `infra-agent.agent-result` with schema version `1`.
- Include only high-signal fields: outcome, model, turn count, task, workspace,
  requested domain/environment/service, primary target, changed files,
  result-card lines, next steps, suggested commands, validation status/findings,
  semantic blockers, validation issues, approval signals, and resolved
  knowledge-cache root.
- Preserve full debug output behind `agent --json-full`.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 166/166 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a first dynamic official-doc fetcher using the resolved cache root and a
   deterministic no-network fallback when fetching is unavailable.
2. Add compact JSON mode for `run --json` only if downstream agent preflight
   output becomes too large.
3. Start impact-analysis graph types before building any topology UI.

## 2026-04-28 Knowledge Context Retrieval Slice

Files added or updated:

- `src/knowledge/retrieve.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a cache-first retrieval helper that returns compact
  `RetrievedContextPacket` excerpts instead of full official documents.
- Prefer fresh cache entries before fetching.
- Fetch missing or stale sources when an explicit fetcher is provided.
- Fall back to stale version-scoped cached entries with `medium` confidence when
  fresh retrieval is unavailable, so network/doc failures do not hard-block
  unrelated configuration work.
- Add a first official URL fetcher abstraction with response content-type
  normalization. Tests use mocked fetchers; no test requires network access.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 170/170 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Wire retrieval into a focused docs/context selection path for one concrete
   source family, such as Terraform Registry provider docs or Helm docs.
2. Keep all fetched context version-scoped and compact before exposing it to the
   planner.
3. Start impact-analysis graph types before building any topology UI.

## 2026-04-28 Terraform Registry Context Source Slice

Files added or updated:

- `src/domain/terraform-hcl.ts`
- `src/domain/terraform-variables.ts`
- `src/domain/terraform-registry-context.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a focused Terraform Registry context selection path for Terraform
  resource and data-source docs.
- Extract provider source and version metadata from `required_providers` and
  `.terraform.lock.hcl` when present.
- Build version-sensitive `KnowledgeSource` records for resource/data-source
  references such as `aws_instance` and `aws_ami`.
- Retrieve selected Terraform Registry docs through the cache-backed knowledge
  retrieval layer using mock fetchers in tests.
- Refactor shared lightweight Terraform HCL helpers out of
  `terraform-variables.ts` so variable semantics and Registry context selection
  use the same brace/attribute parsing behavior.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 172/172 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Feed selected Terraform Registry context packets into planner prompts only
   when a Terraform task touches a resource/data-source whose docs are relevant.
2. Add Helm official-doc or chart-doc source selection using chart metadata and
   `values.schema.json`.
3. Start impact-analysis graph types before building any topology UI.

## 2026-04-28 Cached Terraform Context Prompt Slice

Files added or updated:

- `src/types/agent.ts`
- `src/query.ts`
- `src/model/prompt.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `retrievedContext` to `AgentRuntimeState`.
- During initial runtime construction, load cached Terraform Registry context
  packets for selected Terraform roots when the task requested Terraform.
- Keep runtime docs retrieval cache-only by default; no automatic network fetch
  happens inside the query loop.
- Add compact `retrievedContext` packets to planner user prompts with excerpts
  capped to keep context bounded.
- Add regression coverage showing cached Terraform Registry docs are loaded into
  runtime and passed to the planner prompt.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 174/174 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Helm official-doc or chart-doc source selection using chart metadata and
   `values.schema.json`.
2. Add a CLI command to prefetch selected official docs explicitly, instead of
   fetching implicitly inside `agent`.
3. Start impact-analysis graph types before building any topology UI.

## 2026-04-28 Helm Chart Context Source Slice

Files added or updated:

- `src/domain/helm-chart-context.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add Helm chart context source selection for repo-local chart schema and
  external Helm/chart docs.
- Emit local `values.schema.json` as a high-confidence `chart-schema`
  `RetrievedContextPacket`.
- Derive optional `helm-docs` and `chart-docs` `KnowledgeSource` records from
  `Chart.yaml` metadata such as `home` and `sources`.
- Keep external docs cache-backed through the existing retrieval layer and
  mocked in tests; no network is required.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 176/176 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a CLI command to prefetch selected official docs explicitly, instead of
   fetching implicitly inside `agent`.
2. Start impact-analysis graph types before building any topology UI.
3. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.

## 2026-04-28 Helm Chart Context Prompt Slice

Files added or updated:

- `src/query.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Load selected Helm chart context packets during initial runtime construction
  when the task requested Helm.
- Keep local `values.schema.json` available to the planner as high-confidence,
  compact context without requiring network access.
- Keep external Helm/chart docs cache-only by default in the agent loop, matching
  the Terraform prompt path's no-implicit-fetch policy.
- Add regression coverage showing Helm runtime state includes local chart schema
  context for Helm-focused tasks.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 177/177 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Start impact-analysis graph types before building any topology UI.
2. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.
3. Add Pulumi official-doc/source selection for detected package imports and
   stack config namespaces.

## 2026-04-28 Knowledge Prefetch CLI Slice

Files added or updated:

- `src/knowledge/prefetch.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add an explicit `infra-agent prefetch` command for deliberate official-doc
  cache updates outside the agent loop.
- Reuse Terraform Registry and Helm chart context source builders so the fetch
  path selects the same version-sensitive sources used by planner retrieval.
- Keep prefetch bounded through `--domain`, `--target`, and `--max-sources`.
- Treat repo-local sources such as `values.schema.json` as local and skip
  unnecessary fetch attempts.
- Add pure prefetch coverage with a mocked fetcher and CLI argument parsing
  coverage for source selection flags.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 179/179 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.
2. Add Pulumi official-doc/source selection for detected package imports and
   stack config namespaces.
3. Attach Terraform plan JSON or Pulumi preview event actions to graph nodes
   after the graph foundation is stable.

## 2026-04-28 Workspace Infra Graph Foundation Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `scripts/smoke.mjs`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a normalized `infra-agent.infra-graph` JSON shape before any web topology
  viewer work.
- Build graph nodes and edges from workspace inspection facts for Helm charts,
  Helm values schemas, Pulumi projects/stacks, Terraform roots, and Terraform
  tfvars files.
- Add `infra-agent graph [workspace] [--json]` as a local topology handoff
  surface for future agents and UI work.
- Keep graph confidence scoped to inspection-derived structure; plan/preview
  actions and replacement impact are not attached yet.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 181/181 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.
2. Add Pulumi official-doc/source selection for detected package imports and
   stack config namespaces.
3. Add Pulumi preview event actions to graph nodes after Terraform plan actions
   are stable.

## 2026-04-28 Terraform Plan Graph Impact Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/impact/terraform-plan-graph.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend the infra graph with Terraform plan-derived resource change nodes.
- Add `terraform-resource` nodes and `planned-change` edges sourced from
  read-only Terraform plan JSON.
- Parse Terraform plan actions into `create`, `update`, `delete`, `replace`,
  `read`, and `no-op`, while skipping `no-op` nodes by default.
- Preserve Terraform `replace_paths` and `action_reason` metadata for future
  replacement and rename analysis.
- Add CLI support for
  `infra-agent graph --terraform-plan <plan.json> --target <terraform-root>
  --json` without executing Terraform.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 183/183 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Pulumi preview event actions to graph nodes.
2. Refine Terraform rename detection with additional provider-specific stable
   identity fields and confidence scoring.
3. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.

## 2026-04-28 Terraform Rename Candidate Graph Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/terraform-plan-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add medium-confidence `possible-rename` graph edges for Terraform plan
  delete/create pairs that share resource type, provider, and stable identity
  fields.
- Extract generic identity fields such as `name`, `bucket`, and `tags.Name`
  from Terraform plan `before` and `after` objects.
- Keep rename output advisory only; it is a review candidate for moved blocks or
  state moves, not an automatic state mutation instruction.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 184/184 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Refine Terraform rename detection with provider-specific stable identity
   fields and confidence scoring.
2. Detect replacement cascades from Terraform and Pulumi graph dependency edges.
3. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.

## 2026-04-28 Pulumi Preview Graph Impact Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `pulumi-resource` graph nodes and `planned-change` edges sourced from
  read-only Pulumi preview JSON/event JSON.
- Parse common `resourcePreEvent.metadata`, `resOutputsEvent.metadata`, and
  simple `steps` shapes into create/update/delete/replace/read/no-op actions.
- Add CLI support for
  `infra-agent graph --pulumi-preview <preview.json> --target <pulumi-project>
  --json` without executing Pulumi.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 186/186 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Detect replacement cascades from Terraform and Pulumi graph dependency edges.
2. Expand Helm context selection to include chart dependency metadata when
   `Chart.lock` or `charts/` dependencies are present.
3. Add Pulumi rename candidate detection from preview delete/create pairs when
   URN/type/name evidence is sufficient.

## 2026-04-28 Terraform Rename Confidence Scoring Slice

Files added or updated:

- `src/impact/terraform-plan-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Replace boolean Terraform rename candidate detection with a scored model.
- Add provider/resource-specific stable identity field paths for common AWS and
  Kubernetes resources.
- Include `score`, `matchingIdentityKeys`, and `reason` metadata on
  `possible-rename` edges.
- Keep weak tag-only matches at medium confidence while allowing stronger
  identity matches, such as `bucket` plus `tags.Name`, to become high
  confidence.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 186/186 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Detect replacement cascades from Terraform and Pulumi graph dependency edges.
2. Add Pulumi rename candidate detection from preview delete/create pairs when
   URN/type/name evidence is sufficient.
3. Extend graph dependency edges beyond containment/configuration using plan or
   preview dependency metadata.

## 2026-04-28 Helm Dependency Context Slice

Files added or updated:

- `src/types/knowledge.ts`
- `src/domain/helm-chart-context.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add local `chart-lock` knowledge sources and high-confidence local packets for
  Helm `Chart.lock`.
- Parse dependency metadata from both `Chart.yaml` and `Chart.lock`.
- Add version-aware `chart-docs` sources for dependency chart repositories when
  the repository URL is HTTP(S).
- Skip non-document dependency schemes such as `file://` and `oci://` for
  external fetch selection.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 187/187 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Detect replacement cascades from Terraform and Pulumi graph dependency edges.
2. Extend graph dependency edges beyond containment/configuration using plan or
   preview dependency metadata.
3. Add a compact impact summary command/output on top of graph JSON.

## 2026-04-28 Pulumi Rename Candidate Graph Slice

Files added or updated:

- `src/impact/pulumi-preview-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add advisory `possible-rename` edges for Pulumi preview delete/create pairs
  with matching resource type and stable identity fields.
- Extract identity fields such as `metadata.name`, `metadata.namespace`,
  `bucket`, and `tags.Name` from Pulumi preview `old`, `new`, `inputs`, or
  `outputs` metadata.
- Avoid namespace-only Kubernetes matches to reduce false positives.
- Preserve the same safety rule as Terraform: rename edges are review
  candidates only and do not authorize state mutation.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 188/188 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Detect replacement cascades from Terraform and Pulumi graph dependency edges.
2. Extend graph dependency edges beyond containment/configuration using plan or
   preview dependency metadata.
3. Add a compact impact summary command/output on top of graph JSON.

## 2026-04-28 Dependency Cascade Graph Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/terraform-plan-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add graph edge kinds for `depends-on` and `replacement-cascade`.
- Extract Terraform dependencies from plan value `depends_on` arrays and
  configuration expression references that resolve to changed resource
  addresses.
- Extract Pulumi dependencies from preview metadata fields such as
  `dependencies`, `dependencyUrns`, `dependencyURNs`, `dependsOn`, and
  `propertyDependencies`.
- Emit `replacement-cascade` edges when a replaced/deleted upstream resource has
  a changed dependent in the same plan or preview graph.
- Keep cascade edges advisory: they explain blast radius and likely causal
  relationships, but they do not authorize apply/deploy or state mutation.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 190/190 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a compact impact summary command/output on top of graph JSON.
2. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
3. Start provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.

## 2026-04-28 Compact Impact Summary Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend `InfraGraphSummary` with `edgesByKind` and compact `summary.impact`
  counters for planned changes, dependency edges, possible renames, and
  replacement cascades.
- Add `summarizeInfraGraphImpact` and an `Impact` section to graph text output
  so users and downstream agents can consume key impact findings without
  scanning every node and edge.
- Keep full graph JSON available for topology/UI work while providing a smaller
  agent-to-agent handoff surface.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 190/190 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
2. Start provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.
3. Add a local topology viewer only after graph snapshots stabilize further.

## 2026-04-28 Pulumi Route Create-Before-Delete Conflict Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/types/agent.ts`
- `src/impact/workspace-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `src/agent/classify-validation-issues.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Detect Pulumi AWS Route delete/create pairs with the same route table and
  destination as `create-before-delete-conflict` graph edges.
- Extend graph impact summaries with `createBeforeDeleteConflicts` so downstream
  agents can see ordering hazards without scanning every edge.
- Classify Pulumi `RouteAlreadyExists` failures as
  `pulumi-create-before-delete-conflict` validation issues.
- Provide operator guidance: use Pulumi aliases for logical renames,
  `deleteBeforeReplace` for true replacements with accepted temporary route
  removal, or explicit state/import repair after human approval.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 192/192 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Generalize exclusive-identity conflict detection beyond AWS Route to other
   scarce or singleton resources.
2. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
3. Start provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.

## 2026-04-28 Pulumi Replacement Operation Compatibility Slice

Files added or updated:

- `src/impact/pulumi-preview-graph.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Normalize Pulumi `create-replacement` preview operations as create-like graph
  actions and `delete-replaced` operations as delete-like graph actions.
- Cover AWS Route create-before-delete conflict detection for real Pulumi
  replacement step pairs, not only plain create/delete pairs.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 192/192 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Generalize exclusive-identity conflict detection beyond AWS Route to other
   scarce or singleton resources.
2. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
3. Start provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.

## 2026-04-28 Generic Exclusive Identity Conflict Slice

Files added or updated:

- `src/impact/pulumi-preview-graph.ts`
- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Generalize Pulumi create-before-delete conflict detection from AWS Route into
  an `ExclusiveIdentitySpec` table.
- Current graph specs cover AWS Routes, S3 buckets, selected named AWS
  resources, and Kubernetes objects.
- Classify generic Pulumi `AlreadyExists` and duplicate-name failures as
  `pulumi-create-before-delete-conflict`, while preserving Route-specific
  route table and destination metadata when available.
- Record this as a common IaC risk pattern: provider-exclusive physical
  identities often make create-before-delete replacement unsafe even when the
  Pulumi plan looks mechanically valid.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 194/194 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add Terraform-side exclusive-identity conflict detection for known ForceNew
   resources where create-before-destroy can collide with provider uniqueness.
2. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
3. Move the Pulumi exclusive identity specs into a shared provider rule module
   once Terraform needs the same registry.

## 2026-04-28 Terraform Exclusive Identity Conflict Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `src/impact/pulumi-preview-graph.ts`
- `src/impact/terraform-plan-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Move provider-exclusive identity specs into a shared graph rule module used by
  both Pulumi and Terraform impact analysis.
- Add Terraform `create-before-delete-conflict` graph edges for
  create-before-destroy replacements that keep the same exclusive physical
  identity.
- Add medium-confidence Terraform ordering warnings for delete/create pairs that
  share the same exclusive identity, because the plan may still need manual
  sequencing or state-move review.
- Preserve Pulumi behavior while making future provider/resource specs reusable
  across IaC engines.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 195/195 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Extend dependency extraction to unchanged state resources when safe state or
   preview metadata is available, avoiding dangling graph edges.
2. Add provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.
3. Add more exclusive-identity specs from real failure examples and provider
   schemas.

## 2026-04-29 Dependency Context Nodes Slice

Files added or updated:

- `src/impact/terraform-plan-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add Terraform dependency context nodes for unchanged resources when planned
  values, prior state values, or no-op resource changes provide safe metadata.
- Add Pulumi dependency context nodes for unchanged resources when `same`/no-op
  preview metadata is available.
- Preserve graph impact semantics: dependency context nodes use
  `metadata.role=dependency-context`, omit `metadata.action`, and do not receive
  `planned-change` edges, so summaries keep counting only real planned changes.
- Avoid dangling dependency edges in graph output while still minimizing prompt
  context for downstream agents.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 197/197 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add provider-specific replacement reason enrichment from schemas or known
   force-replacement fields.
2. Add more exclusive-identity specs from real failure examples and provider
   schemas.
3. Add stable graph snapshot fixtures before starting any topology viewer.

## 2026-04-29 Provider Replacement Reason Slice

Files added or updated:

- `src/impact/replacement-reasons.ts`
- `src/impact/terraform-plan-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a shared provider replacement reason rule module used by Terraform and
  Pulumi graph impact analysis.
- Enrich Terraform resource nodes from native `replace_paths`, including known
  exclusive-identity/immutable fields and provider-reported fallback metadata
  for unknown paths.
- Enrich Pulumi resource nodes from replacement-kind `detailedDiff` entries,
  with fallback to preview `diffs` for replacement operations.
- Add upstream replacement reason metadata to `replacement-cascade` edges and
  surface it in compact impact text output.
- Keep the metadata advisory: it explains likely replacement causes but does
  not authorize apply, state mutation, or downtime without native plan/preview
  and state review.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 199/199 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more exclusive-identity and replacement reason specs from real failure
   examples and provider schemas.
2. Add stable graph snapshot fixtures before starting any topology viewer.
3. Explore safe provider schema ingestion for initialized Terraform roots while
   keeping prompts compact.

## 2026-04-29 Stable Graph Snapshot Slice

Files added or updated:

- `src/impact/graph-snapshot.ts`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a stable graph snapshot normalizer that preserves the
  `infra-agent.infra-graph` shape while sorting nodes, edges, metadata keys,
  summary maps, and normalizing `workspaceRoot` for fixture comparison.
- Add a cross-domain impact snapshot fixture covering Terraform and Pulumi
  planned changes, unchanged dependency context nodes, `depends-on`,
  `replacement-cascade`, `possible-rename`, `create-before-delete-conflict`,
  and replacement reason metadata.
- Establish a graph contract baseline before local topology viewer work starts.
- Record the rule that snapshot changes are deliberate graph contract updates,
  not incidental churn.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 200/200 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more exclusive-identity and replacement reason specs from real failure
   examples and provider schemas.
2. Explore safe provider schema ingestion for initialized Terraform roots while
   keeping prompts compact.
3. Start a read-only local topology viewer only after one more graph contract
   slice if the graph snapshots remain stable.

## 2026-04-29 AWS Load Balancing Identity Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `src/impact/replacement-reasons.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add AWS Load Balancer and Target Group resources to shared named-resource
  exclusive identity and replacement reason rules.
- Add AWS Load Balancer Listener Rule as a separate exclusive identity spec
  keyed by `listenerArn`/`listener_arn` plus `priority`, because listener rule
  priority must be unique per listener and create-before-delete can fail with
  `PriorityInUse`.
- Add replacement reason rules for listener rule `listenerArn`/`listener_arn`
  and `priority`, so graph output can explain priority-driven replacements
  before users accept downtime or state changes.
- Cover Terraform create-before-destroy listener rule conflict detection and
  Pulumi listener rule replacement reason enrichment in smoke tests.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 202/202 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Explore safe provider schema ingestion for initialized Terraform roots while
   keeping prompts compact.
2. Add more provider-exclusive specs from real failure examples, especially
   CloudFront aliases, API Gateway custom domains, Route53 records, and ACM
   certificate domain validation records.
3. Start a read-only local topology viewer only after schema-backed graph
   enrichment and snapshot coverage remain stable.

## 2026-04-29 Terraform Provider Schema Context Slice

Files added or updated:

- `src/domain/terraform-provider-schema.ts`
- `src/domain/inspect-workspace.ts`
- `src/knowledge/prefetch.ts`
- `src/query.ts`
- `src/impact/workspace-graph.ts`
- `src/domain/task-targeting.ts`
- `src/types/config-semantics.ts`
- `src/types/repository.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add read-only ingestion for local Terraform provider schema exports saved
  inside a Terraform root at `.infra-agent/terraform-provider-schema.json`,
  `.infra-agent/terraform-providers-schema.json`,
  `terraform-provider-schema.json`, or `terraform-providers-schema.json`.
- Parse `terraform providers schema -json` output defensively and only extract
  compact facts for resources and data sources actually used by the selected
  Terraform root.
- Add provider schema `ConfigSemantics` facts for provider-required fields,
  configured field types, and required/configured nested block constraints.
- Add a compact local provider-schema context packet for agent prompts without
  caching or injecting the full provider schema JSON.
- Add provider schema local source reporting to `prefetch`; local schema files
  are reported as local and do not consume external fetch budget.
- Surface provider schema file counts in inspection and workspace graph
  Terraform root metadata.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 204/204 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more provider-exclusive specs from real failure examples, especially
   CloudFront aliases, API Gateway custom domains, Route53 records, and ACM
   certificate domain validation records.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 Terraform Provider Schema Version Slice

Files added or updated:

- `src/domain/terraform-provider-lock.ts`
- `src/domain/terraform-registry-context.ts`
- `src/domain/terraform-provider-schema.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Move Terraform `.terraform.lock.hcl` provider version parsing into a shared
  helper so Registry docs and local provider schema context use the same
  source/version normalization.
- Tag local provider schema `KnowledgeSource` and `ConfigSemanticSource`
  objects with locked provider version labels such as `hashicorp/aws@5.37.0`
  when lockfile data is available.
- Include a `providerVersions` map and per-block `providerVersion` value in the
  compact provider schema context packet so downstream agents can see exact
  local schema provenance without receiving the full schema JSON.
- Preserve behavior when no lockfile is present: the provider schema remains
  usable as unversioned local shape context, not as validator-grade replacement
  proof.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 204/204 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add runtime validation issue classifiers for the new DNS/domain conflict
   families when real CLI output examples are available.
2. Add a small graph or impact fixture only when new specs change observable
   graph behavior.
3. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 AWS DNS And Domain Identity Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `src/impact/replacement-reasons.ts`
- `src/impact/terraform-plan-graph.ts`
- `src/impact/pulumi-preview-graph.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add shared exclusive-identity specs for:
  - CloudFront distribution aliases/CNAMEs with overlap matching.
  - API Gateway v1/v2 custom domains keyed by domain name.
  - Route53 records keyed by hosted zone, record name, record type, and optional
    routing set identifier.
- Extend exclusive identity matching to support list-overlap identities and
  optional identity groups while preserving existing exact-match behavior.
- Add replacement reason rules for CloudFront aliases/viewer certificates, API
  Gateway domain names/certificates, Route53 record identity/targets, and ACM
  certificate domain/SAN/validation-method replacements.
- Cover Terraform create-before-destroy conflicts for CloudFront alias overlap
  and Route53 ACM validation CNAME records.
- Cover Pulumi API Gateway custom domain create-before-delete conflicts and ACM
  certificate replacement reason enrichment.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 208/208 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add provider-exclusive specs from additional real failure examples, such as
   EIP allocations/associations, VPC endpoint service names, or IAM OIDC
   providers, only when the identity boundary is clear.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 Pulumi DNS Conflict Classifier Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend runtime validation classification for Pulumi provider-exclusive
  ordering failures beyond generic `AlreadyExists`.
- Classify CloudFront `CNAMEAlreadyExists`, API Gateway custom domain
  `ConflictException`, and Route53 `InvalidChangeBatch` duplicate/conflicting
  record outputs as `pulumi-create-before-delete-conflict`.
- Add metadata for conflict family, DNS names, and Route53 record types when
  parseable from CLI output.
- Add family-specific guidance that keeps aliases, `deleteBeforeReplace`,
  `allowOverwrite`, import, and state repair behind native preview/state review
  and explicit approval.
- Keep the issue kind stable so downstream planners and result cards continue
  handling these as non-repairable ordering blockers.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 211/211 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add provider-exclusive specs from additional real failure examples, such as
   EIP allocations/associations, VPC endpoint service names, or IAM OIDC
   providers, only when the identity boundary is clear.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 Security Rule And OIDC Identity Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `src/impact/replacement-reasons.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add shared exclusive-identity specs for legacy AWS Security Group Rule
  resources and IAM OIDC providers.
- Add `combine` support to exclusive identity groups so security group rule
  source fields can be matched as one overlap-based identity boundary across
  CIDR blocks, IPv6 CIDR blocks, prefix lists, source security groups, and
  `self`.
- Add replacement reason path rules for security group permission identity
  fields and IAM OIDC provider URL changes.
- Cover Terraform and Pulumi create-before-delete/create-before-destroy graph
  conflicts for both new specs.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 215/215 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add runtime validation classifiers for `InvalidPermission.Duplicate` and
   IAM OIDC `EntityAlreadyExists` only after collecting representative CLI
   output examples.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 VPC Security Group Rule Identity Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `src/impact/replacement-reasons.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add shared exclusive-identity specs for current VPC-style AWS security group
  ingress and egress rule resources:
  - Terraform `aws_vpc_security_group_ingress_rule`
  - Terraform `aws_vpc_security_group_egress_rule`
  - Pulumi `aws:vpc:SecurityGroupIngressRule`
  - Pulumi `aws:vpc:SecurityGroupEgressRule`
- Keep these separate from legacy `aws_security_group_rule` semantics because
  current VPC-style resources use a single peer field instead of source lists.
- Match identity by security group ID, IP protocol, ports, and one combined peer
  field from `cidrIpv4`/`cidr_ipv4`, `cidrIpv6`/`cidr_ipv6`,
  `prefixListId`/`prefix_list_id`, or
  `referencedSecurityGroupId`/`referenced_security_group_id`.
- Add replacement reason path rules for the same identity fields.
- Cover Terraform ingress and Pulumi egress create-before-delete conflict graph
  behavior.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 217/217 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add runtime validation classifiers for `InvalidPermission.Duplicate` and
   IAM OIDC `EntityAlreadyExists` only after collecting representative CLI
   output examples.
2. Consider provider-schema-assisted conditional identity matching for
   all-protocol VPC security group rules where `fromPort`/`toPort` are omitted,
   but keep the current graph rule conservative until exact plan shapes are
   observed.
3. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-29 Security Runtime Conflict Classifier Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend runtime validation classification for Pulumi provider-exclusive
  ordering failures to security group duplicate permissions and IAM OIDC
  provider duplicates.
- Classify `InvalidPermission.Duplicate` outputs with security-group-rule
  context as `conflictFamily=aws-security-group-rule`.
- Classify `EntityAlreadyExists` outputs with OpenID Connect/OIDC provider
  context as `conflictFamily=aws-iam-oidc-provider`.
- Extract security group IDs, rule peers, and OIDC provider URLs when parseable
  from CLI output.
- Add family-specific guidance that keeps aliases, import, state repair,
  delete-before-create sequencing, and IAM trust-policy changes behind native
  preview/state review and explicit approval.
- Keep the issue kind stable as `pulumi-create-before-delete-conflict` so
  downstream planners continue handling these as non-repairable ordering
  blockers.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 220/220 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation families only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Conditional Security Rule Identity Slice

Files added or updated:

- `src/impact/exclusive-identity.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `omitWhen` support to shared exclusive identity groups. This lets a
  required identity group be omitted only when a controlling identity value has
  an approved value and both compared resources omit the group value.
- Apply `omitWhen` only to VPC-style security group rule `fromPort` and
  `toPort` groups when `ipProtocol` is `-1` or `icmpv6`.
- Preserve conservative behavior for TCP/UDP rules: if ports are missing, the
  graph does not claim a complete exclusive identity match.
- Cover Terraform and Pulumi all-protocol VPC security group rule conflicts
  without port fields, plus a Terraform negative test for TCP rules missing
  ports.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 223/223 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation families only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Listener Rule Runtime Conflict Classifier Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend runtime validation classification for Pulumi provider-exclusive
  ordering failures to AWS load balancer listener rule priority conflicts.
- Classify `PriorityInUse` outputs with listener-rule context as
  `conflictFamily=aws-lb-listener-rule`.
- Extract listener ARNs and listener rule priorities when parseable from CLI
  output.
- Add family-specific guidance that keeps aliases, import, state repair, free
  priority selection, and delete-before-create sequencing behind native
  preview/state review and explicit approval.
- Keep the issue kind stable as `pulumi-create-before-delete-conflict`.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 224/224 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation families only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Terraform Runtime Conflict Classifier Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `terraform-create-before-delete-conflict` as the Terraform-side runtime
  validation issue for provider-exclusive identity collisions found in captured
  Terraform plan/apply failure output.
- Reuse the shared runtime extraction path for conflict code, conflict family,
  DNS names, listener ARN/priority, route table/destination, security rule
  peers, OIDC provider URLs, provider name, and duplicate identity metadata.
- Extract Terraform resource types from `with ...` addresses or `resource`
  block snippets so guidance can distinguish resource families without loading
  large context.
- Keep Terraform runtime conflict guidance review-only: moved blocks,
  reviewed `terraform state mv`, import/state repair, lifecycle
  `create_before_destroy` review, or explicit delete-before-create sequencing
  after approval. This classifier does not authorize running apply.
- Extend result-card summaries and review focus so downstream agents see
  Terraform exclusive identity blockers without scanning raw stderr.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 227/227 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation families only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Spec-Backed Runtime Conflict Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Make Pulumi and Terraform runtime exclusive-identity classification reuse the
  shared graph `ExclusiveIdentitySpec` table whenever a resource type is
  parseable.
- Emit spec-backed `conflictFamily`, `conflictLabel`, and
  `conflictSuggestedAction` metadata so downstream agents can explain bucket,
  named-resource, Kubernetes object, DNS, listener, security rule, and OIDC
  conflicts without loading broad provider docs.
- Keep family-specific guidance for routes, DNS/domain resources, listener
  rules, security rules, and OIDC providers while letting generic fallback
  guidance include the provider rule from the shared spec.
- Cover Terraform S3 bucket duplicate failures and Pulumi S3 bucket duplicate
  failures in regression tests.
- Preserve review-only behavior: spec-backed suggestions do not authorize
  `terraform apply`, Pulumi updates, state mutation, or downtime.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 228/228 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation examples only from representative provider CLI
   outputs with clear identity boundaries.
2. Consider adding a compact machine-readable conflict explanation block to
   `agent --json` only if downstream agents need more than current validation
   issue metadata.
3. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Compact Identity Conflict JSON Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `validation.identityConflicts` to compact `agent --json` output so
  downstream agents can consume runtime Pulumi/Terraform exclusive-identity
  blockers without parsing raw stderr or long guidance strings.
- Summaries include engine, issue kind, conflict code, conflict family,
  conflict label, resource type, parsed identity fields, suggested review
  action, and source command.
- Keep this derived from existing `ValidationIssue` records; no validator or
  repair behavior changes.
- Preserve low-noise context discipline for agent-to-agent handoff.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 228/228 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation examples only from representative provider CLI
   outputs with clear identity boundaries.
2. Consider adding a compact text result-card line for identity conflicts only
   if human users need it; for now `validation.identityConflicts` is the
   machine-readable handoff surface.
3. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Kubernetes Runtime Identity Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/types/agent.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extract Kubernetes object names and namespaces from Pulumi and Terraform
  runtime `AlreadyExists` failures when native CLI output exposes strings such
  as `services "payments-api" already exists` or
  `resource default/payments-api`.
- Preserve parsed `kubernetesNames` and `kubernetesNamespaces` metadata on
  runtime exclusive-identity validation issues and compact
  `validation.identityConflicts` output.
- Add family-specific guidance for `kubernetes-namespaced-object` and
  `kubernetes-namespace` conflicts that points users to API kind,
  `metadata.name`, and `metadata.namespace` review before aliases/import/state
  repair or delete-before-create sequencing.
- Cover Terraform `kubernetes_service` and Pulumi `kubernetes:core/v1:Service`
  duplicate object outputs in regression tests.
- Preserve review-only behavior: do not delete, replace, import, or mutate
  cluster/state automatically.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 230/230 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation examples only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 AWS Named Resource Runtime Identity Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Improve runtime `duplicateIdentity` extraction for common AWS named-resource
  provider errors such as ECR repository duplicates and IAM role duplicates.
- Parse identities from provider messages like
  `repository with name 'payments-api' already exists`,
  `Role with name prod-api already exists`, and safe Terraform
  `creating <named resource> (<name>)` context.
- Preserve spec-backed `aws-named-resource` conflict metadata while giving
  compact `validation.identityConflicts` a concrete physical name.
- Cover Terraform `aws_ecr_repository` and Pulumi `aws:iam/role:Role`
  duplicate outputs in regression tests.
- Preserve review-only behavior: parsed names do not authorize import, state
  move, replacement, or apply/update operations.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 232/232 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime validation examples only from representative provider CLI
   outputs with clear identity boundaries.
2. Keep topology viewer work behind graph/schema contract stability.

## 2026-04-30 Runtime Resource Locator Slice

Files added or updated:

- `src/agent/classify-validation-issues.ts`
- `src/cli/output.ts`
- `src/types/agent.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extract Terraform `resourceAddress` values from native diagnostics such as
  `with module.network.aws_route.private[0],` for runtime exclusive-identity
  blockers.
- Extract Pulumi logical `resourceName` values from diagnostics such as
  `aws:iam/role:Role (api-role):` for the same blocker family.
- Expose the locators in `ValidationIssue.metadata` and compact
  `validation.identityConflicts` so downstream agents can present concrete
  moved-block, alias, import, state-repair, or sequencing review candidates
  without reparsing raw stderr.
- Preserve review-only behavior: locators identify candidates but do not
  authorize state or stack mutation.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 232/232 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add more runtime conflict fixtures only from representative provider CLI
   outputs with clear identity and locator boundaries.
2. Consider a dedicated remediation planner that consumes
   `validation.identityConflicts` and emits review checklists, while keeping
   state mutations behind explicit approval.

## 2026-04-30 Identity Conflict Review Checklist Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `validation.identityConflicts[].reviewSteps` to compact agent JSON so
  downstream agents can follow a short checklist without parsing raw stderr or
  long guidance strings.
- Add an `Identity review` line to result cards that summarizes the engine,
  locator, matched provider identity, and the required logical rename vs real
  replacement triage.
- Keep checklist language review-only: it can mention moved blocks, Pulumi
  aliases, import/state repair, `deleteBeforeReplace`, and sequencing, but it
  must not authorize state or stack mutation.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 232/232 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add provider-specific checklist refinements when representative native CLI
   output proves a safer branch, such as DNS ownership transfer or Kubernetes
   namespace/name ownership review.
2. Consider a read-only command that renders `validation.identityConflicts` as
   a standalone incident report for other agents and human operators.

## 2026-04-30 Provider-Specific Identity Checklist Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Refine `validation.identityConflicts[].reviewSteps` with provider-family
  identity checks instead of only generic ownership wording.
- Cover common families already modeled by the runtime classifier: AWS routes,
  listener priorities, security group rules, CloudFront aliases, API Gateway
  custom domains, Route53 records, IAM OIDC providers, S3 buckets, named AWS
  resources, Kubernetes namespaced objects, and Kubernetes namespaces.
- Keep output concise and review-only while making it clearer which exclusive
  identity fields must be inspected before classifying a logical rename vs a
  real replacement.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 232/232 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add a standalone read-only incident report renderer for
   `validation.identityConflicts` so human operators and other agents can get a
   focused conflict explanation without full result JSON.
2. Add provider-specific checklist branches only when representative native CLI
   output gives enough signal to avoid false confidence.

## 2026-04-30 Identity Conflict Incident Report Slice

Files added or updated:

- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `infra-agent identity-report <agent-result.json> [--json]` as a
  read-only renderer for compact `agent --json` results.
- Emit `infra-agent.identity-conflict-report` JSON for downstream agents and a
  concise text report for human operators.
- Reuse `validation.identityConflicts` summaries, locators, identities,
  provider-family review steps, suggested provider actions, and source
  commands without parsing raw stderr.
- Mark every incident with `mutationAllowed=false` so the report remains
  triage context, not remediation approval.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 233/233 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Add fixture-backed CLI execution coverage for `identity-report` if command
   invocation tests become useful beyond parser and builder coverage.
2. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.

## 2026-04-30 Identity Report File Loader Coverage Slice

Files added or updated:

- `src/cli/identity-report.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a shared `loadIdentityConflictIncidentReport` file loader used by the CLI
  and tests.
- Use a compact agent-result fixture written to a temporary file so the shared
  file-input path verifies report rendering, resource locator output, and
  `mutationAllowed=false`.
- Keep the test read-only with no Terraform, Pulumi, Helm, deploy, or repair
  execution.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 234/234 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.
2. Consider child-process CLI invocation coverage only in an environment where
   spawning the local Node binary is not sandbox-blocked.

## 2026-04-30 Identity Report Input Validation Slice

Files added or updated:

- `src/cli/identity-report.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Validate `identity-report` input before rendering.
- Require compact `infra-agent.agent-result` JSON with a
  `validation.identityConflicts` array.
- Reject graph JSON, full debug state, native plan/preview JSON, raw logs, and
  malformed conflict entries with explicit errors instead of implicit runtime
  failures.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 235/235 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.
2. Consider adding a schema-version compatibility check if compact result
   schema version `2` is introduced later.

## 2026-04-30 Identity Report Schema Version Slice

Files added or updated:

- `src/cli/identity-report.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Require compact `infra-agent.agent-result` `schemaVersion=1` before rendering
  an identity conflict incident report.
- Expose `sourceSchemaVersion` in `infra-agent.identity-conflict-report` so
  downstream agents can confirm which compact result schema was consumed.
- Reject future compact result schema versions explicitly instead of silently
  assuming compatibility.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 235/235 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.
2. Add schema-version branching only when compact result schema version `2` is
   actually introduced.

## 2026-04-30 Smoke And E2E Test Layer Slice

Files added or updated:

- `package.json`
- `scripts/smoke.mjs`
- `scripts/e2e.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/REPOSITORY_CONVENTIONS.md`

Purpose:

- Split verification scripts into explicit layers:
  - `npm run test:unit` for deterministic unit-level Node tests.
  - `npm run smoke` for broad CLI smoke coverage.
  - `npm run e2e` for full runtime behavior with actual workspace file effects.
- Extend smoke coverage to render `identity-report` in JSON and text modes.
- Add E2E coverage that runs inspection, the agent loop, compact result
  generation, and `identity-report`, then verifies actual Helm file changes and
  report contracts.
- Update `npm run verify` to execute lint, unit, smoke, and E2E layers.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 235/235 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.
2. Keep new E2E cases focused on user-visible behavior and avoid duplicating
   unit-level domain assertions.

## 2026-04-30 Identity Report Suggested Command Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `docs/AGENT_RULES.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add read-only identity report handoff commands to `suggestedCommands` when an
  agent run is blocked by runtime exclusive-identity conflicts.
- Suggest exporting compact agent JSON to `agent-result.json` and rendering it
  with `infra-agent identity-report agent-result.json --json`.
- Keep the command pair scoped to reporting; it does not authorize apply/update
  or Terraform/Pulumi state mutation.

Known validation:

- `npm run lint`: passed.
- `npm run test`: 235/235 passed.
- `npm run smoke`: passed.
- `git diff --check`: passed.

Recommended next implementation slice:

1. Continue adding provider-specific checklist branches only when native output
   examples provide precise identity boundaries.
2. Add schema-version branching only when compact result schema version `2` is
   actually introduced.

## Current Verification Commands

Use these before handing off or committing:

```sh
npm run test
npm run lint
npm run smoke
npm run e2e
git diff --check
```
