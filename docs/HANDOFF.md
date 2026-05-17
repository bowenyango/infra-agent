# infra-agent Handoff Notes

This document captures current development state for future Codex sessions.

Detailed legacy slice history was moved to
[`docs/handoff/legacy-slices-2026-05-05-to-2026-05-06.md`](handoff/legacy-slices-2026-05-05-to-2026-05-06.md)
to keep this handoff file focused on the active development context.

## 2026-05-16 Changed Scoped Pack

Status:

- Added `infra-agent pack --changed`, a one-shot changed-component scoped
  handoff for downstream agents.
- The command supports either `--changed --file <path>` inputs for non-git
  callers or `--changed --base <ref> [--head <ref>]` for read-only git diff
  collection. It remains mutually exclusive with `--scope`.
- The output contract remains `infra-agent.scoped-pack` with
  `mutationAllowed=false`. Changed-derived reports now include a compact
  `source.kind=changed-context` summary with changed-file count, affected
  component count, unmapped file count, changed risk level, and changed-context
  recommended action.
- Changed affected components are mapped back to inventory targets, preserving
  suggested files, validation targets, environment hints, semantic fact counts,
  and knowledge-cache posture. Targets can include compact changed-file and
  risk-hint summaries.
- This partially closes the previous scoped-pack gap for changed-component set
  scopes. It does not add Argo CD/Kubernetes linkage, selected knowledge-unit
  enrichment, semantic cache hit/miss reuse, graph-aware related systems, raw
  file content, validators, plan/preview, apply, deploy, or state mutation.

Files changed:

- `src/types/scoped-pack.ts` adds compact scoped-pack source metadata and
  optional changed summaries on matched targets.
- `src/domain/scoped-pack.ts` adds `buildChangedScopedPackReport` and Markdown
  rendering for changed-context source/risk summaries.
- `src/cli/main.ts` adds `pack --changed` parsing and entrypoint wiring while
  leaving `changed` output unchanged.
- `test/unit/scoped-pack.test.mjs`,
  `test/integration/cli-report-main.test.mjs`, and
  `test/integration/cli-core-main.test.mjs` cover changed-derived scoped packs,
  parser behavior, CLI JSON, and help output.
- `README.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, and
  `skills/infra-configuration/SKILL.md` document `pack --changed` as advisory
  changed-component handoff.

Validation:

- `npm run test:focused -- test/unit/scoped-pack.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-report-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run lint` passed.
- `npm run dev -- pack fixtures/sample-workspace --changed --file charts/payments-api/values.yaml --json` passed.
- `npm run dev -- pack fixtures/sample-workspace --changed --file charts/payments-api/templates/deployment.yaml` passed.
- `git diff --check` passed.
- `npm run verify` passed, including lint, structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.

## 2026-05-16 Scoped Pack MVP

Status:

- Added the first top-level scoped agent handoff surface: `infra-agent pack`.
- The command requires `--scope <path|target|env|stack>` and supports repeated
  `--domain helm|pulumi|terraform` filters plus `--json`.
- The report contract is `infra-agent.scoped-pack` with
  `mutationAllowed=false`. Default output is compact Markdown for direct
  Codex/Claude Code handoff.
- This MVP derives context from existing inventory inspection only. It selects
  matching Helm charts, Pulumi projects/stacks, or Terraform roots by path
  intersection, target id/name, environment hint, or Pulumi stack name.
- Output includes matched targets, match reasons, suggested files, validation
  targets, environment hints, semantic fact counts, knowledge-cache posture,
  and omitted/unmatched metadata. It does not include raw file content and does
  not run validators, git diff, plan/preview, apply, deploy, or state mutation.
- Changed-component set scopes, Argo CD/Kubernetes linkage, graph-aware related
  systems, selected knowledge-unit enrichment, and semantic cache hit/miss
  reuse remain future work.

Files changed:

- `src/types/scoped-pack.ts` defines the compact scoped pack report contract.
- `src/domain/scoped-pack.ts` builds scoped packs from inventory inspection and
  renders Markdown handoff output.
- `src/cli/main.ts` adds `pack` parsing and entrypoint execution.
- `test/unit/scoped-pack.test.mjs`,
  `test/integration/cli-report-main.test.mjs`, and
  `test/integration/cli-core-main.test.mjs` cover builder behavior, CLI parser,
  entrypoint JSON/Markdown, and help output.
- `README.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, and
  `skills/infra-configuration/SKILL.md` document the scoped pack surface for
  downstream agents.

Validation:

- `npm run dev -- pack fixtures/sample-workspace --scope charts/payments-api --json` passed.
- `npm run dev -- pack fixtures/sample-workspace --scope infra/payments-api` passed.
- `npm run test:focused -- test/unit/scoped-pack.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-report-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run lint` passed.
- `git diff --check` passed.
- `npm run verify` passed, including lint, structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.

## 2026-05-16 Inventory MVP

Status:

- Added the first compact repo-map surface: `infra-agent inventory`.
- The command derives a read-only `infra-agent.inventory` report from existing
  workspace inspection data. It does not run validators, git diff, Terraform
  plan, Pulumi preview, apply, deploy, or state mutation commands.
- The report includes `mutationAllowed=false`, detected domain tools, included
  targets, environment hints, primary/related file references, validation
  targets, semantic fact counts, knowledge-cache posture, and filtered omitted
  target counts.
- This MVP intentionally summarizes only existing Helm/Pulumi/Terraform
  inspection surfaces. Argo CD/Kubernetes deployment linkage, Terraform module
  interface rollups, Helm dependency/version metadata, semantic-unit hash cache
  status, and richer fact-kind summaries remain future work.

Files changed:

- `src/types/inventory.ts` defines the compact inventory report contract.
- `src/domain/inventory.ts` builds the report from `WorkspaceInspection`.
- `src/cli/main.ts` adds `inventory` parsing and entrypoint execution with
  `--domain`, `--target`, and `--json`.
- `src/cli/output.ts` renders human-readable inventory summaries.
- `test/unit/inventory.test.mjs`,
  `test/integration/cli-report-main.test.mjs`, and
  `test/integration/cli-core-main.test.mjs` cover builder behavior, CLI parser,
  entrypoint JSON, and help output.
- `README.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, and
  `skills/infra-configuration/SKILL.md` document the inventory surface for
  downstream agents.

Validation:

- `npm run test:focused -- test/unit/inventory.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-report-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `git diff --check` passed.
- `npm run lint` passed.
- `npm run verify` passed, including isolated shards, smoke, e2e, coverage, and
  package dry-run.

## 2026-05-16 Changed Context MVP

Status:

- Added the first read-only diff-aware context compiler surface:
  `infra-agent changed`.
- The command accepts either explicit `--file` inputs for non-git callers or a
  git `--base` / optional `--head` comparison. It never runs plan, preview,
  apply, deploy, or state mutation commands.
- The output contract is `infra-agent.changed-context` with
  `mutationAllowed=false`. It reports changed files, affected Helm charts,
  Pulumi projects/stacks, Terraform roots, suggested inspection files,
  suggested validation targets, unmapped files, and heuristic risk hints.
- This MVP intentionally maps only the existing inspection surfaces. Argo CD,
  Kubernetes resource linkage, Terraform local-module reverse dependencies,
  semantic cache invalidation, and plan/preview-enriched impact remain future
  work.

Files changed:

- `src/types/changed-context.ts` defines the compact report contract.
- `src/impact/changed-context.ts` maps changed paths to inspected
  Helm/Pulumi/Terraform components.
- `src/cli/main.ts` adds `changed` parsing, read-only git diff collection, and
  entrypoint execution.
- `src/cli/output.ts` renders text output for the changed-context report.
- `test/unit/changed-context.test.mjs`,
  `test/integration/cli-report-main.test.mjs`, and
  `test/integration/cli-core-main.test.mjs` cover builder behavior, CLI parser,
  entrypoint JSON, and help output.
- `README.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, and
  `skills/infra-configuration/SKILL.md` document `changed` as advisory context
  for downstream agents.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run test:focused -- test/unit/changed-context.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-report-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run verify` passed, including isolated shards, smoke, e2e, coverage, and
  package dry-run.

## 2026-05-15 IaC Context Compiler Direction

Status:

- Product direction has been clarified: `infra-agent` should be an installable
  IaC context compiler CLI and agent-facing skill surface, not a competing
  coding-agent harness.
- Codex, Claude Code, Cursor, OpenCode, human reviewers, and CI/policy engines
  should own file editing, broad shell execution, approvals, rollback, git/PR
  workflows, and final apply/merge decisions.
- `infra-agent` should own high-quality, low-token, cacheable IaC context:
  inventory, compact five-type knowledge units, semantic graph JSON, scoped
  packs, diff-aware changed context, compact provider/chart/package references,
  risk hints, and cache posture.
- The five knowledge-unit types remain the core extraction contract:
  `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.

Plan changes recorded:

- Updated `docs/ROADMAP.md` so the active priority is feature-first IaC context
  compilation with deterministic extraction/retrieval, scoped agent packs,
  diff-aware changed-context, semantic graph, and semantic-unit hash caching.
- Updated root `AGENTS.md` so future agents preserve the clarified product
  boundary: do not reimplement Codex/Claude Code safety workflows, do not grow
  upload-boundary scaffolding without a concrete requirement, and prioritize
  extraction/cache/context quality.
- Tightened `skills/infra-configuration/SKILL.md` so the main skill path is the
  context-compiler workflow: inspect, knowledge extraction/packing/indexing,
  compact JSON/graph reports, structured validation, and caller-owned safety.

Recommended next work:

1. Finish the in-progress planner knowledge selector ranking slice without
   broadening it into a new planner branch.
2. Add a read-only changed-context surface that maps git diff files to affected
   Terraform modules, Pulumi stacks, Helm charts, Argo CD applications when
   present, Kubernetes resources when derivable, suggested inspection files,
   omitted unrelated context, and risk hints.
3. Add semantic-unit cache status/invalidation reporting so agents can see what
   was reused, invalidated, or regenerated.
4. Keep `skills/infra-configuration/SKILL.md` lean over time: installation
   check, inspect/knowledge/pack/changed/validate workflows, JSON handoff
   contract, and references to deeper docs. Avoid putting legacy upload-boundary
   detail in the main skill path.

Validation:

- Direction-only documentation slice.
- `git diff --check` passed.
- `npm run package:check` passed, including the tightened packaged skill.

## 2026-05-15 Agent-2 Reset Management Plan

Status:

- Work has moved to local branch `agent-2` at
  `e390dff Clarify IaC context compiler direction`.
- The uncommitted `agent-1` selector ranking work was preserved as
  `stash@{0}: On agent-1: preserve agent-1 selector ranking work` and must not
  be applied automatically to `agent-2`.
- `agent-2` should prioritize a lean IaC context compiler over the previous
  harness/upload-boundary direction.

Management decision:

- Freeze legacy team-upload and upload-boundary work. Do not add commands,
  contract artifacts, validators, docs, or tests for that path.
- Keep the old implementation only as temporary compatibility ballast while
  the new context compiler path is extracted. New code must not depend on it.
- Prefer deletion or archival in slices once the replacement context-compiler
  surfaces are present and tested.

Agent-2 execution phases:

1. **Seal legacy surface**
   - Remove legacy upload-boundary commands from public help, skill workflow,
     and active docs.
   - Mark `docs/CLAUDE_CODE_AGENT_PATTERNS.md` upload-boundary content as
     legacy guidance, not current architecture.
   - Keep existing legacy code only if needed to avoid an unsafe giant diff.

2. **Define lean public surface**
   - Promote context-compiler commands: `inspect`/inventory, `knowledge
     sources`, `knowledge prefetch`, `knowledge extract`, `knowledge pack`,
     `knowledge index`, `knowledge validate`, `graph`, changed-context, scoped
     pack, and cache status.
   - Treat `agent` and `run` as legacy/experimental surfaces until the core CLI
     is stable.

3. **Extract core modules**
   - Keep and harden Terraform, Pulumi, Helm extraction, five-type knowledge
     units, metadata index, graph JSON, validation summaries, secret redaction,
     and local fingerprint/hash cache.
   - Add Argo CD and Kubernetes discovery only as read-only graph and
     changed-context evidence.

4. **Prune legacy code**
   - Delete or move `team-upload-*`, team backend upload readiness, and related
     CLI/tests/docs after the context-compiler MVP has replacement tests.
   - Keep only artifact validation pieces that directly support local cache,
     repo-curated packs, or read-only public-reference artifact reuse.

5. **Build MVP proof**
   - Prove that `changed`/scoped pack outputs let Codex or Claude Code inspect
     fewer files and consume fewer tokens for a representative Terraform, Helm,
     and Pulumi change.

Immediate next slice:

- Finish sealing the legacy CLI surface by removing upload-boundary commands
  from `infra-agent --help` and active documentation.
- Add the first lightweight tests around the visible command surface if needed.

Completed in this slice:

- Removed legacy team-upload/upload-boundary commands from the default
  `infra-agent --help` output while leaving implementation files in place for
  staged pruning.
- Marked upload-boundary guidance in `docs/CLAUDE_CODE_AGENT_PATTERNS.md` as
  legacy `agent-1` scaffolding instead of current architecture.
- Updated `docs/AGENT_RULES.md`, `docs/ROADMAP.md`, and `package.json` to make
  the active product surface the lean IaC context compiler path.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run dev -- --help` shows only the active context-compiler command
  surface plus legacy `agent`/`run`.
- `npm run package:check` passed.
- `npm run test:structure` passed.
- `npm run test:focused -- test/integration/cli-knowledge-index-main.test.mjs`
  passed.

## 2026-05-15 Planner Knowledge Selector Ranking

Status:

- The preserved `agent-1` selector ranking stash was reviewed and applied to
  `agent-2` because it fits the context-compiler direction: it improves
  compact knowledge-unit selection and explanation quality without adding new
  upload-boundary or harness behavior.

Completed:

- Extended `planner-knowledge-unit-selector` with optional task text, planned
  action hints, validation issues, and resource/module/chart/component/provider/
  package identity hints.
- Added context scoring so selected compact units rank by validation issue
  kind, issue metadata, task action, and identity matches after domain/target/
  stale-source gating has already selected eligible units.
- Added selector reason strings for validation issue matches, identity matches,
  source module/package aliases, and task action hints so future prompt/pack
  surfaces can explain why a unit was selected.
- Preserved deterministic ordering by falling back to original unit order when
  scores tie.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run test:focused -- test/unit/planner-knowledge-unit-selector.test.mjs`
  passed.
- `npm run test:unit` passed.

## 2026-05-15 Legacy Upload Test Prune

Status:

- Removed the legacy `team-upload-*`, team backend readiness, S3-compatible
  backend reference, team publication/readiness, and upload execution boundary
  test suites from unit, integration, contract, and support test directories.
- Updated the remaining core CLI integration tests so default help output is
  locked to the active context compiler surface and explicitly omits legacy
  upload/backend readiness commands.
- Trimmed the packaged `infra-configuration` skill so future agents do not see
  team publication or upload-approval guidance in the main workflow.
- Production source is intentionally still present in this slice; the next
  pruning slice should remove the hidden parser branches, CLI output printers,
  validation dispatch entries, and then the now-uncovered `src/knowledge/team-*`
  upload modules.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run test:structure` passed with 114 test files checked.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-knowledge-args-main.test.mjs`
  passed.
- `npm run test:unit` passed.
- `npm run test:integration` passed.
- `npm run test:contract` passed.
- `npm run smoke` passed.
- `npm run e2e` passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`
  passed.

Remaining risk:

- The npm package still includes the legacy upload/backend source modules
  because this slice only removed the active test surface and packaged skill
  guidance. Treat those modules as sealed compatibility ballast until the next
  deletion slice removes CLI/parser/source dependencies.

## 2026-05-15 Legacy Upload Source Prune

Status:

- The remaining hidden legacy team-upload, team backend, S3-compatible backend,
  team artifact store, publication/readiness, upload approval, and upload
  execution boundary source surface has been removed from `agent-2`.
- Active `knowledge` CLI actions are now limited to `sources`, `prefetch`,
  `extract`, `validate`, `pack`, and `index`.
- `knowledge validate` now validates only active extraction, pack, unit, index,
  and local artifact-manifest contracts. Legacy `infra-agent.knowledge-team-*`
  payloads are no longer accepted by the active dispatcher.
- README and ROADMAP now describe the product as an IaC context compiler and
  mark upload/backend publication work as archived legacy, not current product
  direction.

Files changed:

- `src/cli/main.ts` prunes legacy parser branches and runtime command handlers.
- `src/cli/output.ts` removes legacy team/upload text renderers.
- `src/knowledge/validate.ts` removes legacy validation dispatch entries while
  preserving active storage-policy and artifact-manifest validation.
- Deleted `src/knowledge/team-*`, `src/knowledge/team-s3-compatible-*`, and
  `src/knowledge/team-upload-*` modules that were no longer reachable from the
  active CLI.
- Deleted the remaining legacy unit tests for team artifact roundtrip,
  S3-compatible storage, artifact keys, storage contracts, and descriptor
  validation.
- Updated `README.md` and `docs/ROADMAP.md` so future agents see the active
  context compiler surface instead of removed upload/publication commands.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run test:structure` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-knowledge-args-main.test.mjs`
  passed.
- `npm run test:focused -- test/unit/knowledge-unit-index-validation.test.mjs`
  passed.
- `npm run test:focused -- test/integration/cli-knowledge-index-validation-main.test.mjs`
  passed.
- `npm run test:focused -- test/integration/cli-knowledge-pack-main.test.mjs`
  passed after restoring the active storage-policy validator import.
- `npm run test:unit` passed.
- `npm run test:integration` passed.
- `npm run test:contract` passed.
- `npm run verify` passed, including isolated shards, smoke, e2e, coverage, and
  package dry-run.

Remaining risk:

- Historical handoff/archive documents still mention the old legacy work by
  design. Treat those as history only; active README, ROADMAP, skill, CLI help,
  parser, output, validation, source, tests, and package contents now follow
  the context-compiler direction.
- The `agent` and `run` harness surfaces still exist. They are not expanded in
  this slice, but future manager work should decide whether to keep them as
  compatibility wrappers or reduce them after the `changed`/inventory/cache
  compiler commands are stronger.

## 2026-05-15 Lean Shared Knowledge Artifact Publish

Status:

- Product correction: team/shared knowledge storage is useful for multiplayer
  IaC repos and should remain in scope. The removed part is the oversized
  upload safety-boundary stack, not shared artifact publication itself.
- Added a lean `infra-agent knowledge publish` path for standalone
  `infra-agent.knowledge-units` artifacts. It validates the input artifact,
  writes it by SHA-256 into a workspace-relative shared store directory, and
  updates a `infra-agent.knowledge-unit-registry` JSON file.
- The new publish path is deliberately not the old upload harness. It does not
  create cloud clients, read credentials, perform live backend checks, generate
  upload commands, issue write tokens, create leases, or model runtime upload
  authorization.
- Public-reference and internal-team units are publishable by default.
  Workspace-private and private-run units require `--allow-workspace-private`
  so the operator explicitly opts repo-private knowledge into the shared store.

Files changed:

- `src/knowledge/shared-artifact-publish.ts` owns the small local-file shared
  artifact publisher.
- `src/cli/main.ts` adds `knowledge publish` parsing and execution.
- `src/cli/output.ts` renders the compact publish report.
- `test/integration/cli-knowledge-publish-main.test.mjs` proves a published
  artifact can be discovered through the registry and reused by
  `knowledge extract`.
- `AGENTS.md`, `README.md`, `docs/ROADMAP.md`, and
  `skills/infra-configuration/SKILL.md` now preserve the corrected boundary:
  keep lightweight shared knowledge storage; do not revive legacy upload
  boundary scaffolding.

Validation:

- `git diff --check` passed.
- `npm run lint` passed.
- `npm run test:structure` passed.
- `npm run test:focused -- test/integration/cli-core-main.test.mjs` passed.
- `npm run test:focused -- test/integration/cli-knowledge-args-main.test.mjs`
  passed.
- `npm run test:focused -- test/integration/cli-knowledge-publish-main.test.mjs`
  passed.
- `npm run verify` passed, including isolated shards, smoke, e2e, coverage, and
  package dry-run.

## 2026-05-14 Target-Scoped Registry RAG Phase

Status:

- The active RAG path now treats reviewed `infra-agent.knowledge-units`
  artifacts as reusable public or internal references selected by structured
  metadata, not by raw document recall or provider-specific parser branches.
- The canonical regression anchors remain Terraform HashiCorp AWS provider
  docs, Pulumi AWS package docs, and Helm `kube-prometheus-stack`, but the
  implementation must stay provider/package/chart neutral.
- Planner-facing RAG checks should route through the shared planner knowledge
  unit selector before adding new decision logic. Do not add another round of
  ad hoc planner regex scans across every unit in the pack.

Completed in this phase:

- Added registry artifact selectors for Terraform provider/module, Pulumi
  package/module, Helm chart, and domain/target metadata so generic registries
  can carry multiple public or internal unit artifacts without leaking
  unrelated targets into a task.
- Added multi-target CLI coverage proving source discovery, extraction, and
  packing select only the requested `terraform/app`, `infra/api`, or
  `charts/monitoring` unit artifacts while preserving all five unit families.
- Fixed Pulumi stack targeting so `stack` is treated as a standalone Pulumi
  token and Helm names such as `kube-prometheus-stack` do not trigger Pulumi
  routing.
- Scoped runtime knowledge selection to the chosen target per requested domain
  and preserved selected workflow recipe units in the initial runtime pack.
- Added runtime/planner regressions proving Terraform, Pulumi, and Helm RAG
  facts stay target-scoped and do not include sentinel units from unrelated
  workspace targets.
- Introduced `planner-knowledge-unit-selector` as the shared selector for
  planner RAG signals such as Terraform rename review, Pulumi rename/validation
  review, and Helm upgrade/validation review.
- Routed rule-based planner RAG checks through the shared selector so source
  domain, target path, stale source state, and signal type are enforced in one
  place before planner decisions consume compact units.

Validation:

- Focused selector, planner, CLI, and runtime tests passed during the phase:
  `planner-knowledge-unit-selector`, Terraform/Pulumi/Helm planner RAG tests,
  multi-target knowledge artifact CLI tests, and runtime target-scope tests.
- `npm run lint` passed after selector integration.

Recommended next work:

1. Extend selector ranking with explicit task action, validation issue, and
   resource/module/chart identity reasons so prompt and edit-plan builders can
   explain why a compact unit was selected.
2. Continue feature work on public/internal registry download and local cache
   reuse for reviewed artifacts; keep team-upload boundary expansion out of the
   feature path unless a concrete upload workflow is requested.
3. Add live opt-in extraction smoke around the canonical public targets only
   after the offline target-scoped registry behavior remains stable.

## 2026-05-14 RAG Runtime and Edit-Plan Phase

Status:

- Feature-first RAG remains the active direction. The compact five unit types
  are still the retrieval and planner/edit-plan contract: `fact`, `guidance`,
  `example`, `diagnostic`, and `recipe`.
- This phase moved the canonical public-target and compact-unit work from
  extraction/packing coverage into planner, edit-plan, and runtime behavior.
- Keep the CLI surface focused on user workflows. Avoid adding more internal
  upload or boundary commands unless a concrete user-facing requirement
  justifies them.

Completed in this phase:

- Split the oversized knowledge pack contract/ranking shard so
  `npm run test:structure` passes again and future agents can rely on the
  structure gate.
- Reused canonical public pack fixtures and added prompt regression coverage for
  the Terraform AWS provider, Pulumi AWS, and `kube-prometheus-stack` canonical
  extraction targets.
- Added a shared compact knowledge-unit search text helper so matching behavior
  is consistent across ranking, planner prompt, and edit-plan paths.
- Proved Terraform moved-block RAG with compact `guidance`, `example`,
  `diagnostic`, `recipe`, and `fact` units, including variant coverage.
- Derived Helm and Pulumi config semantics from compact `fact` units.
- Added Helm and Pulumi edit-plan coverage proving compact fact units guide
  generated changes.
- Scoped selected units to current source/target context to prevent RAG target
  drift across unrelated infrastructure targets.
- Split Terraform RAG runtime coverage into a focused integration shard and
  added a target-scope negative test.
- Added tight-budget runtime coverage proving public Terraform Registry-shaped
  docs can extract compact public-reference units that drive a Terraform
  moved-block edit without leaking raw docs into runtime facts or adding
  provider-specific edit-plan branches.
- Tightened Pulumi rename handling so compact alias/import/state-repair units
  gate unsafe rename/config edits and stale Pulumi diagnostics do not hijack
  unrelated Helm/Terraform failures.
- Tightened Helm diagnostic matching so selected diagnostic units must match
  the current validation issue kind or metadata identity before they stop the
  planner for Helm repair review.
- Added Helm upgrade/value-migration recipe gating so compact recipe units ask
  for chart version, values scope, and render/lint confirmation before bounded
  values edits.
- Added RAG-aware validation command selection for Helm, Terraform, and Pulumi:
  selected compact units can now prioritize `helm template`/`helm lint`,
  `terraform fmt`/`terraform validate`/`terraform plan`, and matching-stack
  `pulumi preview` commands before the six-command cap is applied.
- Normalized Pulumi CLI stack refs such as `org/project/dev` to the local
  `Pulumi.dev.yaml` stack name for missing-config repair, while preserving
  dotted local stack names such as `tenant-shared.non-prod`.

Validation:

- Focused unit and integration tests for the above slices passed during the
  phase.
- `npm run test:structure` passes after splitting the oversized
  `knowledge-pack-ranking` coverage.
- `test/integration/agent-runtime-execution.test.mjs` was reduced to 836 lines.
- `test/integration/agent-runtime-terraform-rag.test.mjs` now carries compact,
  registry-backed, public-doc, and target-scope runtime RAG cases.
- `test/unit/select-validation-commands-rag.test.mjs` carries focused
  cross-domain validation selector coverage for compact Helm, Terraform, and
  Pulumi units.

Recommended next work:

1. Continue extraction/runtime RAG work around the five unit types, with
   emphasis on behavior changes under tight budgets instead of raw-doc recall.
2. Add more end-to-end run coverage showing public/internal unit registries
   choose the right compact units for multi-target repositories before planner
   handoff.
3. Keep safety boundaries at Claude Code style/weight and avoid internal
   boundary CLI expansion unless justified by a user workflow.

## 2026-05-12 Priority Reset: Feature-First RAG

Status:

- The product direction has been reset toward functional infrastructure RAG
  behavior. Future development should stop expanding the fine-grained
  `knowledge team-upload-*` dry-run boundary chain unless a concrete team-upload
  product requirement needs it.
- Keep Claude Code style safety principles, but keep them lightweight:
  permission state, dry-run/execution separation, explicit approval before
  mutation, compact handoff, and secret redaction.

Active implementation focus:

- Extract and analyze the five compact JSON knowledge unit types: `fact`,
  `guidance`, `example`, `diagnostic`, and `recipe`.
- Improve deterministic retrieval and ranking by domain, version, provider or
  package, resource/module/chart/component identity, target path, validation
  issue, planned action, risk, freshness, and privacy scope.
- Feed selected units into planner prompts and edit-plan builders so RAG changes
  real Terraform, Pulumi, and Helm behavior under tight token budgets.
- Prioritize read-only artifact discovery/download for reviewed
  `infra-agent.knowledge-units` payloads over any remote upload execution.

Recommended next slices:

1. Add more edit-plan behavior coverage proving Terraform rename guidance
   creates moved blocks only from explicit old/new resource addresses and
   selected compact units under tight unit budgets.
2. Add Pulumi alias/stack-config recipe units and prove they affect planner
   handoff or edit-plan selection without exposing raw examples.
3. Add read-only registry artifact discovery for prebuilt unit artifacts,
   leaving real upload/write execution out of scope.

## 2026-05-13 Current Core Path: Metadata Knowledge Index

Status:

- The current core path is feature-first, deterministic metadata RAG for
  Terraform, Pulumi, and Helm public/internal knowledge. Future work should
  route through the canonical public target resolver, knowledge unit metadata
  index, compact `unitIndex` summaries, and `knowledge index` /
  `knowledge validate` checks before adding any new retrieval surface.
- This path is explicitly not Vector DB work and not provider-specific parser
  work. Public and internal units should be found and ranked by structured
  metadata: domain, provider/package/chart, version, resource/module/component,
  target path, validation issue, planned action, risk, freshness, privacy scope,
  and source identity.
- Do not expand the `knowledge team-upload-*` boundary chain for this feature
  work. Team-upload remains a maintained dry-run safety scaffold, while the
  active RAG path is read-only source discovery, extraction/packing, indexing,
  validation, and planner/edit-plan consumption.

Completed slice notes:

- Added a canonical public target resolver and target summaries so Terraform,
  Pulumi, and Helm public examples resolve through one reusable public-reference
  source model instead of ad hoc target constants or parser branches.
- Added knowledge unit metadata index support for compact
  `infra-agent.knowledge-units` artifacts. The index carries source-linked unit
  metadata for deterministic lookup without raw docs, raw examples, or a Vector
  DB.
- Added budget summary `unitIndex` output so compact pack/result summaries can
  expose selected and omitted unit posture under tight unit budgets.
- Added the `knowledge index` CLI surface to build the metadata index after
  extraction/packing and before validation or planner handoff.
- Added index validation through the `knowledge validate` dispatcher so saved
  index artifacts are contract-checked before reuse.

Recommended workflow:

1. `infra-agent knowledge sources <workspace> ...`
2. `infra-agent knowledge prefetch <workspace> ...`
3. `infra-agent knowledge extract <workspace> ...` and/or
   `infra-agent knowledge pack <workspace> ...`
4. `infra-agent knowledge index ...`
5. `infra-agent knowledge validate <artifact.json> [--workspace <workspace>]`

Canonical regression anchors:

- Terraform: HashiCorp AWS provider docs,
  `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
- Pulumi: `@pulumi/aws` / Pulumi AWS Registry docs.
- Helm: `kube-prometheus-stack` public chart docs.

These examples remain generic regression anchors only. Keep the resolver and
extractors provider/package/chart neutral; do not add AWS-specific,
`@pulumi/aws`-specific, or `kube-prometheus-stack`-specific parsing.

Remaining risks:

- Multi-source pack source-level omitted distribution is still an estimate.
  Treat `unitIndex` omitted counts as budget posture, not exhaustive proof of
  every omitted source/unit relationship.
- Live network smoke remains opt-in and must stay behind
  `INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1`.
- `npm run test:structure` still has existing oversized shard risk in the
  legacy shards already noted below; avoid making those shards larger.

## 2026-05-13 Canonical Public Extraction Targets

Status:

- The first canonical public extraction targets are now represented by a
  reusable target API and regression coverage:
  - Terraform: HashiCorp AWS provider docs at
    `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
  - Pulumi: Pulumi AWS package/provider docs.
  - Helm: `kube-prometheus-stack`.
- These targets are the canonical v0 network extraction examples for provider,
  package, and chart knowledge. Future agents should not replace them with
  smaller or unrelated examples just to make tests easier, and should not add
  AWS-specific or `kube-prometheus-stack` parser branches. They are samples for
  generic public-reference extraction behavior.

Testing constraints:

- Keep live network extraction tests opt-in by default when network access is
  unavailable. Normal unit tests use cached fixtures generated from these same
  targets.
- Do not assert brittle full-document golden output from `latest` public docs.
  Assert source identity, normalized cache/source metadata, five-unit JSON
  schema shape, redaction, and stable target-specific signals instead.
- Extracted data from these targets must still normalize into the core
  `fact`, `guidance`, `example`, `diagnostic`, and `recipe` units and should
  remain compact enough for deterministic RAG packing.

Completed slice notes:

- Added generic public extraction target builders in
  `src/knowledge/public-extraction-targets.ts`, with canonical target constants
  for Terraform provider docs, Pulumi package docs, and Helm chart docs. The
  builders validate provider/package/chart identity, safe versions, target
  paths, and secret-free public URLs, so future public targets can reuse the
  same source model instead of adding provider- or chart-specific code.
- Added cached canonical fixture regression coverage in
  `test/support/canonical-public-knowledge-fixtures.mjs` and
  `test/unit/knowledge-canonical-public-extraction.test.mjs`. The fixtures
  prove the three canonical samples normalize through existing generic
  markdown/fact/unit extraction into all five unit types: `fact`, `guidance`,
  `example`, `diagnostic`, and `recipe`, while preserving public-reference
  source links and avoiding raw content or secret-like output.
- Added canonical public pack/RAG context regression coverage in
  `test/unit/knowledge-canonical-public-pack.test.mjs`, supported by compact
  source identity propagation in `src/knowledge/pack.ts` and
  `src/knowledge/fact-budget.ts`. The pack checks prove public-reference units
  stay bounded, source-identifiable, and usable as generic RAG context without
  leaking raw canonical docs.
- Added an offline-safe, opt-in live integration smoke in
  `test/integration/cli-knowledge-network-extraction-main.test.mjs`. By
  default it asserts canonical target identity only. With
  `INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1`, it fetches the canonical targets into a
  temp cache and validates fetch/cache shape, normalization metadata or content
  type, redaction/no raw HTML, stable identity signals, and schema-valid unit
  sets when extraction emits units. Normal CI remains no-network.
- Wired canonical public targets into bounded explicit source discovery via
  `src/knowledge/prefetch.ts` when a caller requests the canonical public
  target paths. This keeps live refresh deliberate and out of the agent loop.

Why the design is generic:

- Target construction is provider/package/chart identity based, with reusable
  URL/path/version validation. The canonical AWS and `kube-prometheus-stack`
  samples are regression anchors only; extraction still flows through the same
  markdown, fact, unit, pack, and budget paths used by other public or internal
  sources.

Remaining gaps:

- The canonical target set is intentionally small. Broader provider, package,
  and chart catalogs still need source-selection policy and fixture generation
  before expansion.
- Live smoke validates fetch/cache/extraction shape, not upstream document
  completeness. It should remain non-brittle against public page drift.
- Planner/edit-plan behavior still needs follow-up proving these canonical
  public-reference units change real Terraform, Pulumi, and Helm decisions
  under tight pack budgets.

Validation so far:

- Exact node tests for `knowledge-public-extraction-targets`,
  `knowledge-canonical-public-extraction`,
  `knowledge-canonical-public-pack`, and
  `cli-knowledge-network-extraction-main` passed.
- `npm run lint` passed.
- `npm run test:unit` passed.
- `npm run test:structure` has only pre-existing oversized shard risk in
  `test/integration/agent-runtime-execution.test.mjs` and
  `test/unit/knowledge-pack-ranking.test.mjs`.

Next recommended step:

- Add a planner or edit-plan regression that consumes a compact pack from one
  canonical public target and proves the selected `fact`, `guidance`,
  `example`, `diagnostic`, or `recipe` units alter a bounded infrastructure
  decision without loading raw docs or expanding `knowledge team-upload-*`
  boundaries.

## 2026-05-12 Completed Fact-Derived Five-Type Unit Projection

Status:

- Ordinary extracted fact sets now project beyond `fact`, `guidance`, and
  `example` units. Provider identity facts, replacement-sensitive facts,
  required provider/module/chart/component inputs, and domain evidence now
  generate compact `guidance`, `diagnostic`, and `recipe` units without loading
  raw source documents into packs.
- This keeps the five JSON unit model central for public and internal RAG while
  preserving the existing cache/source architecture and avoiding any new
  `knowledge team-upload-*` boundary expansion.

Implemented checkpoints:

- Added required-input guidance for provider arguments, Terraform module
  inputs, Helm chart values, nested blocks, and Pulumi component inputs.
- Added provider diagnostic units for identity and replacement-sensitive facts,
  plus Helm diagnostics for required chart values.
- Added domain recipe projection for Terraform identity-safe edits, Helm
  values/render validation, and Pulumi stack/resource change review.
- Updated pack compatibility tests to reflect that `unitCount` can now exceed
  legacy `factCount` for ordinary sources.

Validation completed:

- `npm run lint`
- `npm run test:unit -- knowledge-unit-extraction knowledge-pack-unit-compatibility knowledge-pack-ranking`

Next recommended implementation steps:

1. Add content-aware markdown unit extraction for explicit Examples,
   Troubleshooting, Upgrade/Migration, and Best Practices sections.
2. Add Helm and Pulumi source fixtures proving docs can emit all five unit
   types under tight unit budgets.
3. Feed the new diagnostic/recipe units into planner and edit-plan heuristics
   where they improve Terraform, Pulumi, and Helm behavior.

## 2026-05-12 Completed Markdown Section Unit Extraction

Status:

- Cached markdown/plain-text sources can now emit unit-native JSON directly
  from explicit docs sections. Supported source kinds are Terraform registry
  docs, Pulumi docs, Helm docs, chart docs, repo examples, and module README
  sources.
- Extraction is intentionally conservative: examples require code blocks,
  recipes require explicit list steps, diagnostics require troubleshooting or
  error headings plus error-like text, and guidance requires best-practice,
  note, important, limitation, caveat, or constraint headings.

Implemented checkpoints:

- Added a `markdown-units` extractor for `example`, `guidance`, `recipe`, and
  `diagnostic` units.
- Wired markdown unit extraction into the ordinary knowledge extraction path
  before `KnowledgeUnitSet` validation.
- Kept raw source docs out of packs by compacting snippets, summaries, and
  steps and skipping secret-like content.
- Added unit coverage proving a Helm chart docs source can produce all five
  unit types after combining fact-derived and markdown-derived units.

Validation completed:

- `npm run lint`
- `npm run test:unit -- knowledge-unit-extraction knowledge-helm-chart-docs-extraction knowledge-pulumi-docs-extraction`

Next recommended implementation steps:

1. Add runtime or CLI integration coverage proving markdown-derived units enter
   `knowledge pack` / agent context under tight unit budgets.
2. Add focused Pulumi docs markdown fixtures for example and troubleshooting
   sections.
3. Use diagnostic/recipe units in edit-plan routing where they can reduce
   speculative infra changes.

## 2026-05-12 Completed CLI Extraction Coverage For Markdown Units

Status:

- `knowledge extract --json` now has integration coverage proving a cached Helm
  chart docs markdown source emits `fact`, `guidance`, `example`,
  `diagnostic`, and `recipe` units through the normal CLI path.
- The same test keeps the raw-content boundary intact by asserting extracted
  output does not include the source markdown body or a `content` field.

Validation completed:

- `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`
- `npm run lint`

Next recommended implementation steps:

1. Add `knowledge pack` coverage under a tight `maxUnits` budget for
   markdown-derived units.
2. Add Pulumi docs markdown fixtures for explicit examples and troubleshooting.
3. Use markdown-derived diagnostics/recipes in planner routing or edit-plan
   confidence checks.

## 2026-05-12 Completed Pack Coverage For Markdown Units

Status:

- `knowledge pack --json` now has integration coverage proving cached Helm
  chart docs markdown units flow through packing, not just extraction.
- The pack test verifies `fact`, `guidance`, `example`, `diagnostic`, and
  `recipe` units are present while raw source markdown remains excluded.

Validation completed:

- `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`
- `npm run lint`

Next recommended implementation steps:

1. Add Pulumi docs markdown fixtures for explicit examples and troubleshooting.
2. Tune tight-budget ranking so task-relevant examples can survive small
   `maxUnits` values when concrete edit shape is needed.
3. Use markdown-derived diagnostics/recipes in planner routing or edit-plan
   confidence checks.

## 2026-05-12 Completed Pulumi Markdown Unit Coverage

Status:

- Pulumi resource docs now have unit coverage proving cached markdown can
  produce the five-unit model when docs include inputs, example usage,
  important notes, migration workflow steps, and troubleshooting signatures.
- This locks the expected Pulumi-specific behavior for `typescript` examples,
  Pulumi diagnostics, and migration recipes that require approval.

Validation completed:

- `npm run lint`
- `npm run test:unit -- knowledge-unit-extraction knowledge-pulumi-docs-extraction`

Next recommended implementation steps:

1. Tune tight-budget ranking so task-relevant examples can survive small
   `maxUnits` values when concrete edit shape is needed.
2. Use Pulumi diagnostic/recipe units to steer alias/import/state review and
   stack config edit-plan routing.
3. Use markdown-derived diagnostics/recipes in planner routing or edit-plan
   confidence checks.

## 2026-05-12 Completed Secret-Safe Markdown Unit Regression

Status:

- Markdown-derived `guidance`, `example`, `diagnostic`, and `recipe` units now
  have regression coverage for secret-like sections. The extractor skips
  sensitive markdown-derived units instead of spending token budget on unsafe or
  low-quality context.
- Non-secret structured facts from the same source still survive extraction, so
  the RAG path keeps useful chart/provider/module facts while dropping unsafe
  prose and snippets.

Validation completed:

- `npm run lint`
- `npm run test:unit -- knowledge-unit-extraction`

Next recommended implementation steps:

1. Use Pulumi diagnostic/recipe units to steer alias/import/state review and
   stack config edit-plan routing.
2. Use Helm and Terraform diagnostic/recipe units in edit-plan confidence checks
   before adding more knowledge publication surfaces.
3. Add pack/agent integration coverage for concrete example and recipe units
   changing planner or edit-plan behavior.

## 2026-05-12 Completed Tight-Budget Unit Selection

Status:

- Knowledge pack and compact budget summaries now use a budget-aware unit
  selector instead of raw rank-and-slice behavior.
- The selector still ranks local required facts and diagnostics first. When
  `maxUnits >= 4`, it preserves one non-stale `recipe` and one non-stale
  `example` by replacing only lower-priority, non-protected guidance or optional
  fact units.
- This makes the five-unit RAG model more useful under tight token budgets:
  planners can keep concrete edit shape (`example`) and workflow sequence
  (`recipe`) without sacrificing required inputs or validation diagnostics.

Modified core files:

- `src/knowledge/unit-ranking.ts`
- `src/knowledge/pack.ts`
- `src/knowledge/fact-budget.ts`
- `test/unit/knowledge-unit-budget-selection.test.mjs`

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-unit-budget-selection.test.mjs`
- `npm run lint`
- `npm run test:unit -- knowledge-pack-unit-compatibility`

Next recommended implementation steps:

1. Use Helm and Terraform diagnostic/recipe units in edit-plan confidence checks
   before adding more knowledge publication surfaces.
2. Add pack/agent integration coverage for concrete example and recipe units
   changing planner or edit-plan behavior.
3. Extend Pulumi alias/import review from clarification into explicit reviewed
   alias/import plan artifacts when that product surface is ready.

## 2026-05-12 Completed Pulumi Recipe Gate For Stack Config Edits

Status:

- Pulumi rename/alias knowledge now gates bounded Pulumi stack-config edits
  before execution. If a task asks for a Pulumi rename-like change and compact
  knowledge units mention aliases, logical names, import/state, or stack config
  review, the rule-based planner asks for clarification before applying a
  `pulumi-stack-config` edit plan.
- This makes recipe/diagnostic RAG behavior functional, not just present in the
  prompt. Recipe-only curated knowledge can now stop a speculative stack config
  write when the task may actually be a logical resource rename.

Modified core files:

- `src/agent/rule-based-planner.ts`
- `test/unit/planner-rag-units.test.mjs`

Validation completed:

- `node --experimental-strip-types test/unit/planner-rag-units.test.mjs`
- `npm run lint`

Next recommended implementation steps:

1. Use Helm diagnostic/recipe units in edit-plan confidence checks
   before adding more knowledge publication surfaces.
2. Add pack/agent integration coverage for concrete example and recipe units
   changing planner or edit-plan behavior.
3. Extend Pulumi alias/import review from clarification into explicit reviewed
   alias/import plan artifacts when that product surface is ready.

## 2026-05-12 Completed Pulumi Validation Diagnostic Review Stop

Status:

- Pulumi validation diagnostic units now affect the rule-based planner's
  validation-blocked stop behavior. When validation fails and the selected
  diagnostic unit identifies alias/import/state, CloudFront alias, DNS cutover,
  or logical Pulumi rename review, the planner returns a Pulumi-specific
  `validation-blocked` stop with `actionFamily: "pulumi-validation"`.
- This remains review-only. It does not introduce Pulumi alias/import/state
  mutation semantics, which should stay out of scope until a separate reviewed
  product surface exists.

Modified core files:

- `src/agent/rule-based-planner.ts`
- `test/unit/planner-rag-units.test.mjs`

Validation completed:

- `node --experimental-strip-types test/unit/planner-rag-units.test.mjs`
- `npm run lint`

Next recommended implementation steps:

1. Add pack/agent integration coverage for concrete example and recipe units
   changing planner or edit-plan behavior.
2. Extend Pulumi alias/import review from clarification into explicit reviewed
   alias/import plan artifacts when that product surface is ready.
3. Add broader end-to-end fixtures proving public chart docs diagnostics steer
   Helm validation-blocked output after real extraction and packing.

## 2026-05-12 Completed Helm Validation Diagnostic Review Stop

Status:

- Helm validation diagnostic units now affect the rule-based planner's
  validation-blocked stop behavior. When validation fails and a selected Helm
  diagnostic unit mentions chart values, required values, `service.port`, render
  or template failure, the planner returns a Helm-specific `validation-blocked`
  stop with `actionFamily: "helm-validation"`.
- Existing repair behavior is still preferred when a bounded Helm repair edit
  plan is available. This slice improves the no-repair review path and does not
  add new mutation behavior.

Modified core files:

- `src/agent/rule-based-planner.ts`
- `test/unit/planner-rag-units.test.mjs`

Validation completed:

- `node --experimental-strip-types test/unit/planner-rag-units.test.mjs`
- `npm run lint`

Next recommended implementation steps:

1. Add pack/agent integration coverage for concrete example and recipe units
   changing planner or edit-plan behavior.
2. Extend Pulumi alias/import review from clarification into explicit reviewed
   alias/import plan artifacts when that product surface is ready.
3. Add broader end-to-end fixtures proving public chart docs diagnostics steer
   Helm validation-blocked output after real extraction and packing.

## 2026-05-12 Completed Read-Only Unit Artifact Registries

Status:

- Workspaces can now configure read-only
  `knowledgeSources.unitArtifactRegistries` entries. A registry can be a safe
  workspace-relative JSON path or a secret-free URL.
- Registry JSON uses `kind: "infra-agent.knowledge-unit-registry"`,
  `schemaVersion: 1`, `mutationAllowed: false`, and entries that point at
  prebuilt `infra-agent.knowledge-units` artifacts.
- Discovery expands registry entries into ordinary `knowledge-unit-artifact`
  sources for the requested domain and target. Extraction, ranking, and packing
  then use the existing artifact path.

Implemented checkpoints:

- Added config types for unit artifact registries.
- Added `knowledge-unit-registry` as a source kind for registry cache identity.
- Added shared safe source config validators for domain, local path, URL, and
  target matching.
- Added a registry expansion module that reads local registries directly and
  reads URL registries from the prefetch cache.
- Added two-phase prefetch: fetch URL registry first, then fetch discovered URL
  artifacts through the same cache path.
- Added unit and CLI integration coverage for registry-backed artifact
  discovery.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-unit-artifact-sources.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-unit-artifacts-main.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add provider/Helm fixture registries that include all five unit types under
   tight pack budgets.
2. Continue Pulumi alias/stack-config edit-plan behavior from compact units.
3. Add registry metadata filters for provider/package/chart/resource identity.

## 2026-05-12 Completed Registry Artifact Hash Checks

Status:

- Direct `knowledgeSources.unitArtifacts` entries can carry
  `artifactContentHash`, and registry entries can carry `contentHash`.
- The hash is folded into knowledge cache identity and persisted on the
  expanded `knowledge-unit-artifact` source.
- Extraction rejects local or cached artifact bytes when the configured hash no
  longer matches, preventing stale or drifted unit payloads from reaching the
  planner.

Implemented checkpoints:

- Added `artifactContentHash` to the `KnowledgeSource` shape and direct unit
  artifact config type.
- Carried registry `contentHash` into expanded artifact sources.
- Included artifact hash in normalized cache IDs.
- Added extraction-time hash mismatch rejection before parsing
  `infra-agent.knowledge-units`.
- Extended unit coverage for registry hash drift rejection and cache ID
  sensitivity.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-unit-artifact-sources.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add provider/Helm fixture registries that include all five unit types under
   tight pack budgets.
2. Continue Pulumi alias/stack-config edit-plan behavior from compact units.
3. Add registry metadata filters for provider/package/chart/resource identity.

## 2026-05-12 Completed Registry-Backed Runtime RAG Execution Coverage

Status:

- Agent runtime now has integration coverage proving registry-backed prebuilt
  units are not just visible to `knowledge` CLI commands. The rule-based agent
  can load a registry-discovered `knowledge-unit-artifact`, select the compact
  Terraform rename guidance, and apply a Terraform `moved` block from explicit
  old/new resource addresses.

Implemented checkpoints:

- Added a fixture workspace that declares only
  `knowledgeSources.unitArtifactRegistries`, not direct `unitArtifacts`.
- Added a registry JSON pointing at a local prebuilt
  `infra-agent.knowledge-units` artifact.
- Verified the runtime pack reports zero facts, selected compact units, and a
  `knowledge-unit-artifact` source.
- Verified `terraform/app/moved.tf` is written through the existing bounded
  edit-plan execution path.

Validation completed:

- `node --experimental-strip-types test/integration/agent-runtime-execution.test.mjs`
- `npm run lint`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add provider/Helm fixture registries that include all five unit types under
   tight pack budgets.
2. Continue Pulumi alias/stack-config edit-plan behavior from compact units.
3. Add registry metadata filters for provider/package/chart/resource identity.

## 2026-05-12 Completed Terraform Rename Unit Planner Behavior

Status:

- Unit-only knowledge packs now enter the agent runtime. Previously,
  `retrieveInitialKnowledgeFacts` returned `null` when a pack had zero facts
  even if it contained useful `guidance`, `diagnostic`, or `recipe` units.
- The rule-based planner now uses Terraform rename/moved-block units as real
  planner input. For Terraform rename tasks with selected rename units and no
  safe bounded edit plan, it asks for exact old/new resource addresses and
  moved-block review details instead of falling through to generic
  `no-safe-action`.

Implemented checkpoints:

- Changed runtime knowledge loading to accept packs with either facts or units.
- Added Terraform rename unit detection over compact `guidance`, `diagnostic`,
  and `recipe` units without relying on raw examples.
- Added planner guidance for LLM mode so Terraform rename/moved-block units
  steer the model away from speculative replacement edits.
- Added focused tests for unit-only runtime loading and Terraform rename unit
  planner behavior.

Validation completed:

- `node --experimental-strip-types test/unit/planner-rag-units.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run smoke`
- `npm run e2e`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Add Pulumi alias/stack-config recipe behavior so Pulumi rename units affect
   planner handoff under tight budgets.
2. Add an edit-plan level review artifact for Terraform moved-block candidates
   once old/new resource addresses are known.
3. Add read-only registry artifact discovery for prebuilt unit artifacts.

## 2026-05-12 Completed Pulumi Alias Unit Planner Behavior

Status:

- The rule-based planner now uses Pulumi rename, alias, import/state, and stack
  config units as functional RAG input. For Pulumi rename tasks with selected
  alias/stack-config units and no safe bounded edit plan, it asks for old/new
  resource identity and stack details before proposing replacement edits.

Implemented checkpoints:

- Added Pulumi rename unit detection over compact `guidance`, `diagnostic`, and
  `recipe` units.
- Added Pulumi-specific planner questions for logical rename identity, aliases,
  and approved `pulumi_config_set` versus alias/import review.
- Added LLM prompt guidance so compact Pulumi units steer model planning away
  from speculative replacement edits.
- Extended `test/unit/planner-rag-units.test.mjs` with a Pulumi alias curated
  unit workspace.

Validation completed:

- `node --experimental-strip-types test/unit/planner-rag-units.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run smoke`
- `git diff --check`

Next recommended implementation steps:

1. Add a Pulumi alias review artifact once old/new Pulumi resource identity is
   known.
2. Add read-only registry artifact discovery for prebuilt unit artifacts.
3. Wire `infra-agent.knowledge-units` into the public `knowledge validate`
   dispatcher.

## 2026-05-12 Completed Terraform Moved-Block Edit Plan

Status:

- Terraform rename/moved-block RAG units now affect implementation, not just
  clarification. When a task includes explicit old/new Terraform resource
  addresses and compact knowledge units indicate moved-block guidance, the
  edit-plan builder creates or appends a bounded `moved.tf` plan.

Implemented checkpoints:

- Added `terraform-moved-block` as an edit-plan kind.
- Added a Terraform moved-block builder that requires selected RAG unit
  evidence and explicit address pairs such as
  `from aws_s3_bucket.old to aws_s3_bucket.api`.
- The builder targets `<terraform-root>/moved.tf`, appends to observed existing
  content, and skips duplicate moved blocks.
- Updated Terraform edit-plan priority so explicit moved-block rename work is
  evaluated before generic tfvars plans.
- Updated generic Terraform-only edit policy and domain capability output to
  include the new bounded edit kind.
- Added agent-loop integration coverage proving compact rename units plus
  explicit old/new addresses write `terraform/app/moved.tf` through the normal
  rule-based planner path.

Design notes:

- The builder treats examples as detection evidence only. It does not copy raw
  example snippets into planner output or write content.
- No extra upload or boundary machinery was added. This is a direct functional
  RAG-to-edit-plan slice.
- Address parsing is deliberately strict enough to avoid inventing state moves:
  no explicit old/new Terraform resource addresses means no moved-block plan.

Validation completed:

- `node --experimental-strip-types test/unit/terraform-edit-plan-routing.test.mjs`
- `node --experimental-strip-types test/unit/workspace-edit-policy.test.mjs`
- `node --experimental-strip-types test/unit/workspace-profile-targeting.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add Pulumi alias review/edit-plan behavior once old/new Pulumi resource
   identity is known.
2. Add read-only registry artifact discovery for prebuilt public/internal unit
   artifacts.
3. Use URL-backed prebuilt unit artifacts in agent-loop tests for public
   provider and Helm metadata knowledge.

## 2026-05-12 Completed URL-Backed Unit Artifact Read Path

Status:

- `knowledgeSources.unitArtifacts` can now point at either a safe
  workspace-relative `path` or a secret-free `url`. URL artifacts use the
  existing read-only `knowledge prefetch` cache path before extraction and
  packing consume them.

Implemented checkpoints:

- Extended the workspace config type for unit artifacts with optional `url`.
- Updated knowledge source discovery to accept exactly one of `path` or `url`
  for each unit artifact.
- Added URL safety checks: only `http`/`https`, no credentials, no query, no
  fragment, and no secret-like path terms.
- Reused the existing cache/prefetch/extract/pack path; no upload or remote
  write behavior was added.
- Added unit coverage proving URL artifacts report `requiresFetch=true`, fetch
  into the cache with an injected fetcher, then extract and pack as compact
  units.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-unit-artifact-sources.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add CLI integration coverage for URL-backed unit artifacts.
2. Add Pulumi alias review/edit-plan behavior once old/new Pulumi resource
   identity is known.
3. Add read-only registry artifact discovery for S3-compatible references
   without expanding upload execution boundaries.

## 2026-05-12 Completed CLI Coverage for Prebuilt Unit Artifacts

Status:

- Added integration coverage proving `knowledgeSources.unitArtifacts` works
  through the user-facing `knowledge sources`, `knowledge extract`, and
  `knowledge pack` commands.

Implemented checkpoints:

- The test workspace declares a safe local `infra-agent.knowledge-units`
  artifact for a Terraform target.
- `knowledge sources --json` reports the artifact as a local
  `knowledge-unit-artifact` source with workspace-private storage posture.
- `knowledge extract --json` reports zero facts and two compact units from the
  artifact source.
- `knowledge pack --max-units 1 --json` ranks the high-confidence Terraform
  rename guidance ahead of the example and omits the raw moved-block snippet.

Validation completed:

- `node --experimental-strip-types test/integration/cli-knowledge-unit-artifacts-main.test.mjs`
- `npm run lint`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Add S3-compatible read-only artifact reference discovery over the same
   `infra-agent.knowledge-units` shape.
2. Add planner behavior coverage for prebuilt rename units.

## 2026-05-12 Completed Unit Counts in Team Artifact Metadata

Status:

- Team artifact descriptors, index entries, publication plans, and publication
  readiness reports now carry optional `artifact.unitCount` metadata when the
  source knowledge pack exposes unit totals.
- Validation reports for those compact team artifacts now preserve optional
  `unitCount`, so future registry/S3 discovery can audit unit volume without
  reading full artifact payloads.

Implemented checkpoints:

- Added optional `unitCount` to compact artifact metadata in
  `src/knowledge/team-artifact-store.ts`.
- Generated descriptors, index entries, publication plans, and readiness
  reports propagate `manifest.artifact.unitCount`.
- Descriptor, manifest, index, and stored-pack matching now detect unit-count
  drift when unit metadata is present.
- Team artifact validation accepts optional unit counts and reports them in
  `KnowledgeValidationReport`.
- CLI text summaries for publication plan/readiness now show unit totals beside
  fact totals.

Design notes:

- `unitCount` remains optional for compatibility with older fact-only artifacts,
  but newly generated unit-aware artifacts propagate it consistently.
- This prepares the next read-only discovery slice: an index entry can summarize
  whether an artifact is relevant and appropriately sized before downloading or
  unpacking the full JSON payload.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-artifact-index-readiness.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Add a read-only artifact reference discovery report over safe
   S3-compatible registry references.
2. Extend reference-registry validation with artifact references while keeping
   endpoint, bucket, and credential values out of reports.
3. Add CLI integration for prebuilt `knowledgeSources.unitArtifacts`.

## 2026-05-12 Completed Prebuilt Knowledge Unit Artifact Sources

Status:

- Added a local read-only path for prebuilt `infra-agent.knowledge-units`
  artifacts through `infra-agent.config.json` under
  `knowledgeSources.unitArtifacts`.
- These artifacts now appear in `knowledge sources`, extract to zero-fact unit
  sets, and enter `knowledge pack` through the same deterministic ranking and
  budget path as curated and generated units.

Implemented checkpoints:

- Added source kind `knowledge-unit-artifact` across knowledge source
  contracts, validation, planner result contracts, and fact/unit ranking.
- Added `WorkspaceKnowledgeUnitArtifactSourceConfig` with `domain`,
  optional `targetPath`, safe local `path`, optional `name`, and optional
  `version`.
- Source discovery now ignores unsafe artifact paths and registers safe local
  artifact files as local `knowledge-unit-artifact` candidates.
- Added `src/knowledge/prebuilt-units.ts` to validate an
  `infra-agent.knowledge-units` payload, then rebase unit source references to
  the configured artifact file so pack source accounting, fingerprints, and
  storage policy stay tied to the local read-only artifact.
- Updated README, Architecture, Roadmap, Agent Rules, and this handoff so
  future agents treat prebuilt unit artifacts as a core bridge toward
  S3-compatible read-only reference discovery.

Design notes:

- `curatedUnits` is the authoring format for local/internal knowledge.
  `unitArtifacts` is the reviewed generated artifact format for already
  extracted compact units.
- This is intentionally local-only for now. It establishes the artifact shape
  and planner behavior before real S3-compatible download/client work, keeping
  upload and remote mutation behind the existing approval boundary.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-unit-artifact-sources.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Add CLI integration coverage for `knowledgeSources.unitArtifacts`.
2. Add S3-compatible read-only reference metadata that resolves to the same
   `infra-agent.knowledge-units` artifact shape without reading credentials in
   planning commands.
3. Add planner behavior coverage proving prebuilt Terraform/Pulumi rename units
   change review choices under tight budgets.

## 2026-05-12 Completed CLI Coverage for Internal Curated Units

Status:

- Added integration coverage for the user-facing `knowledge sources`,
  `knowledge extract`, and `knowledge pack` CLI flow when a workspace declares
  local internal curated unit sources.
- The coverage proves curated unit sources are visible as local
  `internal-knowledge` sources, extract to zero-fact unit sets, and pack into
  compact bounded unit context without leaking raw local example snippets.

Implemented checkpoints:

- Added a temporary Terraform workspace fixture with
  `knowledgeSources.curatedUnits[]` pointing at a safe workspace-relative
  curated unit file.
- Verified `knowledge sources --json` reports the configured source as
  `requiresFetch=false`, `cacheStatus=local`, and
  `storagePolicy.scope=workspace-private`.
- Verified `knowledge extract --json` reports `factCount=0`, `unitCount=3`,
  and `privacyScope=internal-team` for guidance, example, and recipe units.
- Verified `knowledge pack --max-units 1 --json` preserves the
  high-confidence Terraform rename guidance, reports omitted unit counts, and
  excludes raw moved-block snippets from CLI output.

Design notes:

- This closes the first user-facing slice of the agreed RAG model: local
  internal knowledge can be authored as compact units, discovered by config,
  extracted deterministically, and budgeted into planner-ready packs.
- The CLI tests intentionally cover the public command boundary rather than
  only unit-level helpers, because curated units are meant to become a stable
  operating path for demos and team workflows.

Validation completed:

- `node --experimental-strip-types test/integration/cli-knowledge-curated-units-main.test.mjs`
- `npm run test:integration`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Add read-only reference discovery for prebuilt public/internal unit
   artifacts from S3-compatible locations, reusing the same unit contracts.
2. Add planner behavior coverage proving curated Terraform/Pulumi rename
   guidance changes edit-plan review choices under tight unit budgets.
3. Add a compact CLI command or report section that makes included/omitted
   units easy to inspect without exposing raw internal snippets.

## 2026-05-12 Completed Planner Prompt Coverage for Internal Curated Units

Status:

- Added planner-prompt coverage proving internal curated units reach the
  compact LLM handoff as bounded `knowledgeFacts.units` context.
- The new coverage uses a zero-fact internal source with guidance, example,
  and recipe units, then verifies a small unit budget keeps the high-confidence
  rename guidance while omitting raw examples.

Implemented checkpoints:

- Added a Terraform-focused fixture with an `internal-knowledge` source and
  `internal-team` units.
- Verified prompt summaries report `totalFactCount=0`,
  `totalUnitCount=3`, `includedUnitCount=1`, and `omittedUnitCount=2`.
- Verified the selected unit is the curated guidance topic and that raw
  curated example snippets, content hashes, and fetched timestamps do not leak
  into the planner prompt.

Design notes:

- This locks the intended behavior: curated internal knowledge is useful to
  the planner through compact units, not through raw local files or broad text
  retrieval.
- The test reinforces the token-saving RAG path for Terraform rename handling
  under a very small budget.

Validation completed:

- `node --experimental-strip-types --test test/unit/planner-knowledge-facts-prompt.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `git diff --check`

Next recommended implementation steps:

1. Add CLI integration coverage for curated source listing/extraction text and
   JSON output if this path becomes user-facing in demos.
2. Add S3-compatible read-only reference discovery for prebuilt public/internal
   unit artifacts, keeping upload execution behind the existing approval
   boundary.
3. Add end-to-end planner decision tests that assert rename/replacement review
   choices change when curated units are present.

## 2026-05-12 Completed Local Internal Curated Knowledge Units

Status:

- Added a local-only internal curated knowledge source path for deterministic
  infrastructure RAG.
- Workspace config can now declare safe workspace-relative curated unit JSON
  files under `knowledgeSources.curatedUnits`; those files are discovered by
  `knowledge sources`, extracted by `knowledge extract`, and ranked into
  `knowledge pack` as `internal-team` unit context.

Implemented checkpoints:

- Added `internal-knowledge` as a supported knowledge source kind across
  source contracts, validation, compact result contracts, and ranking tables.
- Extended `WorkspaceAgentConfig` with
  `knowledgeSources.curatedUnits[]` entries containing `domain`, optional
  `targetPath`, safe local `path`, optional `name`, and optional `version`.
- Added safe source discovery for configured local curated unit files without
  fetching or remote backend access.
- Added `src/knowledge/curated-units.ts` to parse
  `infra-agent.curated-knowledge-units` authoring files into validated
  `infra-agent.knowledge-units`.
- Local curated units default to `privacyScope: internal-team`; generated
  fact sets remain empty, source-linked, fingerprinted, and local-only so pack
  validation can recheck the backing file.
- Knowledge packs now include these unit-only sources through the existing
  source/fingerprint/storage-policy machinery without adding raw curated file
  content to the pack.
- Updated README, Architecture, Roadmap, Agent Rules, and this handoff so
  future agents treat local curated units as part of the core RAG workflow.

Design notes:

- This implements the agreed local/internal side of the RAG model before S3.
  S3-compatible references remain a later transport concern; the unit contract
  and validation path are shared.
- The authoring format is intentionally compact JSON, not vector-indexed text.
  It supports `fact`, `guidance`, `example`, `diagnostic`, and `recipe` units
  while preserving source hash, locator, confidence, extraction method, privacy
  scope, and token-budget metadata.
- Configured paths are accepted only when they are safe workspace-relative
  paths. Secret-like paths, absolute paths, path escapes, and malformed entries
  are ignored during source discovery.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-curated-units.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Add CLI integration coverage for curated source listing/extraction text and
   JSON output if this path becomes user-facing in demos.
2. Add S3-compatible read-only reference discovery for prebuilt public/internal
   unit artifacts, keeping upload execution behind the existing approval
   boundary.
3. Add planner behavior tests proving internal curated rename/replacement
   guidance changes plan review decisions under small `--max-units` budgets.

## 2026-05-12 Completed Unit Count Metadata in Knowledge Manifests

Status:

- Knowledge artifact manifests now carry optional `unitCount` metadata for
  extraction and pack artifacts that contain unit-native knowledge.
- Manifest validation follows the referenced local artifact and reports the
  same unit totals, so future publication/download workflows can audit compact
  RAG unit volume without reading unbounded source material.

Implemented checkpoints:

- Added optional `artifact.unitCount` to generated knowledge artifact
  manifests when the referenced artifact exposes a top-level `unitCount`.
- Extended local artifact-reference validation to read referenced extraction
  and pack unit counts.
- Manifest validation now rejects forged or stale `artifact.unitCount` values
  when they drift from the referenced local artifact.
- Validation reports for manifests now surface referenced `unitCount` alongside
  existing fact counts.
- Added integration and unit coverage for extraction manifests, pack manifests,
  manifest validation output, and metadata drift detection.

Design notes:

- This preserves the existing local-only publication boundary. The manifest
  remains a descriptor/check artifact; it does not upload or mutate remote
  storage.
- Unit counts are optional for backward compatibility, but generated artifacts
  now expose them whenever available. This keeps the five-unit RAG model
  auditable across later public/internal registry work.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-artifact-integrity.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-validation-artifact-reference.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Evaluate manifest support for standalone `infra-agent.knowledge-units`
   artifacts without weakening the local-only upload/publication gates.
2. Add internal-team curated unit sources from local files or S3-compatible
   references.
3. Add planner-facing behavior tests proving guidance, examples, diagnostics,
   and recipes improve Terraform/Pulumi rename, replacement, and stack-config
   decisions while preserving compact token budgets.

## 2026-05-12 Completed Unit-Aware Knowledge Validation Reports

Status:

- `knowledge validate` now reports unit counts for unit-native artifacts.
- Standalone `infra-agent.knowledge-units` validation is no longer just a
  pass/fail check; it reports `unitSetCount` and `unitCount` in JSON output,
  and text output includes unit totals when present.

Implemented checkpoints:

- Added optional `unitSetCount` and `unitCount` to
  `KnowledgeValidationReport`.
- Standalone `infra-agent.knowledge-units` validation returns
  `unitSetCount=1` and its validated `unitCount`.
- Extraction report validation now reflects embedded `unitSets` and aggregate
  `unitCount`.
- Knowledge pack validation now surfaces `unitCount` when pack unit fields are
  present.
- CLI validation text output includes unit totals without changing legacy fact
  totals.

Design notes:

- Existing fact-only validation consumers remain compatible because unit counts
  are optional.
- This makes unit artifacts easier to audit before future team-cache or
  registry publication work, while preserving local-only validation semantics.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-unit-extraction.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-extraction-content.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Teach artifact manifests to carry optional `unitCount` metadata for
   extraction and pack artifacts, then evaluate standalone unit manifest support
   without weakening the existing local-only publication boundary.
2. Add internal-team curated unit sources from local files or S3-compatible
   references.
3. Add planner-facing behavior tests for rename/replacement guidance usage.

## 2026-05-12 Completed Standalone Knowledge Unit Artifact Output

Status:

- Added a local persistence path for extracted `infra-agent.knowledge-units`
  artifacts.
- `knowledge extract` still writes the full extraction report with `--out`, but
  can now also write one standalone unit artifact per extracted source with
  `--units-out <dir>`.

Implemented checkpoints:

- Added `--units-out <dir>` parsing for `infra-agent knowledge extract`.
- Unit artifacts are written as
  `<sourceId>.knowledge-units.json` under the requested directory.
- JSON stdout includes `unitOutputPaths` when `--units-out` is used.
- Text stdout reports the written unit artifact count and paths.
- Updated CLI usage, README, Roadmap, and Agent Rules so future agents treat
  standalone unit artifacts as part of the core knowledge workflow.

Design notes:

- This is a local-only artifact write path. It does not upload, publish, read
  credentials, or imply remote registry mutation.
- Keeping unit artifacts separate from the full extraction report lets future
  public/internal registries download compact RAG units directly while the
  legacy extraction report remains compatible.

Validation completed:

- `node --experimental-strip-types --test test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`
- `npm run test:integration`
- `npm run lint`
- `git diff --check`

Known validation note:

- `npm run test:structure` still fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file.

Next recommended implementation steps:

1. Extend team artifact manifests or descriptor planning to support
   standalone `infra-agent.knowledge-units` artifacts when the publication
   surface is ready.
2. Add internal-team curated unit sources from local files or S3-compatible
   references.
3. Add planner-facing checks that prove `guidance` and `example` units are used
   for Terraform/Pulumi rename, replacement, and stack-config decisions.

## 2026-05-12 Completed Unit-Native Extraction Projections

Status:

- Completed the first extractor-to-pack implementation slice for unit-native
  infrastructure RAG.
- Extraction still preserves the legacy `factSets` surface, but now also emits
  validated `unitSets` with `fact`, `guidance`, and `example` projections.
- Knowledge packs now prefer extracted units when available, so provider,
  Helm, Pulumi docs, and repo-local sources can carry compact explanations and
  examples without relying on raw docs or vector retrieval.

Implemented checkpoints:

- Added `src/knowledge/units.ts` to convert `KnowledgeFactSet` artifacts into
  `infra-agent.knowledge-units` artifacts.
- Every fact is projected to a `fact` unit, and selected facts also produce
  bounded non-fact units:
  - `example` units from extracted examples.
  - `guidance` units from Pulumi docs guidance.
  - `guidance` units for provider identity fields and replacement-sensitive
    fields, including rename, import, state, alias, plan, and preview review
    context.
- `extractWorkspaceKnowledgeFacts` now records `unitSets`, `unitSetCount`,
  `unitCount`, and per-source `unitCount`.
- `buildKnowledgePack` now ranks and budgets extracted unit projections first,
  while keeping the fact-backed unit fallback for legacy extraction outputs.
- `knowledge validate` now validates extraction-embedded unit sets, unit count
  arithmetic, and unit-set source references.
- CLI extraction summaries now report unit totals beside fact totals.

Design notes:

- This keeps the five-unit RAG model at the center of the product:
  `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.
- The implementation is deterministic and cache-first. Selection remains based
  on source kind, domain, target path, versioned source metadata, confidence,
  freshness, and privacy scope; no Vector DB is required for this path.
- Public-reference sources produce public guidance/examples, while repo-local
  sources produce workspace-private guidance/examples using the same workflow.
- The non-fact units intentionally stay compact and JSON-carried. They help the
  planner understand infrastructure-specific rename/replacement behavior
  without passing full provider docs, full schemas, or unbounded examples.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-unit-extraction.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-extraction-content.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `git diff --check`

Validation note:

- `npm run test:structure` currently fails on pre-existing
  `test/unit/knowledge-pack-ranking.test.mjs` length (`1147` lines, limit
  `1000`). This slice did not modify that file; split that test file in a
  dedicated cleanup commit before treating `npm run test` as fully green.

Next recommended implementation steps:

1. Persist standalone `infra-agent.knowledge-units` artifacts through the
   existing `knowledge extract --out` and validation flow when a caller wants
   unit artifacts separately from the full extraction report.
2. Extend unit-native projections for internal-team sources, including
   S3/local curated guidance, examples, diagnostics, and recipes.
3. Add planner-facing tests that prove guidance/example units improve
   Terraform/Pulumi rename and replacement review decisions while preserving
   compact token budgets.

## 2026-05-11 Completed Unit-First Knowledge Budget Alias

Status:

- Completed the first compatibility step from fact-first budgets toward
  unit-first Knowledge Unit budgets.
- New pack and compact summary generation can use `maxUnits`, while `maxFacts`
  remains serialized as the compatibility budget field for existing consumers.

Implemented checkpoints:

- Added `maxUnits` to generated knowledge packs and compact
  `knowledgeFacts` summaries.
- `buildKnowledgePack` and `budgetKnowledgePackFacts` now accept `maxUnits`;
  when both `maxFacts` and `maxUnits` are provided, `maxUnits` is the
  unit-first budget and `maxFacts` is kept aligned for compatibility.
- Knowledge pack validation and compact result contract validation accept
  optional `maxUnits`, require it to be positive, and reject drift from
  `maxFacts`.
- `infra-agent knowledge pack` now accepts `--max-units <n>` while preserving
  `--max-facts <n>`.
- `docs/AGENT_RULES.md` now tells future agents to prefer `--max-units` for
  new unit-first packs.

Design notes:

- This avoids a breaking schema migration. Existing artifacts without
  `maxUnits` still validate, while new artifacts advertise the unit-first
  budget explicitly.
- The compact RAG budget remains deterministic and shared across `facts` and
  `units` until downstream consumers can split those limits intentionally.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `node --experimental-strip-types --test test/integration/cli-knowledge-args-main.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `node --experimental-strip-types --test test/contract/agent-result-knowledge-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Promote provider/Helm/public-doc extractor outputs into stored unit-native
   packs that can be downloaded and reused across agents.
2. Add internal-knowledge pack inputs for repo-local or S3-backed curated
   guidance, examples, diagnostics, and recipes.
3. Keep `maxFacts` as a compatibility field until compact-result consumers and
   persisted fixtures can safely rely on `maxUnits`.

## 2026-05-11 Completed Identity Conflict Diagnostic Review Steps

Status:

- Completed the next `diagnostic` Knowledge Unit refinement.
- Runtime validation diagnostics now preserve compact, conflict-family-specific
  review steps for Terraform and Pulumi provider-exclusive identity conflicts.

Implemented checkpoints:

- Enhanced `src/knowledge/validation-diagnostic-units.ts` so
  `terraform-create-before-delete-conflict` and
  `pulumi-create-before-delete-conflict` issues project identity metadata into
  bounded `recommendedReview` entries.
- Covered high-value infra identity fields including DNS names, listener rule
  priorities, route identities, security group rule peers, Kubernetes object
  names/namespaces, and physical resource names.
- Preserved secret-like redaction and avoided raw validator output in
  `diagnostic` units.
- Added tests for Terraform load balancer listener rule priority conflicts and
  Pulumi CloudFront alias ownership conflicts.

Design notes:

- This keeps identity-conflict intelligence in the compact RAG surface instead
  of forcing the planner to scan raw `terraform plan` or `pulumi preview`
  output.
- The output stays deterministic and token-bounded: current `ValidationIssue`
  metadata becomes short review guidance, while mutation remains blocked until
  the normal approval and validation flow allows it.
- The slice reinforces the project direction that infra-specific RAG should
  encode rename/state/import/alias/identity semantics directly, not rely on
  generic vector retrieval.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-validation-diagnostic-units.test.mjs`
- `npm run lint`
- `npm run test:unit`
- `git diff --check`

Next recommended implementation steps:

1. Add public/internal knowledge pack publishing support for non-fact units once
   extractor output can include `guidance`, `example`, `diagnostic`, and
   `recipe` sets directly.
2. Add a `maxUnits` option or alias after compact result consumers have fully
   migrated to unit-first terminology.
3. Promote provider/Helm/public-doc extractor outputs into stored unit-native
   packs that can be downloaded and reused across agents.

## 2026-05-11 Completed Infra Workflow Recipe Units

Status:

- Completed the first `recipe` Knowledge Unit implementation.
- Initial runtime knowledge now includes deterministic infra workflow recipes
  for Terraform, Pulumi, and Helm when the selected knowledge sources cover
  those domains.

Implemented checkpoints:

- Added `src/knowledge/infra-workflow-recipe-units.ts` to project domain
  workflow recipes into `knowledgeFacts.units`.
- Terraform recipe covers logical rename review, moved blocks, import/state
  review, and exclusive identity checks.
- Pulumi recipe covers preview replacement review, aliases for logical renames,
  and native `pulumi_config_set` stack config changes.
- Helm recipe covers values schema, values-first edits, and rendered manifest
  validation through `helm template` or selected validators.
- `src/query.ts` now syncs workflow recipes into the initial runtime after
  loading the knowledge pack.

Design notes:

- Recipes are `workflow-recipe` units with `mutationAllowed: false`; they guide
  planner behavior but do not authorize edits.
- Recipes are synchronized without duplication and are linked to existing
  domain/target knowledge sources, preserving compact source-reference
  validation.
- This keeps the RAG path deterministic and token-bounded: no vector store, no
  raw docs, no raw validator output.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-infra-workflow-recipe-units.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-runtime-prefetch.test.mjs`
- `node --experimental-strip-types --test test/unit/planner-provider-model.test.mjs`

Next recommended implementation steps:

1. Promote selected identity conflict summaries into richer diagnostic units
   with conflict-family-specific `recommendedReview`.
2. Add public/internal knowledge pack publishing support for non-fact units once
   extractor output can include `guidance`, `example`, `diagnostic`, and
   `recipe` sets directly.
3. Add a `maxUnits` option or alias after compact result consumers have fully
   migrated to unit-first terminology.

## 2026-05-11 Completed Validation Diagnostic Units

Status:

- Completed the first real non-fact Knowledge Unit implementation.
- Runtime validation issues now generate compact `diagnostic` units for planner
  handoff and compact result output.

Implemented checkpoints:

- Added `src/knowledge/validation-diagnostic-units.ts` to convert current
  `ValidationIssue` entries into private-run diagnostic units.
- Diagnostic units are synchronized, not blindly appended: old
  `validation-diagnostic` units are removed before current issues are
  projected, and they are cleared once validation issues are cleared after a
  successful repair.
- `src/query.ts` now syncs validation diagnostic units whenever validation
  results are classified and after repair flows clear validation state.
- Diagnostic units reuse existing knowledge pack sources by domain/target,
  avoid raw validator output, redact secret-like issue fields, and preserve the
  reusable fact pack as the compatibility view.

Design notes:

- This intentionally keeps validator diagnostics as `privacyScope:
  private-run`. They are runtime observations, not public/provider knowledge.
- The implementation does not create a new validation source kind yet. It
  links diagnostics to the closest existing knowledge source so compact result
  source references remain valid without expanding the source contract.
- Unit-native validation from the previous slice allows these diagnostics to
  make `unitCount` diverge from `factCount` safely.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-validation-diagnostic-units.test.mjs`
- `node --experimental-strip-types --test test/integration/agent-runtime-execution.test.mjs`
- `node --experimental-strip-types --test test/contract/agent-result-knowledge-contract.test.mjs`

Next recommended implementation steps:

1. Add `recipe` units for high-value infra workflows: Terraform moved blocks,
   Pulumi aliases, Pulumi stack config writes, Helm values migrations, and
   import/state review.
2. Promote selected identity conflict summaries into richer diagnostic units
   with conflict-family-specific `recommendedReview`.
3. Add a `maxUnits` option or alias after compact result consumers have fully
   migrated to unit-first terminology.

## 2026-05-11 Completed Unit-Native Pack Validation

Status:

- Completed the validation slice needed before true non-fact unit extraction.
- Knowledge pack validation no longer assumes `unitCount === factCount`.

Implemented checkpoints:

- `src/knowledge/validate.ts` now validates unit totals as their own compact
  budget: `unitCount` must be at least `units.length`,
  `includedUnitCount` must match `units.length`, and `omittedUnitCount` must
  match `unitCount - includedUnitCount`.
- Unit source references and all five unit payload shapes remain validated.
- Existing fact-backed packs still validate, and legacy packs without unit
  fields remain accepted.
- Added tests for unit-native packs whose unit totals intentionally diverge
  from fact totals.

Design notes:

- This is the compatibility gate for future `diagnostic`, `guidance`,
  `example`, and `recipe` extraction. Without it, real unit-native packs would
  be rejected even when their unit payloads were valid.
- Fact count validation is unchanged. `facts` remains the legacy compatibility
  view, while `units` can now evolve independently.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-validation-artifact-reference.test.mjs`

Next recommended implementation steps:

1. Add first real `diagnostic` unit extraction from validation issue
   classifiers and identity conflict classifiers.
2. Add `recipe` units for Terraform moved blocks, Pulumi aliases, Pulumi stack
   config changes, Helm values migrations, and import/state review.
3. Add a `maxUnits` option or alias after compact result consumers have fully
   migrated to unit-first terminology.

## 2026-05-11 Completed Knowledge Unit Ranking Budget

Status:

- Completed the next small implementation slice for the five-unit RAG path.
- Scope is budget-time ranking only. It does not change fact extraction,
  knowledge pack construction, or the legacy `facts` compatibility ordering.

Implemented checkpoints:

- Added `src/knowledge/unit-ranking.ts` with deterministic ranking for mixed
  `fact`, `guidance`, `example`, `diagnostic`, and `recipe` units.
- Ranking includes source kind, requested domain, target path, stale source
  penalty, confidence, unit type, unit payload detail, token estimate, and
  stable path/source tie-breakers.
- `src/knowledge/fact-budget.ts` now ranks `knowledgeFacts.units` before
  applying the shared compact `maxFacts` budget. Legacy `facts` are still
  sliced in their existing order.
- Added tests that prove mixed units are ranked before slicing, unit-specific
  payload fields survive compaction, stale/unchecked confidence behavior still
  applies, and direct unit ranking is deterministic.

Design notes:

- `buildKnowledgePack` still emits fact-backed units from already-ranked facts.
  This is intentional: ranking at pack construction would be behaviorally inert
  until non-fact unit extractors exist.
- The runtime now has a deterministic place to merge future `diagnostic` and
  `recipe` units with facts, guidance, and examples without introducing vector
  retrieval or raw source payloads.
- `maxFacts` remains the shared compatibility budget name for this slice.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-fact-budget-freshness.test.mjs`

Next recommended implementation steps:

1. Add first real `diagnostic` unit extraction from validation issue
   classifiers and identity conflict classifiers.
2. Add `recipe` units for Terraform moved blocks, Pulumi aliases, Pulumi stack
   config changes, Helm values migrations, and import/state review.
3. Add a `maxUnits` option or alias after compact result consumers have fully
   migrated to unit-first terminology.

## 2026-05-11 Completed Unit-Aware Runtime Handoff

Status:

- Completed the third implementation slice for the five-unit RAG direction.
- Scope is still compatibility-preserving: the public compact result field remains
  `knowledgeFacts`, but the runtime prompt, result card, handoff budgets, and
  compact result contract now treat `units` as the preferred RAG view.

Implemented checkpoints:

- `src/knowledge/fact-budget.ts` now projects legacy packs without `units` into
  fact-backed units at budget time, so old pack fixtures still produce a
  unit-aware planner payload.
- `src/model/prompt.ts` now explicitly instructs the planner to prefer
  `knowledgeFacts.units` and to treat `knowledgeFacts.facts` as the legacy
  fact-only compatibility view.
- `src/cli/output.ts` now reports unit counts in the result card, exposes
  `knowledgeUnitCount` in the compact harness state summary, and records
  `handoffCheckpoint.budgets.knowledgeUnits` beside the existing
  `knowledgeFacts` budget.
- `src/cli/agent-result-contract.ts` now validates unit counts, unit arrays,
  supported unit types, unit extraction methods, privacy scopes, source
  references, stale/unchecked confidence downgrades, and the five unit payload
  shapes (`fact`, `guidance`, `example`, `diagnostic`, `recipe`).

Design notes:

- The compact root name remains `knowledgeFacts` to avoid breaking saved
  artifacts and downstream consumers. The semantic direction is now
  unit-first inside that envelope.
- `facts` remains a deterministic compatibility view; `units` is the RAG view
  that later non-fact extractors should populate.
- The current generated packs are still fact-backed, but the result contract now
  accepts and validates mixed unit payloads when they appear.
- `maxFacts` still acts as the shared compact budget for facts and units. A
  future `maxUnits` rename or alias can be introduced after the planner and
  extractors are fully unit-first.

Validation completed:

- `node --experimental-strip-types --test test/unit/planner-provider-model.test.mjs`
- `node --experimental-strip-types --test test/unit/planner-knowledge-facts-prompt.test.mjs`
- `node --experimental-strip-types --test test/unit/agent-output-result-card.test.mjs`
- `node --experimental-strip-types --test test/contract/agent-result-knowledge-contract.test.mjs`
- `node --experimental-strip-types test/integration/agent-runtime-handoff.test.mjs`
- `node --experimental-strip-types --test test/integration/agent-runtime-execution.test.mjs`
- `npm run lint`
- `npm run test:contract`
- `npm run test:integration`

Next recommended implementation steps:

1. Add `rankKnowledgePackUnits` with explicit unit-type weights:
   repo-local facts and validator diagnostics first, exact-version public schema
   facts next, then recipes, guidance, and examples.
2. Add initial `diagnostic` unit extraction from validation issue classifiers
   and graph/impact conflict classifiers.
3. Add `recipe` units for Terraform moved blocks, Pulumi aliases, Pulumi stack
   config changes, Helm values migrations, and import/state review.
4. Introduce a `maxUnits` budget alias once downstream compatibility with
   `maxFacts` is fully preserved.

## 2026-05-11 Completed Knowledge Pack Unit Projection

Status:

- Completed the second implementation slice for the five-unit infrastructure
  RAG direction.
- Scope is a compatibility-preserving projection only: `knowledge-pack` and
  compact budget summaries now expose a parallel `units` view, but `facts` and
  `knowledgeFacts` remain the stable compatibility surface.

Implemented checkpoints:

- `src/knowledge/pack.ts` now defines `KnowledgePackUnit` shapes for all five
  unit types and emits fact-backed `units` from the existing ranked facts.
- Generated packs now include `unitCount`, `includedUnitCount`,
  `omittedUnitCount`, and `units`, with the current values matching the
  fact-backed ranking result.
- `src/knowledge/fact-budget.ts` now includes compact `units` and unit counts
  alongside the existing `facts` summary. Stale or unchecked sources still
  downgrade high confidence in both views.
- `src/query.ts` clones runtime `knowledgeFacts.units` so runtime state remains
  immutable across loop snapshots.
- `src/knowledge/validate.ts` validates pack unit arrays when present and still
  accepts legacy packs without unit fields.

Design notes:

- This slice intentionally did not switch the planner prompt from `facts` to
  `units`; that follow-up is now covered by the "Unit-Aware Runtime Handoff"
  slice above.
- The current pack `units` are fact-backed only, so `unitCount` equals
  `factCount`. Future slices should relax this once non-fact unit extractors
  are introduced.
- `facts` remains the compatibility alias for downstream consumers that have
  not moved to unit-aware retrieval.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`
- `npm run lint`
- `npm run test:structure`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`

Next recommended implementation steps:

1. Add `rankKnowledgePackUnits` with explicit unit-type weights:
   repo-local facts and validator diagnostics first, exact-version public schema
   facts next, then recipes, guidance, and examples.
2. Add initial `diagnostic` unit extraction from validation issue classifiers
   and graph/impact conflict classifiers.
3. Add `recipe` units for Terraform moved blocks, Pulumi aliases, Pulumi stack
   config changes, Helm values migrations, and import/state review.
4. Update planner prompt generation to include a compact selected-unit section
   only after unit ranking can preserve deterministic fact precedence.

## 2026-05-11 Completed Knowledge Unit Contract Foundation

Status:

- Completed the first implementation slice for the five-unit infrastructure RAG
  direction. This is a compatibility-preserving foundation beside the existing
  `KnowledgeFact` contracts.
- Scope is local parsing, validation, typing, and compact fact mapping only.
  It does not yet replace `knowledgeFacts`, add a Vector DB, change retrieval
  ranking, or introduce remote registry writes.

Implemented checkpoints:

- `src/types/knowledge.ts` now defines `KnowledgeUnit`, `KnowledgeUnitSet`,
  supported unit types (`fact`, `guidance`, `example`, `diagnostic`, `recipe`),
  and the privacy scopes used to separate public-reference, repo-local,
  internal-team, and private-run knowledge.
- `src/knowledge/knowledge-unit-contract.ts` validates
  `infra-agent.knowledge-units` artifacts. The parser checks schema version,
  source id/hash, source freshness fields, unit count, supported source kinds,
  supported unit types, source references, token estimates, privacy scope,
  and secret-like content drift.
- Existing `KnowledgeFact` outputs can now be mapped into
  `unitType="fact"` units without changing the current extraction pipeline.
- `src/knowledge/pack.ts` and `src/knowledge/fact-budget.ts` now emit
  `unitType: "fact"` in generated compact fact packets so downstream ranking
  can start distinguishing fact units from future guidance, examples,
  diagnostics, and recipes.
- `src/knowledge/validate.ts` and `src/cli/agent-result-contract.ts` accept
  legacy compact facts without `unitType`, but reject forged non-fact unit
  labels inside the existing `knowledgeFacts` shape.
- The `knowledge validate` dispatcher now recognizes
  `infra-agent.knowledge-units` and reports unit contract drift through the
  same validation report shape used by other knowledge artifacts.
- Tests now cover the five-unit taxonomy, full knowledge-unit artifact parsing,
  rejection of mutation-enabled units, unit-count drift, unsupported unit
  types, source id/hash drift, unsafe URL query/fragment drift, secret-like
  content, fact-to-unit mapping, generated pack facts, legacy pack facts
  without `unitType`, and forged compact fact unit labels.

Design notes:

- This slice intentionally keeps `KnowledgeFact` stable. Existing planner
  summaries, CLI contract tests, saved fixtures, and publication artifacts keep
  working while new code can reason about the normalized unit taxonomy.
- The parser is fail-closed and local-only. A `recipe` may describe safe
  workflow steps, but the artifact itself must keep `mutationAllowed: false`.
- `guidance` may carry short explanation text inside JSON fields, but raw docs,
  full examples, provider schemas, and unbounded prose remain outside planner
  context.
- The five-unit model remains deterministic metadata retrieval first. Vector
  search is not a required v0 path.

Validation completed:

- `node --experimental-strip-types --test test/unit/knowledge-unit-contract.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`
- `node --experimental-strip-types --test test/unit/knowledge-pack-unit-compatibility.test.mjs`
- `npm run lint`
- `npm run test:structure`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`
- `git diff --check`

Next recommended implementation steps:

1. Promote selected `KnowledgeUnit` arrays into pack artifacts as a parallel
   `units` section while keeping current `facts` compatibility.
2. Extend deterministic ranking and budget selection by `unitType`, with
   repo-local facts and validator diagnostics first, then exact-version public
   schema facts, recipes, guidance, and examples.
3. Add initial `diagnostic` units from existing validation issue and
   graph/impact classifiers.
4. Add `guidance` and `recipe` units for Terraform moved blocks, Pulumi
   aliases, Pulumi stack config changes, Helm values migration, and
   import/state review.
5. Add public-reference and internal-registry index metadata for knowledge
   units so agents can download already-extracted provider, package, chart,
   official-doc, repo, or team knowledge by deterministic keys.

## 2026-05-11 Knowledge Unit Core Direction Review

Status:

- Reviewed the current plan, architecture, rules, and implementation progress
  against the clarified product requirement that infrastructure RAG should be
  a core differentiator of `infra-agent`.
- No feature code changed in this review. The change is a product and
  architecture direction update for future implementation slices.

Decision:

- Treat reusable infrastructure knowledge as a first-class core product layer,
  not an incidental cache.
- Make the long-term retrieval unit `infra-agent.knowledge-unit` with five
  unit types:
  `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.
- Keep retrieval deterministic by default. Select knowledge by domain,
  provider/package/chart, version, resource/module/component, field, target
  path, validation issue, planned action, risk type, freshness, and privacy
  scope before considering any vector-style discovery.
- Do not add a Vector DB as a required v0 RAG path. Structured facts,
  validator output, repo-local semantics, plan/preview diagnostics, and
  metadata ranking should drive accuracy and token reduction first.
- Public-reference provider, package, chart, Helm metadata, and official-doc
  units should be reusable through a shared registry/cache after extraction and
  validation.
- Internal module, component, chart, repo convention, policy, incident, and
  example units should use the same extraction and validation workflow, but
  source from local, repo-curated, or explicit opt-in team storage according to
  privacy scope.

Documentation updated:

- `docs/ARCHITECTURE.md` now defines the knowledge retrieval core, five unit
  types, deterministic retrieval posture, public/internal privacy split, and
  compact planner context boundary.
- `docs/ROADMAP.md` now makes public/internal knowledge registries and the
  five-unit RAG model part of the product target, architecture target,
  knowledge strategy, current gap analysis, and target artifact families.
- `docs/AGENT_RULES.md` now requires future knowledge work to preserve the
  `fact` / `guidance` / `example` / `diagnostic` / `recipe` taxonomy, avoid a
  required Vector DB path for v0, and keep planner prompts compact.

Next recommended implementation steps:

1. Add a focused `KnowledgeUnit` type and parser contract beside the current
   `KnowledgeFact` contracts.
2. Map existing `KnowledgeFact` outputs into `unitType="fact"` without
   breaking current `knowledgeFacts` planner summaries.
3. Add initial `diagnostic` units from existing validation issue and
   graph/impact conflict classifiers.
4. Add `guidance` and `recipe` units for Terraform moved blocks, Pulumi
   aliases, stack config changes, Helm values migration, and import/state
   repair review.
5. Extend pack ranking so compact planner context prefers repo-local facts,
   validator-derived diagnostics, exact-version schema/provider units, recipes,
   guidance, then examples.

## 2026-05-11 Completed Upload Execution Runtime Boundary Policy Review

Status:

- Completed as the next slice after the completed
  `upload-execution-runtime-boundaries` artifact.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-runtime-boundaries` whose ready
  next action is
  `await-explicit-upload-execution-runtime-boundary-policy-review`, then emit a
  private runtime-boundary policy-review artifact.
- This slice may record that the runtime boundary policy families were reviewed
  as a local, compact, non-executing checkpoint. It must not update Plan/Rules,
  approve upload execution, grant upload execution authorization, allow upload
  execution, generate or materialize upload commands, issue write tokens, create
  execution leases, create rollback plans, create audit records, stage artifact
  bytes, inject adapters, create clients, read credentials, check credential
  presence, perform live backend checks, bind concrete object stores or metadata
  indexes, expose handles, write objects, write metadata index entries, or
  perform remote mutations.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-runtime-boundary-policy-review`.
- CLI:
  `infra-agent knowledge upload-execution-runtime-boundary-policy-review <runtime-boundaries.json> [--out <policy-review.json>] [--json]`.
- Ready status:
  `upload-execution-runtime-boundary-policy-review-ready`, meaning only that a
  saved runtime-boundaries artifact was ready, non-executing, fingerprinted, and
  accepted as the source for local runtime-boundary policy review.
- Ready next action:
  `await-explicit-upload-execution-runtime-boundary-policy-update`. This is
  still a non-executing policy-update record step and must not become upload
  execution.

Implemented checkpoints:

- `docs/AGENT_RULES.md` and `docs/ROADMAP.md` now define the
  runtime-boundary policy-review artifact and CLI as an explicit non-executing
  checkpoint.
- `src/knowledge/team-upload-execution-runtime-boundary-policy-review.ts`
  builds ready or blocked policy-review artifacts from saved
  runtime-boundaries artifacts. It records reviewed policy families and safe
  source fingerprints, but it keeps policy update, upload execution,
  command/client/credential/live-check/object-index binding/write/token/lease/
  rollback/audit/byte/remote mutation state disabled.
- `src/knowledge/team-upload-approval-validation.ts` and
  `src/knowledge/validate.ts` validate the new artifact family, including ready
  source status, next action, safe target references, fingerprint scopes,
  reviewed family booleans, tool capability policy, compact handoff policy,
  disabled execution boundary, and blocker summaries.
- `src/cli/main.ts` and `src/cli/output.ts` expose
  `infra-agent knowledge upload-execution-runtime-boundary-policy-review
  <runtime-boundaries.json> [--out <policy-review.json>] [--json]`.
- Tests added:
  `test/unit/knowledge-team-upload-execution-runtime-boundary-policy-review.test.mjs`,
  `test/contract/knowledge-team-upload-execution-runtime-boundary-policy-review-contract.test.mjs`,
  and
  `test/integration/cli-knowledge-upload-execution-runtime-boundary-policy-review-main.test.mjs`.
- The no-SDK/no-execution guard now covers
  `team-upload-execution-runtime-boundary-policy-review.ts`.

Design notes:

- This follows the existing Agent artifact chain pattern: a source artifact is
  consumed as compact JSON, summarized through safe identifiers and
  fingerprints, and advanced to exactly one next non-executing action.
- The policy review artifact intentionally does not update Plan/Rules or grant
  execution. Its ready next action is
  `await-explicit-upload-execution-runtime-boundary-policy-update`, which must
  be implemented as a separate record if development continues.
- Tool capability policy is recorded explicitly: allowed local capabilities are
  `read-saved-json`, `validate-contract`, and `write-local-artifact`; SDK,
  credential, live backend, shell command generation, object/index write, and
  remote mutation capabilities remain disallowed.

Validation completed:

- `node --test test/unit/knowledge-team-upload-execution-runtime-boundary-policy-review.test.mjs`
- `node --test test/contract/knowledge-team-upload-execution-runtime-boundary-policy-review-contract.test.mjs`
- `node --test test/integration/cli-knowledge-upload-execution-runtime-boundary-policy-review-main.test.mjs`
- `node --test test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `npm run lint`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:coverage`
- `npm run verify`

Commits in this slice:

- `e065b7c docs: plan upload execution runtime boundary policy review`
- `37bfa03 feat: add upload execution runtime boundary policy review builder`
- `43f1dc1 test: validate upload execution runtime boundary policy review contract`
- `ee645ce feat: wire upload execution runtime boundary policy review CLI`

Next recommended implementation steps:

1. Implement `upload-execution-runtime-boundary-policy-update` as another
   explicit non-executing record that consumes this policy-review artifact.
2. Keep that next artifact separate from upload execution approval,
   authorization, runtime command generation, object/index writes, and remote
   mutation.
3. Reuse the same checks: safe target references, source fingerprint matching,
   no SDK/credential/live-check access, blocked safe output, focused contract
   tests, CLI integration, no-SDK guard, and full verification.

## 2026-05-11 Completed Upload Execution Runtime Boundaries

Status:

- Completed as the next slice after the completed
  `upload-execution-implementation-boundary` artifact.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-implementation-boundary` whose
  ready next action is `design-upload-execution-runtime-boundaries`, then emit
  a private runtime-boundaries artifact.
- This slice may record that runtime boundaries have been modeled for command,
  adapter, client, credential, live-check, object/index binding, write,
  token/lease, rollback, audit, artifact-byte, and remote-mutation families.
  It must not approve upload execution, grant upload execution authorization,
  allow upload execution, generate or materialize upload commands, issue write
  tokens, create execution leases, create rollback plans, create audit records,
  stage artifact bytes, inject adapters, create clients, read credentials,
  check credential presence, perform live backend checks, bind concrete object
  stores or metadata indexes, expose handles, write objects, write metadata
  index entries, or perform remote mutations.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-runtime-boundaries`.
- CLI:
  `infra-agent knowledge upload-execution-runtime-boundaries <implementation-boundary.json> [--out <runtime-boundaries.json>] [--json]`.
- Ready status:
  `upload-execution-runtime-boundaries-ready`, meaning only that a saved
  implementation-boundary artifact was ready, non-executing, fingerprinted, and
  accepted as the source for local runtime-boundary modeling.
- Ready next action:
  `await-explicit-upload-execution-runtime-boundary-policy-review`. This is
  still a non-executing policy-review step and must not become upload
  execution.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionRuntimeBoundaries`, which consumes
   one saved implementation-boundary artifact and emits a private dry-run
   runtime-boundaries checkpoint.
2. Added focused unit coverage for ready inputs, blocked/non-ready inputs,
   primitive and malformed inputs, forged execution state, leaky backend and
   credential material, every runtime execution flag mapping, incomplete source
   summaries, and missing structural sections.
3. Added validator dispatch and contract coverage for ready, blocked, drifted,
   and missing-section runtime-boundaries payloads.
4. Added CLI parse/help/output/integration coverage for
   `knowledge upload-execution-runtime-boundaries`.
5. Extended no-SDK/no-execution guards so this boundary cannot instantiate
   adapters or clients, read credentials, probe live backends, generate upload
   commands, bind object stores/indexes, expose handles, write object/index
   data, or perform remote mutation.
6. Normalized builder-generated blocked fingerprints to expected sha256 scopes
   with null values so generated blocked artifacts validate while forged
   unsupported fingerprint metadata remains rejected.

Acceptance criteria:

1. Ready output requires a valid
   `infra-agent.knowledge-team-upload-execution-implementation-boundary` with
   `upload-execution-implementation-boundary-ready`,
   `nextAction=design-upload-execution-runtime-boundaries`, safe redacted
   target references, verified source update-record and implementation
   boundary fingerprints, `implementationBoundaryDesigned=true`,
   `sourceUpdateRecordFingerprintVerified=true`,
   `runtimeBoundaryDesignRequired=true`, no upload execution allowance, and no
   blockers.
2. The artifact preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The runtime-boundaries record may set `runtimeBoundariesDesigned=true` and
   `sourceImplementationBoundaryFingerprintVerified=true` only as local
   modeling state. It must still keep command, adapter, client, credential,
   live-check, object/index binding, write, token, lease, rollback, audit,
   byte, executable, and remote mutation state disabled.
4. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material,
   authorization-material, runtime secrets, or object/index mutation inputs
   produce blocked or invalid results with safe blocker codes and without
   copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-runtime-boundaries.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-runtime-boundaries-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-runtime-boundaries-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `npm run lint`
- `npm run test:contract`
- `npm run test:integration`
- `npm run test:coverage`
- `npm run verify`

Next recommended implementation steps:

1. Do not treat `upload-execution-runtime-boundaries-ready` as approval to
   upload, execute, mutate remote state, create commands, or touch credentials.
2. Keep the next slice as an explicit runtime-boundary policy review:
   `await-explicit-upload-execution-runtime-boundary-policy-review`.
3. That review must remain non-executing until it narrows and documents the
   artifact-byte, adapter-injection, client-creation, credential-read,
   credential-presence, live-check, command-generation, object/index binding,
   write-token, lease, rollback, audit, and remote-mutation policies.
4. Before any later execution-adjacent artifact is introduced, keep the
   no-SDK/no-execution static guard updated and require focused unit, contract,
   CLI integration, lint, integration, coverage, and full verify checks.

## 2026-05-11 Completed Upload Execution Implementation Boundary

Status:

- Completed. This slice follows the completed
  `upload-execution-plan-rules-update-record` artifact and remains
  non-executing.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-plan-rules-update-record` whose
  ready next action is `design-upload-execution-implementation-boundary`, then
  emit a private implementation boundary artifact.
- This slice may record that an implementation boundary design checkpoint was
  modeled. It must not approve upload execution, grant upload execution
  authorization, grant mutation approval, allow upload execution, generate or
  materialize upload commands, issue write tokens, create execution leases,
  create rollback plans, create audit records, stage artifact bytes, inject
  adapters, create clients, read credentials, check credential presence,
  perform live backend checks, bind concrete object stores or metadata indexes,
  expose handles, write objects, write metadata index entries, or perform
  remote mutations.

Implemented checkpoints:

1. Added a builder for
   `infra-agent.knowledge-team-upload-execution-implementation-boundary`. It
   consumes only a saved Plan/Rules update record and emits a dry-run
   implementation boundary artifact.
2. Added unit and contract tests for ready, blocked, malformed, forged,
   command-bearing, credential-leaking, backend-leaking, and handle-leaking
   inputs.
3. Added validator dispatch and CLI wiring for
   `knowledge upload-execution-implementation-boundary`.
4. Added JSON/text output and integration coverage for ready persisted JSON and
   safe blocked text output.
5. Extended no-SDK/no-execution guards so this boundary cannot instantiate
   adapters or clients, read credentials, probe live backends, generate upload
   commands, bind object stores/indexes, write object/index data, or perform
   remote mutation.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-implementation-boundary`.
- CLI:
  `infra-agent knowledge upload-execution-implementation-boundary <plan-rules-update-record.json> [--out <implementation-boundary.json>] [--json]`.
- Ready status:
  `upload-execution-implementation-boundary-ready`, meaning only that the saved
  Plan/Rules update record was ready, non-executing, fingerprint-verified, and
  accepted as the source for a local implementation-boundary checkpoint.
- Ready next action:
  `design-upload-execution-runtime-boundaries`. This is still a non-executing
  design step and must not become an execute/upload action.

Acceptance criteria:

1. `upload-execution-implementation-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-plan-rules-update-record` with
   `upload-execution-plan-rules-update-record-ready`,
   `nextAction=design-upload-execution-implementation-boundary`, safe redacted
   target references, verified source review/update fingerprints,
   `planRulesUpdateRecorded=true`, `rulesUpdateReviewed=true`,
   `fingerprintVerified=true`, `policyUpdateAuthorized=false`,
   `executionStillDisabled=true`, no upload execution allowance, and no
   blockers.
2. The artifact preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The boundary may set `implementationBoundaryDesigned=true` and
   `sourceUpdateRecordFingerprintVerified=true` only as local modeling state.
   It must still keep implementation, approval, authorization, upload
   execution, command, adapter, client, credential, live-check, object/index
   binding, write, token, lease, rollback, audit, byte, executable, and remote
   mutation state disabled.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `authorizationGranted=false`,
   `executionAuthorizationGranted=false`, `uploadApproved=false`,
   `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
   `mutationApprovalGranted=false`, `writeTokenIssued=false`,
   `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
   `auditRecordCreated=false`, `artifactBytesProvided=false`,
   `adapterInjected=false`, `clientCreated=false`,
   `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
   `liveCheckAllowed=false`, `uploadCommandGenerated=false`,
   `artifactObjectStoreBound=false`, `metadataIndexBound=false`,
   `objectWriteAllowed=false`, `metadataIndexWriteAllowed=false`,
   `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
   `executable=false`, and `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material,
   authorization-material, or object/index mutation inputs produce blocked or
   invalid results with safe blocker codes and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-implementation-boundary.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-plan-rules-update-record-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-implementation-boundary-main.test.mjs`
- `npm run lint`
- `npm run test:integration`
- `npm run test:coverage`
- `npm run verify`

Core files changed:

- `src/knowledge/team-upload-execution-implementation-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-implementation-boundary.test.mjs`
- `test/contract/knowledge-team-upload-execution-plan-rules-update-record-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-implementation-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- Do not execute upload and do not treat this implementation boundary as
  approval. A ready boundary only proves the local, non-executing
  implementation-boundary checkpoint was modeled from a ready Plan/Rules
  update record.
- The next slice should design runtime boundaries as separate non-executing
  artifacts. It should continue to forbid command generation, adapter/client
  creation, credential reads/checks, live checks, object-store/index binding,
  object/index writes, write tokens, execution leases, rollback plans, audit
  records, artifact-byte material, and remote mutations until a later,
  explicitly reviewed policy slice narrows those rules.

## 2026-05-11 Completed Upload Execution Plan/Rules Update Record

Status:

- Completed. This slice follows the completed
  `upload-execution-plan-rules-review` artifact and remains non-executing.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-plan-rules-review` whose ready
  next action is `await-explicit-plan-rules-update`, plus one explicit
  operator-supplied review fingerprint, then emit a private Plan/Rules update
  record artifact.
- This slice may record that the exact Plan/Rules review fingerprint was
  acknowledged for a future policy update. It must not approve upload
  execution, grant upload execution authorization, grant mutation approval,
  allow upload execution, generate or materialize upload commands, issue write
  tokens, create execution leases, create rollback plans, create audit records,
  stage artifact bytes, inject adapters, create clients, read credentials,
  check credential presence, perform live backend checks, bind concrete object
  stores or metadata indexes, expose handles, write objects, write metadata
  index entries, or perform remote mutations.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionPlanRulesUpdateRecord` and contract
   types. It consumes only a saved Plan/Rules review artifact plus an explicit
   review fingerprint and emits a dry-run update record artifact.
2. Added focused unit coverage for ready, missing fingerprint, mismatch, blocked
   source, malformed source, forged execution flags, command-bearing inputs,
   authorization-material leakage, and private/leaky inputs.
3. Added validator dispatch and contract coverage for ready and drifted payloads,
   including source review, fingerprint matching, target redaction, update
   record fields, execution boundary, and readiness drift.
4. Extended no-SDK/no-execution guards so this record cannot materialize
   authorization, instantiate clients, read credentials, generate commands,
   perform checks, bind stores/indexes, or write object/index data.
5. Added CLI parsing, help text, JSON/text output, and integration coverage for
   `knowledge record-upload-execution-plan-rules-update`.
6. Added validator branch coverage for forged upload execution boundary
   envelopes and artifact-reference validation so the full project coverage
   gate remains above threshold after this slice.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-plan-rules-update-record`.
- CLI:
  `infra-agent knowledge record-upload-execution-plan-rules-update <plan-rules-review.json> --review-fingerprint <sha256> [--out <plan-rules-update-record.json>] [--json]`.
- Ready status should be
  `upload-execution-plan-rules-update-record-ready`, meaning only that the
  supplied review fingerprint matched the saved Plan/Rules review artifact and
  that a policy-update record was modeled locally.
- Ready next action should remain non-executing; currently expected:
  `design-upload-execution-implementation-boundary`. Blocked next action
  remains `resolve-blockers`.

Acceptance criteria:

1. `upload-execution-plan-rules-update-record-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-plan-rules-review` with
   `upload-execution-plan-rules-review-ready`,
   `nextAction=await-explicit-plan-rules-update`, safe redacted target
   references, verified source authorization boundary metadata,
   `planRulesUpdateReviewRequired=true`, `planRulesUpdated=false`,
   `rulesUpdateReviewed=false`, `executionStillDisabled=true`, no execution
   authorization grant, no upload execution approval, no upload execution
   allowance, and no blockers.
2. The supplied review fingerprint must be a safe SHA-256 hex string and
   exactly match `planRulesReview.reviewFingerprint.value`. Mismatch, missing,
   malformed, unsupported, or null source fingerprints must block without
   copying private values.
3. The record preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
4. The record may set `planRulesUpdateRecorded=true` and
   `rulesUpdateReviewed=true` only as local review-record state. It must still
   keep execution disabled and must not use those fields as approval,
   authorization, command, write, credential, live-check, client, adapter, or
   mutation permission.
5. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `authorizationGranted=false`,
   `executionAuthorizationGranted=false`, `uploadApproved=false`,
   `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
   `mutationApprovalGranted=false`, `writeTokenIssued=false`,
   `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
   `auditRecordCreated=false`, `artifactBytesProvided=false`,
   `adapterInjected=false`, `clientCreated=false`,
   `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
   `liveCheckAllowed=false`, `liveCheckPerformed=false`,
   `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
   `metadataIndexBound=false`, `objectWriteAllowed=false`,
   `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
   `metadataIndexWriteAttempted=false`, `executable=false`, and
   `remoteMutationPerformed=false`.
6. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material,
   authorization-material, or object/index mutation inputs produce blocked or
   invalid results with safe blocker codes and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-plan-rules-update-record.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-plan-rules-update-record-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-upload-approval-validation-branch.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-validation-artifact-reference.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-record-upload-execution-plan-rules-update-main.test.mjs`
- `npm run lint`
- `npm run test:structure`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run test:coverage`
- `npm run package:check`
- `npm run verify`

Validation limitation:

- `npm run build` was attempted but this package has no `build` script. This
  is not a failing build; validation uses the existing project scripts above.

Core files changed:

- `src/knowledge/team-upload-execution-plan-rules-update-record.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-plan-rules-update-record.test.mjs`
- `test/contract/knowledge-team-upload-execution-plan-rules-update-record-contract.test.mjs`
- `test/unit/knowledge-team-upload-approval-validation-branch.test.mjs`
- `test/unit/knowledge-validation-artifact-reference.test.mjs`
- `test/integration/cli-knowledge-record-upload-execution-plan-rules-update-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- Do not execute upload and do not treat this record as approval. A ready
  `upload-execution-plan-rules-update-record` only proves that the operator
  acknowledged the exact Plan/Rules review fingerprint.
- The next slice should design a separate upload execution implementation
  boundary as another non-executing artifact. It should continue to forbid
  command generation, SDK clients, credential reads/checks, live checks,
  object-store/index binding, object/index writes, write tokens, execution
  leases, rollback plans, audit records, and remote mutations until a later,
  explicitly reviewed policy slice narrows those rules.

## 2026-05-11 Completed Upload Execution Plan/Rules Review

Status:

- Completed. This slice follows the completed
  `upload-execution-authorization-boundary` artifact and remains non-executing.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-authorization-boundary` whose
  ready next action is `await-plan-rules-update-for-upload-execution`, then
  emit a private Plan/Rules update review artifact.
- This slice may summarize what must be reviewed before the Plan and Rules are
  narrowed for any future upload execution design. It must not update the Plan
  or Rules as approved policy, grant upload execution authorization, grant
  mutation approval, allow upload execution, generate or materialize upload
  commands, issue write tokens, create execution leases, create rollback
  plans, create audit records, stage artifact bytes, inject adapters, create
  clients, read credentials, check credential presence, perform live backend
  checks, bind concrete object stores or metadata indexes, expose handles,
  write objects, write metadata index entries, or perform remote mutations.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionPlanRulesReview` and contract types.
   It consumes only a saved upload execution authorization boundary and emits a
   dry-run Plan/Rules review artifact.
2. Added focused unit coverage for ready, blocked, malformed, forged, private,
   command-bearing, execution-flag, backend-leaking, and leaky inputs.
3. Added validator dispatch and contract coverage for ready and drifted
   payloads, including source boundary, target redaction, review checklist,
   readiness, and fingerprint drift.
4. Extended no-SDK/no-execution guards so this review cannot materialize
   authorization, instantiate clients, read credentials, generate commands,
   perform checks, bind stores/indexes, or write object/index data.
5. Added CLI parsing, help text, JSON/text output, and integration coverage for
   `knowledge upload-execution-plan-rules-review`.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-plan-rules-review`.
- CLI:
  `infra-agent knowledge upload-execution-plan-rules-review <execution-authorization-boundary.json> [--out <plan-rules-review.json>] [--json]`.
- Ready status should be `upload-execution-plan-rules-review-ready`, meaning
  only that the prior authorization boundary was safely converted into a
  Plan/Rules update review gate.
- Ready next action should remain non-executing; currently expected:
  `await-explicit-plan-rules-update`. Blocked next action remains
  `resolve-blockers`.

Initial acceptance criteria:

1. `upload-execution-plan-rules-review-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-authorization-boundary` with
   `upload-execution-authorization-boundary-ready`,
   `nextAction=await-plan-rules-update-for-upload-execution`, safe redacted
   target references, verified source human approval record metadata,
   `authorizationBoundaryDesigned=true`, no authorization grant, no upload
   execution approval, no upload execution allowance, and no blockers.
2. The review preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The output may emit a deterministic review fingerprint over non-secret
   source, target, and review checklist fields, but it must not include backend
   coordinates, credential state, object keys, local paths, command material,
   byte payloads, handles, authorization material, or mutation results.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `authorizationGranted=false`,
   `executionAuthorizationGranted=false`, `uploadApproved=false`,
   `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
   `mutationApprovalGranted=false`, `writeTokenIssued=false`,
   `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
   `auditRecordCreated=false`, `artifactBytesProvided=false`,
   `adapterInjected=false`, `clientCreated=false`,
   `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
   `liveCheckAllowed=false`, `liveCheckPerformed=false`,
   `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
   `metadataIndexBound=false`, `objectWriteAllowed=false`,
   `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
   `metadataIndexWriteAttempted=false`, `executable=false`, and
   `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material,
   authorization-material, or object/index mutation inputs produce blocked or
   invalid results with safe blocker codes and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-plan-rules-review.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-plan-rules-review-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-plan-rules-review-main.test.mjs`
- `npm run lint`
- `npm run test:structure`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run package:check`

Core files changed:

- `src/knowledge/team-upload-execution-plan-rules-review.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-plan-rules-review.test.mjs`
- `test/contract/knowledge-team-upload-execution-plan-rules-review-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-plan-rules-review-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- Do not proceed directly to upload execution. A ready
  `upload-execution-plan-rules-review` artifact only records that a later
  explicit Plan/Rules update must be reviewed.
- The next slice should update and review the Plan/Rules explicitly, then lock
  any newly narrowed authorization boundary in docs and tests. Until that
  happens, command generation, authorization grants, write tokens, execution
  leases, rollback plans, audit records, byte staging, adapter/client creation,
  credential reads/checks, live checks, object-store/index binding, object
  writes, metadata index writes, and remote mutation remain forbidden.

## 2026-05-11 Completed Upload Execution Authorization Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `record-human-upload-execution-approval`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-approval-record` and emit a
  private upload execution authorization boundary artifact.
- This slice may model that a verified human approval record exists and that a
  later upload execution authorization must remain explicit. It must not grant
  upload execution, grant mutation approval, allow upload execution, generate
  or materialize upload commands, issue write tokens, create execution leases,
  create rollback plans, create audit records, stage artifact bytes, inject
  adapters, create clients, read credentials, check credential presence,
  perform live backend checks, bind concrete object stores or metadata indexes,
  expose handles, write objects, write metadata index entries, or perform
  remote mutations.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionAuthorizationBoundary` and its
   contract types. It consumes only a saved approval record and emits a
   dry-run authorization boundary artifact.
2. Added focused unit coverage for ready, blocked, primitive private,
   malformed, forged grant, execution-flag, and leaky materialized inputs.
3. Added validator dispatch and contract coverage for ready and drifted
   payloads, including authorization fingerprint drift and source record drift.
4. Added no-SDK/no-execution guard coverage for the new authorization boundary
   module.
5. Added CLI parsing, JSON/text output, help surface, and integration coverage
   for
   `knowledge upload-execution-authorization-boundary`.

Artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-authorization-boundary`.
- CLI:
  `infra-agent knowledge upload-execution-authorization-boundary <execution-approval-record.json> [--out <execution-authorization-boundary.json>] [--json]`.
- Ready status should be
  `upload-execution-authorization-boundary-ready`, meaning only that the final
  explicit upload execution authorization boundary has been modeled. It is not
  upload execution approval, upload execution authorization, or execution
  readiness.
- Ready next action should remain non-executing; currently expected:
  `await-plan-rules-update-for-upload-execution`. Blocked next action remains
  `resolve-blockers`.

Initial acceptance criteria:

1. `upload-execution-authorization-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-approval-record` with
   `upload-execution-approval-record-ready`,
   `nextAction=design-upload-execution-authorization-boundary`, safe redacted
   target references, a verified source approval request, matched mock backend
   posture, human approval recorded, approval fingerprint verified, no
   approval grant, no upload execution approval, no upload execution allowance,
   and no blockers.
2. The boundary preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The output may emit a deterministic authorization-boundary fingerprint over
   non-secret source and target fields, but the fingerprint must not include
   backend coordinates, credential state, object keys, local paths, command
   material, byte payloads, handles, or mutation results.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `uploadApproved=false`,
   `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
   `mutationApprovalGranted=false`, `writeTokenIssued=false`,
   `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
   `auditRecordCreated=false`, `artifactBytesProvided=false`,
   `adapterInjected=false`, `clientCreated=false`,
   `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
   `liveCheckAllowed=false`, `liveCheckPerformed=false`,
   `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
   `metadataIndexBound=false`, `objectWriteAllowed=false`,
   `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
   `metadataIndexWriteAttempted=false`, `executable=false`, and
   `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material,
   authorization-material, or object/index mutation inputs produce blocked or
   invalid results with safe blocker codes and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-authorization-boundary.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-authorization-boundary-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-authorization-boundary-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-record-human-upload-execution-approval-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-approval-record-contract.test.mjs`
- `npm run lint`
- `npm run test:structure`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:contract`
- `npm run package:check`

Core files changed:

- `src/knowledge/team-upload-execution-authorization-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-authorization-boundary.test.mjs`
- `test/contract/knowledge-team-upload-execution-authorization-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-authorization-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- Do not proceed directly to upload execution. The ready next action is
  `await-plan-rules-update-for-upload-execution`; before any future execution
  design, the Plan and Rules need an explicit update that narrows what is now
  allowed. Until that happens, the chain must continue to treat command
  generation, authorization grants, write tokens, execution leases, rollback
  plans, audit records, byte staging, adapter/client creation, credential
  reads/checks, live checks, object-store/index binding, object writes,
  metadata index writes, and remote mutation as forbidden.

## 2026-05-10 Completed Human Upload Execution Approval Record

Status:

- Completed. This slice continues the private dry-run
  upload boundary chain after `request-separate-upload-execution-approval`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-approval-request` and one
  explicit operator-supplied approval fingerprint, then emit a private human
  upload execution approval record artifact.
- This slice records only that the supplied fingerprint exactly matches the
  deterministic approval request fingerprint. It must not grant upload
  execution, grant mutation approval, allow upload execution, generate or
  materialize upload commands, issue write tokens, create execution leases,
  create rollback plans, create audit records, stage artifact bytes, inject
  adapters, create clients, read credentials, check credential presence,
  perform live backend checks, bind concrete object stores or metadata indexes,
  expose handles, write objects, write metadata index entries, or perform
  remote mutations.

Implemented checkpoints:

1. Added the human upload execution approval record contract and builder from
   the saved approval request plus supplied fingerprint.
2. Added focused unit coverage for ready, mismatch, blocked source, malformed,
   forged, missing fingerprint, primitive private, and leaky inputs.
3. Added validator dispatch and contract coverage for ready and drifted
   payloads.
4. Added CLI parsing, JSON/text output, help text, and integration coverage for
   `knowledge record-human-upload-execution-approval`.
5. Added no-SDK/no-execution guard coverage and updated handoff/rules/roadmap
   after verification.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-approval-record`.
- CLI:
  `infra-agent knowledge record-human-upload-execution-approval <execution-approval-request.json> --approval-fingerprint <sha256> [--out <execution-approval-record.json>] [--json]`.
- Ready status should be `upload-execution-approval-record-ready`, meaning
  only that human review/approval fingerprint matching was recorded. It is not
  upload execution authorization.
- Ready next action should remain non-executing; currently expected:
  `design-upload-execution-authorization-boundary`. Blocked next action
  remains `resolve-blockers`.

Initial acceptance criteria:

1. `upload-execution-approval-record-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-approval-request` with
   `upload-execution-approval-request-ready`,
   `nextAction=record-human-upload-execution-approval`, safe redacted target
   references, source execution readiness verified, matched scope, mock backend
   posture, `requestIssued=true`, no previous human approval record, no
   approval grant, and no blockers.
2. The supplied fingerprint must be a safe SHA-256 hex string and exactly match
   `approvalRequest.fingerprint.value`. Mismatch or missing fingerprint must
   block without copying private values.
3. The record preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `uploadApproved=false`,
   `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
   `mutationApprovalGranted=false`, `writeTokenIssued=false`,
   `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
   `auditRecordCreated=false`, `artifactBytesProvided=false`,
   `adapterInjected=false`, `clientCreated=false`,
   `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
   `liveCheckAllowed=false`, `liveCheckPerformed=false`,
   `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
   `metadataIndexBound=false`, `objectWriteAllowed=false`,
   `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
   `metadataIndexWriteAttempted=false`, `executable=false`, and
   `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material, or object/index
   mutation inputs produce blocked or invalid results with safe blocker codes
   and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-approval-record.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-approval-record-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-record-human-upload-execution-approval-main.test.mjs`

Core files changed:

- `src/knowledge/team-upload-execution-approval-record.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-approval-record.test.mjs`
- `test/contract/knowledge-team-upload-execution-approval-record-contract.test.mjs`
- `test/integration/cli-knowledge-record-human-upload-execution-approval-main.test.mjs`

Next recommended slice:

- `design-upload-execution-authorization-boundary`. It should consume the
  saved `infra-agent.knowledge-team-upload-execution-approval-record` and
  design a final explicit upload execution authorization boundary. The next
  slice still should not perform uploads, issue write tokens, create leases,
  create rollback plans, create audit records, stage artifact bytes, inject
  adapters, create clients, read credentials, check credential presence,
  perform live checks, generate commands, bind object stores or metadata
  indexes, expose handles, write objects, write metadata index entries, or
  perform remote mutations unless a later Plan/Rules update explicitly narrows
  and approves that boundary.

## 2026-05-10 Completed Upload Execution Approval Request

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-execution-readiness-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-readiness-boundary` and emit a
  private human upload execution approval request artifact with a deterministic
  approval scope fingerprint.
- This slice must not grant upload approval, grant mutation approval, allow
  upload execution, generate or materialize upload commands, issue write tokens,
  create execution leases, create rollback plans, create audit records, stage
  artifact bytes, inject adapters, create clients, read credentials, check
  credential presence, perform live backend checks, bind concrete object stores
  or metadata indexes, expose handles, write objects, write metadata index
  entries, or perform remote mutations.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionApprovalRequest` and its contract
   types. It consumes the saved execution readiness boundary and emits only a
   dry-run approval request artifact.
2. Added focused unit coverage for ready, blocked, malformed, missing,
   forged, primitive private, and leaky inputs.
3. Added validator dispatch for
   `infra-agent.knowledge-team-upload-execution-approval-request`, including
   ready/drift contract coverage.
4. Added CLI parsing, help text, JSON/text output, and integration coverage
   for `knowledge request-separate-upload-execution-approval`.
5. Extended no-SDK/no-execution guards so this request cannot grant approval,
   instantiate clients, read credentials, generate commands, perform checks,
   or write object/index data.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-approval-request`.
- CLI:
  `infra-agent knowledge request-separate-upload-execution-approval <execution-readiness-boundary.json> [--out <execution-approval-request.json>] [--json]`.
- Ready status should be `upload-execution-approval-request-ready`, meaning only that a
  safe human approval request and fingerprint were prepared. It is not approval
  granted and not upload execution authorization.
- Ready next action should remain non-executing; currently expected:
  `record-human-upload-execution-approval`. Blocked next action remains
  `resolve-blockers`.

Initial acceptance criteria:

1. `upload-execution-approval-request-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-readiness-boundary` with
   `upload-execution-readiness-boundary-ready`,
   `nextAction=request-separate-upload-execution-approval`, safe redacted
   target references, verified prior review state, matched scope, mock backend
   posture, modeled execution readiness requirements, and no blockers.
2. The request preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The output emits a deterministic SHA-256 approval scope fingerprint over the
   non-secret readiness scope so a later review can compare an operator-supplied
   fingerprint without exposing backend or credential details.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `uploadApproved=false`,
   `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
   `writeTokenIssued=false`, `executionLeaseCreated=false`,
   `rollbackPlanCreated=false`, `auditRecordCreated=false`,
   `artifactBytesProvided=false`, `adapterInjected=false`,
   `clientCreated=false`, `credentialValuesExposed=false`,
   `credentialPresenceChecked=false`, `liveCheckAllowed=false`,
   `liveCheckPerformed=false`, `uploadCommandGenerated=false`,
   `artifactObjectStoreBound=false`, `metadataIndexBound=false`,
   `objectWriteAllowed=false`, `metadataIndexWriteAllowed=false`,
   `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
   `executable=false`, and `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material, or object/index
   mutation inputs produce blocked or invalid results with safe blocker codes
   and without copying private values.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-approval-request.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-approval-request-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-request-separate-upload-execution-approval-main.test.mjs`

Core files changed:

- `src/knowledge/team-upload-execution-approval-request.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-approval-request.test.mjs`
- `test/contract/knowledge-team-upload-execution-approval-request-contract.test.mjs`
- `test/integration/cli-knowledge-request-separate-upload-execution-approval-main.test.mjs`

Next recommended slice:

- Completed by the 2026-05-10 human upload execution approval record slice
  above.

## 2026-05-10 Completed Upload Execution Readiness Boundary

Status:

- Completed. This slice continues the private dry-run upload
  boundary chain after `upload-object-index-binding-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-object-index-binding-boundary` and emit a
  private upload execution readiness boundary artifact that records final
  upload execution readiness requirements.
- This slice must not approve upload execution, grant mutation approval, issue
  write tokens, create execution leases, create rollback plans, create audit
  records, stage artifact bytes, inject adapters, create clients, read
  credentials, check credential presence, perform live backend checks, generate
  or materialize upload commands, bind concrete object stores or metadata
  indexes, expose handles, write objects, write metadata index entries, or
  perform remote mutations.

Implemented checkpoints:

1. Added `buildKnowledgeTeamUploadExecutionReadinessBoundary` and its contract
   types. It consumes the saved object/index binding boundary and emits only a
   dry-run readiness artifact.
2. Added focused unit coverage for ready, non-ready, malformed, missing,
   forged, primitive private, and leaky inputs.
3. Added validator dispatch for
   `infra-agent.knowledge-team-upload-execution-readiness-boundary`, including
   ready/drift contract coverage.
4. Added CLI parsing, help text, JSON/text output, and integration coverage for
   `knowledge upload-execution-readiness-boundary`.
5. Extended no-SDK/no-execution guards so this boundary cannot approve
   execution, instantiate clients, read credentials, generate commands, perform
   checks, or write object/index data.

Expected artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-readiness-boundary`.
- CLI:
  `infra-agent knowledge upload-execution-readiness-boundary <object-index-binding-boundary.json> [--out <execution-readiness-boundary.json>] [--json]`.
- Ready status should be `upload-execution-readiness-boundary-ready`, meaning
  only that final upload execution readiness requirements are modeled. It is
  not upload approval, mutation approval, token issuance, lease creation,
  rollback creation, audit creation, byte staging, adapter injection, client
  creation, credential access, live checking, command generation, store/index
  binding, object/index writing, or remote mutation readiness.
- Ready next action should remain non-executing; currently expected:
  `request-separate-upload-execution-approval`. Blocked next action remains
  `resolve-blockers`.

Initial acceptance criteria:

1. `upload-execution-readiness-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-object-index-binding-boundary` with
   `object-index-binding-boundary-ready`,
   `nextAction=design-upload-execution-readiness-boundary`, safe redacted
   target references, verified prior review state, matched scope, mock backend
   posture, modeled command and object/index binding requirements, and no
   blockers.
2. The boundary preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The output explicitly records final execution-readiness requirements:
   artifact bytes, adapter injection, client creation, credential read,
   credential presence, live check, upload command, object/index binding,
   write token, execution lease, rollback plan, audit record, object write,
   metadata-index write, explicit upload approval, mutation approval, and
   command execution approval.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `uploadApproved=false`,
   `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
   `writeTokenIssued=false`, `executionLeaseCreated=false`,
   `rollbackPlanCreated=false`, `auditRecordCreated=false`,
   `artifactBytesProvided=false`, `adapterInjected=false`,
   `clientCreated=false`, `credentialValuesExposed=false`,
   `credentialPresenceChecked=false`, `liveCheckAllowed=false`,
   `liveCheckPerformed=false`, `uploadCommandGenerated=false`,
   `artifactObjectStoreBound=false`, `metadataIndexBound=false`,
   `objectWriteAllowed=false`, `metadataIndexWriteAllowed=false`,
   `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
   `executable=false`, and `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle,
   metadata-index-handle, token/lease/rollback/audit material, or object/index
   mutation inputs produce blocked or invalid results with safe blocker codes
   and without copying private values.

## 2026-05-10 Completed Object/Index Binding Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-command-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-command-boundary` and emit a private
  object/index binding boundary artifact that records future object-store and
  metadata-index binding requirements.
- This slice must not bind concrete object stores or metadata indexes, expose
  target object keys, generate or materialize upload commands, create SDK
  clients, inject adapters, read credentials, check credential presence,
  perform live backend checks, read or stage artifact bytes, write objects,
  write metadata index entries, or perform remote mutations.

Implemented checkpoints:

1. Add the object/index binding boundary contract and builder from the saved
   upload-command boundary.
2. Add focused unit coverage for ready, blocked, malformed, forged, and leaky
   inputs.
3. Add validator dispatch and contract coverage for ready, blocked, and drifted
   payloads.
4. Add CLI parsing, JSON/text output, help text, and integration coverage.
5. Add no-SDK/no-binding/no-command-generation guard coverage and update rules,
   roadmap, skill, and handoff docs after verification.

Expected artifact and CLI:

- Artifact kind: `infra-agent.knowledge-team-upload-object-index-binding-boundary`.
- CLI:
  `infra-agent knowledge upload-object-index-binding-boundary <command-boundary.json> [--out <object-index-binding-boundary.json>] [--json]`.
- Ready status should be `object-index-binding-boundary-ready`, meaning only
  that future object-store and metadata-index binding requirements are modeled.
  It is not store/index binding, command generation, command execution, byte
  staging, upload readiness, or remote mutation readiness.
- Ready next action should remain design-only; currently expected:
  `design-upload-execution-readiness-boundary`. Blocked next action remains
  `resolve-blockers`.

Completed commits for this slice:

1. `docs: plan object index binding boundary`
2. `feat: add object index binding boundary contract`
3. `test: cover object index binding ready path`
4. `test: block invalid object index binding inputs`
5. `feat: validate object index binding boundaries`
6. `test: cover object index binding validation drift`
7. `test: cover object index binding contract`
8. `feat: wire object index binding boundary cli`
9. `test: cover object index binding cli parsing`
10. `test: cover object index binding cli`
11. `test: guard object index binding no sdk`
12. `docs: document object index binding boundary`
13. `test: strengthen upload boundary edge guards`

Implemented acceptance criteria:

1. `object-index-binding-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-command-boundary` with
   `upload-command-boundary-ready`,
   `nextAction=design-object-index-binding-boundary`, safe redacted target
   references, verified prior review state, matched scope, mock backend
   posture, modeled upload-command requirements, object/index dependencies,
   and no blockers.
2. The boundary preserves safe target identifiers and hash references while
   retaining `target.objectKeyRedacted=true`; it does not copy
   `target.objectKey` to output.
3. The output explicitly records future object/index binding requirements:
   object-store descriptor, metadata-index descriptor, object-key redaction,
   metadata-index entry redaction, content-addressed keys, idempotent
   object/index writes, execution-boundary requirements, and explicit upload
   approval.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `artifactObjectStoreBound=false`,
   `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
   `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
   `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
   `metadataIndexWriteAttempted=false`, `executable=false`, and
   `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, object-key-copying, object-store-handle, or
   metadata-index-handle inputs produce blocked or invalid results with safe
   blocker codes and without copying private values.
6. Coverage hardening now also exercises missing source sections, top-level
   forged execution flags, source upload-command requirement drift, primitive
   private inputs, and missing or unsafe continuation references in the upload
   boundary chain.

Validation run during this slice:

- `node --experimental-strip-types ./test/unit/knowledge-team-upload-execution-readiness-boundary.test.mjs`
- `node --experimental-strip-types ./test/contract/knowledge-team-upload-execution-readiness-boundary-contract.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-knowledge-upload-execution-readiness-boundary-main.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`

Core files:

- `src/knowledge/team-upload-execution-readiness-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-readiness-boundary.test.mjs`
- `test/contract/knowledge-team-upload-execution-readiness-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-readiness-boundary-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- `request-separate-upload-execution-approval`. It should consume the saved
  execution readiness boundary and model the human approval request separately
  from any upload execution. It must not grant approval by default, generate
  commands, bind stores/indexes, expose handles, read credentials, stage bytes,
  write objects, write metadata index entries, or perform remote mutation.

## 2026-05-10 Completed Upload Command Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain after
  `upload-live-check-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-live-check-boundary` and emit a private
  upload-command boundary artifact that records the future upload-command
  requirements needed before object/index binding or mutation design.
- This slice must not generate a real upload command, expose command payloads,
  read credential values, check credential presence, perform live backend
  checks, create SDK clients, inject adapters, bind object stores or metadata
  indexes, read or stage artifact bytes, write object storage, write metadata
  indexes, or perform remote mutations.

Implemented checkpoints:

1. Add the upload-command boundary contract and builder from the saved live
   check boundary.
2. Add focused unit coverage for ready, blocked, malformed, forged, and leaky
   inputs.
3. Add validator dispatch and contract coverage for ready, blocked, and drifted
   payloads.
4. Add CLI parsing, JSON/text output, help text, and integration coverage.
5. Add no-SDK/no-command-generation guard coverage and update rules, roadmap,
   skill, and handoff docs after verification.

Completed commits for this slice:

1. `docs: plan upload command boundary`
2. `feat: add upload command boundary contract`
3. `test: cover upload command boundary ready path`
4. `test: block invalid upload command inputs`
5. `feat: validate upload command boundaries`
6. `test: cover upload command validation drift`
7. `test: cover upload command contract`
8. `feat: wire upload command boundary cli`
9. `test: cover upload command cli parsing`
10. `test: cover upload command cli`
11. `test: guard upload command boundary no sdk`
12. `docs: document upload command boundary`
13. `test: cover upload command boundary edge cases`

Implemented artifact and CLI:

- Artifact kind: `infra-agent.knowledge-team-upload-command-boundary`.
- CLI:
  `infra-agent knowledge upload-command-boundary <live-check-boundary.json> [--out <command-boundary.json>] [--json]`.
- Ready status is `upload-command-boundary-ready`, meaning only that the saved
  live-check boundary is safe and future upload-command requirements are
  modeled. It is not command generation, command materialization, command
  execution, backend reachability, credential access, or upload readiness.
- Ready next action is `design-object-index-binding-boundary`; blocked next
  action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `upload-command-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-live-check-boundary` with
   `live-check-boundary-ready`, `nextAction=design-upload-command-boundary`,
   safe target references, verified prior review state, matched scope, mock
   backend posture, modeled live-check requirements, upload command still
   required, and no blockers.
2. The boundary preserves safe target identifiers and hash references while
   redacting the source object key as `target.objectKeyRedacted=true`; it does
   not copy `target.objectKey` to output.
3. The output explicitly records future command requirements: command
   descriptor, command generation after live-check boundary design, command
   payload/material redaction, command execution approval, object/index
   dependencies, content-addressed keys, idempotent writes, and explicit
   approval.
4. Top-level and nested execution state remains disabled:
   `uploadCommand=null`, `uploadCommandGenerated=false`,
   `uploadCommandMaterialized=false`, `uploadCommandExposed=false`,
   `executable=false`, `liveCheckPerformed=false`, `clientCreated=false`,
   `adapterInjected=false`, `artifactBytesProvided=false`,
   `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`, and
   `remoteMutationPerformed=false`.
5. Missing, malformed, blocked, forged, command-bearing, credential-leaking,
   live-check-result-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, or object-key-copying inputs produce blocked
   or invalid results with safe blocker codes and without copying private
   values.

Validation run during this slice:

- `npm run lint`
- `node --experimental-strip-types ./test/unit/knowledge-team-upload-command-boundary.test.mjs`
- `node --experimental-strip-types ./test/contract/knowledge-team-upload-command-boundary-contract.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types ./test/integration/cli-knowledge-upload-command-boundary-main.test.mjs`
- `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `npm run test:coverage`
- `npm run verify`

Core files:

- `src/knowledge/team-upload-command-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-command-boundary.test.mjs`
- `test/contract/knowledge-team-upload-command-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-command-boundary-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Next recommended slice:

- `design-object-index-binding-boundary`. It should consume the saved upload
  command boundary and model object-store/metadata-index binding requirements
  only. It must not create SDK clients, bind concrete stores/indexes, read
  credentials, generate commands, stage bytes, write objects, write index
  entries, or perform remote mutation.

## 2026-05-10 Completed Upload Live Check Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain after
  `upload-credential-presence-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-credential-presence-boundary` and emit a
  private live-check boundary artifact that records the future live-check
  requirements needed before upload-command or mutation design.
- This slice must not read credential values, check credential presence,
  perform live backend checks, create SDK clients, inject adapters, bind object
  stores or metadata indexes, read or stage artifact bytes, generate upload
  commands, write object storage, write metadata indexes, or perform remote
  mutations.

Why this direction:

- The completed credential presence boundary only modeled future credential
  presence requirements. It did not read credential values, check credential
  presence, create clients, inject adapters, perform live checks, generate
  upload commands, or perform execution.
- The next safe step is to model live-check preconditions without probing
  backend reachability, exposing live-check results, accepting backend
  endpoints, generating commands, or touching remote state.
- This follows the `learning-claude-code` agent design lesson used in this
  project: agents hand off compact structured state; terminal and blocked
  states never advance implicitly; and permission-sensitive work is represented
  as validated contracts before implementation.

Implemented artifact and CLI:

- Artifact kind: `infra-agent.knowledge-team-upload-live-check-boundary`.
- CLI:
  `infra-agent knowledge upload-live-check-boundary <credential-presence-boundary.json> [--out <live-check-boundary.json>] [--json]`.
- Ready status is `live-check-boundary-ready`, meaning only that the saved
  credential presence boundary is safe and future live-check requirements are
  modeled. It is not backend reachability and not live probing.
- Ready next action is `design-upload-command-boundary`; blocked next action
  remains `resolve-blockers`.

Implemented acceptance criteria:

1. `live-check-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-credential-presence-boundary` with
   `credential-presence-boundary-ready`,
   `nextAction=design-live-check-boundary`, safe target references, verified
   prior review state, matched scope, mock backend posture, modeled
   credential-presence requirements, live check still required, and no
   blockers.
2. Matching credential presence boundary state is recorded as a prerequisite
   signal only; top-level `credentialValuesExposed`,
   `credentialPresenceChecked`, `credentialPresenceResultExposed`,
   `liveCheckAllowed`, `liveCheckPerformed`, `liveCheckResultExposed`,
   `clientCreated`, `adapterInjected`, `artifactBytesProvided`,
   `auditRecordCreated`, `rollbackPlanCreated`, `executionLeaseCreated`,
   `writeTokenIssued`, `mutationApprovalGranted`, `uploadApproved`,
   `uploadExecutionAllowed`, `objectWriteAttempted`,
   `metadataIndexWriteAttempted`, and `remoteMutationPerformed` remain false.
3. The output explicitly records live-check requirements for future design:
   read-only live-check policy, result redaction, credential presence boundary,
   credential read boundary, credential ref/value redaction, upload-command
   boundary, object/index dependencies, content-addressed keys, idempotent
   writes, and approval. Each required item remains unchecked, uncreated,
   uninjected, unbound, and non-executable.
4. Missing, malformed, blocked, forged, credential-value-leaking,
   credential-presence-leaking, live-check-result-leaking,
   SDK-client-leaking, adapter-leaking, byte-leaking, backend-leaking, or
   command-bearing credential presence boundary inputs produce a blocked live
   check boundary with safe blocker codes and without copying private values.
5. The CLI reads only one local credential presence boundary JSON file and
   writes only an optional local `--out` JSON artifact.
6. Existing credential presence, credential read, client creation, adapter
   injection, artifact bytes, audit record, rollback plan, execution lease,
   write-token, prerequisite plan, mutation approval review, mutation plan,
   execution gate, mock harness, continuation, and team backend no-SDK
   boundaries remain valid.

Completed commits for this slice before this closeout document update:

1. `c6ccb83` docs: plan upload live check boundary
2. `1947cfa` feat: add upload live check boundary contract
3. `88749ae` test: cover upload live check boundary ready path
4. `7147207` test: block invalid upload live check inputs
5. `d6f23b1` feat: validate upload live check boundaries
6. `95db310` test: cover upload live check validation drift
7. `f1644ad` test: cover upload live check contract
8. `6066eb0` feat: wire upload live check boundary cli
9. `10cb3cd` test: cover upload live check cli parsing
10. `78cd20d` test: cover upload live check cli
11. `d53c367` test: guard upload live check boundary no sdk

Subagent review:

- Three read-only Subagents reviewed the next-boundary plan, implementation
  checklist, and verification checklist. They all confirmed the same
  architectural constraint: `upload-live-check-boundary` is only a dry-run
  handoff artifact and must not perform a live check, create a client, read
  credentials, check credential presence, generate an upload command, or write
  remote state.

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-live-check-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-live-check-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-live-check-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed during implementation.
- Coverage:
  `npm run test:coverage` passed after code, test, rules, roadmap, skill, and
  handoff updates.
- Full final verification:
  `npm run verify` passed after code, test, rules, roadmap, skill, and handoff
  updates.

Core files changed:

- `src/knowledge/team-upload-live-check-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-live-check-boundary.test.mjs`
- `test/contract/knowledge-team-upload-live-check-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-live-check-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only a live-check boundary; it does not probe
  backend reachability, read credential values, check credential presence,
  instantiate SDK clients, inject adapters, bind object stores or metadata
  indexes, read/hash/stage bytes, generate upload commands, upload, or mutate
  remote state.
- Next safe step is `design-upload-command-boundary`: consume the saved live
  check boundary and model future upload-command requirements while keeping
  credential values, presence results, live-check results, clients, adapters,
  object writes, index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Credential Presence Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain after
  `upload-credential-read-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-credential-read-boundary` and emit a
  private credential presence boundary artifact that records the future
  credential presence-check requirements needed before live-check, command, or
  mutation design.
- This slice must not read credential values, check credential presence, create
  SDK clients, inject adapters, bind object stores or metadata indexes, read or
  stage artifact bytes, perform live checks, generate upload commands, write
  object storage, write metadata indexes, or perform remote mutations.

Why this direction:

- The completed credential read boundary only modeled future credential source
  and value-redaction requirements. It did not read credential values, check
  credential presence, create clients, inject adapters, or perform execution.
- The next safe step is to model credential-presence preconditions without
  checking credentials, exposing presence results, accepting backend details,
  accepting raw bytes, generating commands, or touching remote state.
- This follows the `learning-claude-code` agent design lesson used in this
  project: agents hand off compact structured state; terminal and blocked
  states never advance implicitly; and permission-sensitive work is represented
  as validated contracts before implementation.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-credential-presence-boundary`.
- CLI:
  `infra-agent knowledge upload-credential-presence-boundary <credential-read-boundary.json> [--out <credential-presence-boundary.json>] [--json]`.
- Ready status is `credential-presence-boundary-ready`, meaning only that
  the saved credential read boundary is safe and future credential-presence
  requirements are modeled. It is not credential access and not credential
  presence checking.
- Ready next action is `design-live-check-boundary`; blocked next action
  remains `resolve-blockers`.

Implemented acceptance criteria:

1. `credential-presence-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-credential-read-boundary` with
   `credential-read-boundary-ready`,
   `nextAction=design-credential-presence-boundary`, safe target references,
   verified prior review state, matched scope, mock backend posture, modeled
   credential-read requirements, credential presence still required, and no
   blockers.
2. Matching credential read boundary state is recorded as a prerequisite signal
   only; top-level `credentialValuesExposed`, `credentialPresenceChecked`,
   `clientCreated`, `adapterInjected`, `artifactBytesProvided`,
   `auditRecordCreated`, `rollbackPlanCreated`, `executionLeaseCreated`,
   `writeTokenIssued`, `mutationApprovalGranted`, `uploadApproved`,
   `uploadExecutionAllowed`, `objectWriteAttempted`,
   `metadataIndexWriteAttempted`, and `remoteMutationPerformed` remain false.
3. The output explicitly records credential-presence requirements for future
   design: presence signal requirement, result redaction, credential ref/value
   redaction, credential read boundary, live-check boundary, upload-command
   boundary, object/index dependencies, content-addressed keys, idempotent
   writes, and approval. Each required item remains unread, unchecked,
   uncreated, uninjected, unbound, and non-executable.
4. Missing, malformed, blocked, forged, credential-value-leaking,
   credential-presence-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, live-check, or command-bearing credential read
   boundary inputs produce a blocked credential presence boundary with safe
   blocker codes and without copying private values.
5. The CLI reads only one local credential read boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing credential read, client creation, adapter injection, artifact bytes,
   audit record, rollback plan, execution lease, write-token, prerequisite plan,
   mutation approval review, mutation plan, execution gate, mock harness,
   continuation, and team backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `affc613` docs: plan upload credential presence boundary
2. `eafd459` feat: add upload credential presence boundary contract
3. `dc6938d` test: cover upload credential presence boundary ready path
4. `c4c0ea7` test: block invalid upload credential presence inputs
5. `340d240` feat: validate upload credential presence boundaries
6. `b671125` test: cover upload credential presence validation drift
7. `1216269` test: cover upload credential presence contract
8. `ac88f88` feat: wire upload credential presence boundary cli
9. `80f67c2` test: cover upload credential presence cli parsing
10. `0b1bc0b` test: cover upload credential presence cli
11. `ccb0569` test: guard upload credential presence boundary no sdk
12. `45b4fe5` fix: allow upload credential presence validation controls

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-credential-presence-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-credential-presence-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-credential-presence-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed during implementation.
- Coverage:
  `npm run test:coverage` passed; all files reported 90.17% lines, 75.09%
  branches, and 96.90% functions. The new
  `team-upload-credential-presence-boundary.ts` file reported 100.00% lines,
  branches, and functions.
- Full final verification:
  `npm run verify` passed after code, test, rules, roadmap, skill, and handoff
  updates.

Core files changed:

- `src/knowledge/team-upload-credential-presence-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-credential-presence-boundary.test.mjs`
- `test/contract/knowledge-team-upload-credential-presence-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-credential-presence-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only a credential-presence boundary; it does not
  read credential values, check credential presence, instantiate SDK clients,
  inject adapters, bind object stores or metadata indexes, read/hash/stage
  bytes, perform live checks, generate upload commands, upload, or mutate
  remote state.
- Next safe step is `design-live-check-boundary`: consume the saved credential
  presence boundary and model future live-check requirements while keeping
  credential values, presence results, clients, adapters, commands, object
  writes, index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Credential Read Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-client-creation-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-client-creation-boundary` and emit a
  private credential read boundary artifact that records the future credential
  read requirements needed before credential presence, live-check, command, or
  mutation design.
- This slice must not read credential values, check credential presence,
  create SDK clients, inject adapters, bind object stores or metadata indexes,
  read or stage artifact bytes, perform live checks, generate upload commands,
  write object storage, write metadata indexes, or perform remote mutations.

Why this direction:

- The completed client creation boundary only modeled future client factory
  and dependency requirements. It did not create clients, inject adapters, read
  credentials, check credential presence, or perform execution.
- The next safe step is to model credential-read preconditions without reading
  environment variables, credential files, secret stores, backend details,
  credential presence, clients, adapters, live checks, or mutation commands.
- This follows the `learning-claude-code` agent design lesson used in this
  project: handoff between agents is compact structured state; terminal and
  blocked states never advance implicitly; and permission-sensitive work is
  represented as validated contracts before implementation.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-credential-read-boundary`.
- CLI:
  `infra-agent knowledge upload-credential-read-boundary <client-creation-boundary.json> [--out <credential-read-boundary.json>] [--json]`.
- Ready status is `credential-read-boundary-ready`, meaning only that
  the saved client creation boundary is safe and future credential-read
  requirements are modeled. It is not credential access and not credential
  presence checking.
- Ready next action is `design-credential-presence-boundary`; blocked
  next action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `credential-read-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-client-creation-boundary` with
   `client-creation-boundary-ready`,
   `nextAction=design-credential-read-boundary`, safe target references,
   verified prior review state, matched scope, mock adapter backend posture,
   modeled client-creation requirements, credential read still required, and
   no blockers.
2. Matching client creation boundary state is recorded as a prerequisite signal
   only; top-level `credentialValuesExposed`, `credentialPresenceChecked`,
   `clientCreated`, `adapterInjected`, `artifactBytesProvided`,
   `auditRecordCreated`, `rollbackPlanCreated`, `executionLeaseCreated`,
   `writeTokenIssued`, `mutationApprovalGranted`, `uploadApproved`, and
   `uploadExecutionAllowed` remain false.
3. The output explicitly records credential-read requirements for future
   design: credential source descriptor, credential value redaction,
   environment/key reference only posture, credential presence boundary,
   live-check boundary, upload-command boundary, client creation boundary, and
   object/index mutation disabled. Each required item remains unread,
   unchecked, uncreated, uninjected, unbound, and non-executable.
4. Mismatched, missing, malformed, blocked, forged, credential-value-leaking,
   credential-presence-leaking, SDK-client-leaking, adapter-leaking,
   byte-leaking, backend-leaking, live-check, or command-bearing client
   creation boundary inputs produce a blocked credential read boundary with
   safe blocker codes and without copying private values.
5. The CLI reads only one local client creation boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing client creation, adapter injection, artifact bytes, audit record,
   rollback plan, execution lease, write-token, prerequisite plan, mutation
   approval review, mutation plan, execution gate, mock harness, continuation,
   and team backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `e53e386` docs: plan upload credential read boundary
2. `d48156f` feat: add upload credential read boundary contract
3. `d8fda2f` test: cover upload credential read boundary ready path
4. `6c4c636` test: block invalid upload credential read inputs
5. `5f2c28f` feat: validate upload credential read boundaries
6. `9bd78e8` test: cover upload credential read validation drift
7. `ded557b` test: cover upload credential read contract
8. `1fed2f2` feat: wire upload credential read boundary cli
9. `12869f7` test: cover upload credential read cli parsing
10. `52499b6` test: cover upload credential read cli
11. `0d43543` test: guard upload credential read boundary no sdk
12. `11b2fb1` test: cover credential read ready prerequisite drift

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-credential-read-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-credential-read-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-credential-read-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed during implementation.
- Coverage:
  `npm run test:coverage` passed after the credential read ready-prerequisite
  drift test; all files reported 89.98% lines, 75.04% branches, and 96.87%
  functions.
- Full final verification:
  `npm run verify` passed after code, test, rules, roadmap, skill, and handoff
  updates.

Core files changed:

- `src/knowledge/team-upload-credential-read-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-credential-read-boundary.test.mjs`
- `test/contract/knowledge-team-upload-credential-read-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-credential-read-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only a credential-read boundary; it does not read
  credential values, check credential presence, instantiate SDK clients, inject
  adapters, bind object stores or metadata indexes, read/hash/stage bytes,
  perform live checks, generate upload commands, upload, or mutate remote
  state.
- Next safe step is `design-credential-presence-boundary`: consume the saved
  credential read boundary and model future credential presence requirements
  while keeping credential value reads, clients, adapters, live checks,
  commands, object writes, index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Client Creation Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-adapter-injection-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-adapter-injection-boundary` and emit a
  private client creation boundary artifact that records the future client
  creation requirements needed before credential, live-check, command, or
  mutation design.
- This slice must not create SDK clients, inject adapters, bind object stores
  or metadata indexes, read or stage artifact bytes, verify artifact digests,
  read credentials, check credential presence, perform live checks, generate
  upload commands, write object storage, write metadata indexes, or perform
  remote mutations.

Why this direction:

- The completed adapter injection boundary only modeled dependency-injection
  requirements. It did not inject adapters or create clients and deliberately
  advanced to client-creation boundary design.
- The next safe step is to model client creation preconditions without
  accepting SDK clients, client configs, adapter instances, backend details,
  credential material, live checks, or mutation commands.
- This follows the `learning-claude-code` agent design lesson used in this
  project: subagents and tasks pass compact structured state, terminal or
  blocked states do not advance implicitly, and handoff artifacts must be
  validated contracts rather than prose-only assumptions.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-client-creation-boundary`.
- CLI:
  `infra-agent knowledge upload-client-creation-boundary <adapter-injection-boundary.json> [--out <client-creation-boundary.json>] [--json]`.
- Ready status is `client-creation-boundary-ready`, meaning only that
  the saved adapter injection boundary is safe and future client-creation
  requirements are modeled. It is not client creation and not credential
  access.
- Ready next action is `design-credential-read-boundary`; blocked next
  action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `client-creation-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-adapter-injection-boundary` with
   `adapter-injection-boundary-ready`,
   `nextAction=design-client-creation-boundary`, safe target references,
   verified prior review state, matched scope, mock adapter backend posture,
   modeled adapter dependency requirements, client creation still required, and
   no blockers.
2. Matching adapter injection boundary state is recorded as a prerequisite
   signal only; top-level `clientCreated`, `adapterInjected`,
   `artifactBytesProvided`, `auditRecordCreated`, `rollbackPlanCreated`,
   `executionLeaseCreated`, `writeTokenIssued`, `mutationApprovalGranted`,
   `uploadApproved`, and `uploadExecutionAllowed` remain false.
3. The output explicitly records client-creation requirements for future
   design: client factory descriptor, mock backend posture, adapter dependency
   prerequisites, credential-read boundary, credential-presence boundary,
   live-check boundary, upload-command boundary, and object/index mutation
   disabled. Each required item remains uncreated, unchecked, unbound, and
   non-executable.
4. Mismatched, missing, malformed, blocked, forged, SDK-client-leaking,
   adapter-leaking, byte-leaking, backend-leaking, credential-leaking,
   live-check, or command-bearing adapter injection boundary inputs produce a
   blocked client creation boundary with safe blocker codes and without copying
   private values.
5. The CLI reads only one local adapter injection boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing adapter injection, artifact bytes, audit record, rollback plan,
   execution lease, write-token, prerequisite plan, mutation approval review,
   mutation plan, execution gate, mock harness, continuation, and team backend
   no-SDK boundaries remain valid.

Completed commits for this slice:

1. `9549ed4` docs: plan upload client creation boundary
2. `a843c80` feat: add upload client creation boundary contract
3. `f6f42f8` test: cover upload client creation boundary ready path
4. `f05d368` test: block invalid upload client creation inputs
5. `9c1b23d` feat: validate upload client creation boundaries
6. `565c3b3` test: cover upload client creation validation drift
7. `7ba2805` test: cover upload client creation contract
8. `2cc89a5` feat: wire upload client creation boundary cli
9. `d9aa0a9` test: cover upload client creation cli parsing
10. `6dc5ed6` test: cover upload client creation cli
11. `82fb6ff` test: guard upload client creation boundary no sdk

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-client-creation-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-client-creation-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-client-creation-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed during implementation.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds:
  89.78% lines, 75.01% branches, and 96.83% functions.
- Full final verification:
  `npm run verify` passed after code, test, and documentation updates.

Core files changed:

- `src/knowledge/team-upload-client-creation-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-client-creation-boundary.test.mjs`
- `test/contract/knowledge-team-upload-client-creation-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-client-creation-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only a client-creation boundary; it does not
  instantiate SDK clients, inject adapters, bind object stores or metadata
  indexes, read credentials, check credential presence, perform live checks,
  generate upload commands, read/hash/stage bytes, upload, or mutate remote
  state.
- Next safe step is `design-credential-read-boundary`: consume the saved
  client creation boundary and model future credential-read requirements while
  keeping credential values, credential presence checks, live checks, commands,
  clients, adapters, object writes, index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Adapter Injection Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-artifact-bytes-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-artifact-bytes-boundary` and emit a
  private adapter injection boundary artifact that records the future
  dependency-injection requirements needed before any later client or execution
  design.
- This slice must not inject adapters, create clients, read or stage artifact
  bytes, verify artifact digests, create audit records, create rollback plans,
  create execution leases, issue write tokens, grant approvals, read
  credentials, perform live checks, generate upload commands, write object
  storage, write metadata indexes, or perform remote mutations.

Why this direction:

- The completed artifact bytes boundary only modeled byte-staging requirements.
  It did not read, hash, stage, or provide bytes and deliberately advanced to
  adapter-injection boundary design.
- The next safe step is to model adapter injection preconditions without
  accepting adapter instances, SDK clients, backend configs, credential
  material, live checks, or mutation commands.
- This preserves the Claude Code-style permission model: compact routing state,
  explicit next actions, no implicit mutation, and fail-closed validation for
  malformed, forged, adapter/client-leaking, byte-leaking, or backend-leaking
  inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-adapter-injection-boundary`.
- CLI:
  `infra-agent knowledge upload-adapter-injection-boundary <artifact-bytes-boundary.json> [--out <adapter-injection-boundary.json>] [--json]`.
- Ready status is `adapter-injection-boundary-ready`, meaning only that
  the saved artifact bytes boundary is safe and future adapter-injection
  requirements are modeled. It is not adapter injection and not client creation.
- Ready next action is `design-client-creation-boundary`; blocked next
  action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `adapter-injection-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-artifact-bytes-boundary` with
   `artifact-bytes-boundary-ready`,
   `nextAction=design-adapter-injection-boundary`, safe target references,
   verified prior review state, matched scope, mock adapter backend posture,
   modeled artifact-byte, token, lease, rollback, and audit requirements, and
   no blockers.
2. Matching artifact bytes boundary state is recorded as a prerequisite signal
   only; top-level `adapterInjected`, `clientCreated`,
   `artifactBytesProvided`, `auditRecordCreated`, `rollbackPlanCreated`,
   `executionLeaseCreated`, `writeTokenIssued`, `mutationApprovalGranted`,
   `uploadApproved`, and `uploadExecutionAllowed` remain false.
3. The output explicitly records adapter-injection requirements for future
   dependency injection: mock adapter dependency, dependency-injection-only
   posture, bytes-before-adapter precondition, client-after-adapter
   precondition, audit/rollback/lease/token preconditions, and object/index
   mutation disabled. Each required item remains uninjected, uncreated,
   unprovided, and non-executable.
4. Mismatched, missing, malformed, blocked, forged, adapter-leaking,
   client-leaking, byte-leaking, backend-leaking, or command-bearing artifact
   bytes boundary inputs produce a blocked adapter injection boundary with safe
   blocker codes and without copying private values.
5. The CLI reads only one local artifact bytes boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing artifact bytes, audit record, rollback plan, execution lease,
   write-token, prerequisite plan, mutation approval review, mutation plan,
   execution gate, mock harness, continuation, and team backend no-SDK
   boundaries remain valid.

Completed commits for this slice:

1. `2a9ecdf` docs: plan upload adapter injection boundary
2. `1e51829` feat: add upload adapter injection boundary contract
3. `ea6ac5d` test: cover upload adapter injection boundary ready path
4. `90a5ead` test: block invalid upload adapter injection inputs
5. `5514d2f` feat: validate upload adapter injection boundaries
6. `a23b14c` test: cover upload adapter injection validation drift
7. `7878f2e` test: cover upload adapter injection contract
8. `db41732` feat: wire upload adapter injection boundary cli
9. `dbc6d28` test: cover upload adapter injection cli parsing
10. `9b03764` test: cover upload adapter injection cli
11. `dfc74da` test: guard upload adapter injection boundary no sdk

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-adapter-injection-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-adapter-injection-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-adapter-injection-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds; the new
  `team-upload-adapter-injection-boundary.ts` file reports 100.00% line,
  branch, and function coverage.
- Full final verification:
  `npm run verify` passed after code, test, and documentation updates.

Core files changed:

- `src/knowledge/team-upload-adapter-injection-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-adapter-injection-boundary.test.mjs`
- `test/contract/knowledge-team-upload-adapter-injection-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-adapter-injection-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only an adapter-injection boundary; it does not
  instantiate adapters, inject dependencies, bind object stores or metadata
  indexes, create clients, read/hash/stage bytes, upload, or mutate remote
  state.
- Next safe step is `design-client-creation-boundary`: consume the saved
  adapter injection boundary and model future client creation preconditions
  while keeping clients, credentials, live checks, commands, object writes,
  index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Artifact Bytes Boundary

Status:

- Completed. This slice continues the private dry-run upload boundary chain
  after `upload-audit-record-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-audit-record-boundary` and emit a private
  artifact bytes boundary artifact that records the future artifact-byte
  staging requirements needed before any later adapter or execution design.
- This slice must not read, hash, stage, or provide artifact bytes. It also
  must not create audit records, rollback plans, execution leases, write
  tokens, approvals, adapters, clients, credential reads, live checks, upload
  commands, object writes, index writes, or remote mutations.

Why this direction:

- The completed audit record boundary only modeled audit requirements. It did
  not create an audit record and deliberately advanced to artifact-byte boundary
  design.
- The next safe step is to model byte-staging preconditions without accepting
  raw bytes, local paths, hash work, adapters, clients, or backend mutation.
- This preserves the Claude Code-style permission model: compact routing state,
  explicit next actions, no implicit mutation, and fail-closed validation for
  malformed, forged, byte-leaking, or backend-leaking inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-artifact-bytes-boundary`.
- CLI:
  `infra-agent knowledge upload-artifact-bytes-boundary <audit-record-boundary.json> [--out <artifact-bytes-boundary.json>] [--json]`.
- Ready status is `artifact-bytes-boundary-ready`, meaning only that the
  saved audit boundary is safe and future artifact-byte requirements are
  modeled. It is not byte staging and not execution readiness.
- Ready next action is `design-adapter-injection-boundary`; blocked next
  action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `artifact-bytes-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-audit-record-boundary` with
   `audit-record-boundary-ready`,
   `nextAction=design-artifact-bytes-boundary`, safe target references,
   verified prior review state, matched scope, modeled token, lease, rollback,
   audit, and artifact-byte requirements, and no blockers.
2. Matching audit boundary state is recorded as a prerequisite signal only;
   top-level `artifactBytesProvided`, `adapterInjected`, `auditRecordCreated`,
   `rollbackPlanCreated`, `executionLeaseCreated`, `writeTokenIssued`,
   `mutationApprovalGranted`, `uploadApproved`, and `uploadExecutionAllowed`
   remain false.
3. The output explicitly records artifact-byte requirements for future staging:
   bytes required before adapter/execution, artifact scope binding, digest
   verification, audit precondition, rollback precondition, lease precondition,
   write-token precondition, and adapter-injection precondition. Each required
   item remains unprovided, unbound, unverified, and uncreated.
4. Mismatched, missing, malformed, blocked, forged, or leaky audit boundary
   inputs produce a blocked artifact bytes boundary with safe blocker codes and
   without copying private values.
5. The CLI reads only one local audit record boundary JSON file and writes only
   an optional local `--out` JSON artifact.
6. Existing audit record, rollback plan, execution lease, write-token,
   prerequisite plan, mutation approval review, mutation plan, execution gate,
   mock harness, continuation, and team backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `1425efb` docs: plan upload artifact bytes boundary
2. `94fb600` feat: add upload artifact bytes boundary contract
3. `bbb6a22` test: cover upload artifact bytes boundary ready path
4. `e3bcf89` test: block invalid upload artifact bytes inputs
5. `08617e6` test: guard upload artifact bytes boundary
6. `e47ab40` feat: validate upload artifact bytes boundaries
7. `908deee` feat: dispatch upload artifact bytes validation
8. `6a1b8f8` test: cover upload artifact bytes validation drift
9. `2b909af` test: cover upload artifact bytes contract
10. `aa5bb1c` feat: wire upload artifact bytes boundary cli
11. `2320684` test: cover upload artifact bytes cli parsing
12. `6d10cc4` test: cover upload artifact bytes cli
13. `ecc09f0` test: guard upload artifact bytes boundary no sdk

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-artifact-bytes-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-artifact-bytes-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-artifact-bytes-boundary-main.test.mjs`
- Parser/help/no-SDK:
  `node --experimental-strip-types ./test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types ./test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types ./test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds; the new
  `team-upload-artifact-bytes-boundary.ts` file reports 100.00% line, branch,
  and function coverage.
- Full final verification:
  `npm run verify` passed after code, test, and documentation updates.

Core files changed:

- `src/knowledge/team-upload-artifact-bytes-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-artifact-bytes-boundary.test.mjs`
- `test/contract/knowledge-team-upload-artifact-bytes-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-artifact-bytes-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only an artifact-byte boundary; it does not read,
  hash, stage, upload, or provide artifact bytes.
- Next safe step is `design-adapter-injection-boundary`: consume the saved
  artifact bytes boundary and model future adapter injection preconditions while
  keeping bytes, clients, credentials, live checks, commands, object writes,
  index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Audit Record Boundary

Status:

- Completed. This slice adds the next private dry-run boundary after
  `upload-rollback-plan-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-rollback-plan-boundary` and emit a
  private audit record boundary artifact that records audit requirements needed
  before any future upload execution design can proceed.
- This slice does not create audit records, create rollback plans, create
  execution leases, issue write tokens, grant mutation approval, allow upload
  execution, stage artifact bytes, inject adapters, create SDK clients, read
  credential values, check credential presence, perform live checks, generate
  upload commands, mutate object storage, or mutate a metadata index.

Why this direction:

- The completed rollback plan boundary only modeled the rollback contract. It
  did not create a rollback plan and deliberately advanced to audit-record
  boundary design.
- The next safe step is to isolate audit-record planning before any artifact
  bytes, adapter injection, client, or backend mutation design exists.
- This preserves the Claude Code-style permission model: compact routing state,
  explicit next actions, no implicit mutation, and fail-closed validation for
  malformed, forged, or leaky inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-audit-record-boundary`.
- CLI:
  `infra-agent knowledge upload-audit-record-boundary <rollback-plan-boundary.json> [--out <audit-record-boundary.json>] [--json]`.
- Ready status is `audit-record-boundary-ready`, meaning only that the source
  rollback plan boundary is safe and the future audit requirements are
  modeled. It is not audit record creation and not execution readiness.
- Ready next action is expected to be `design-artifact-bytes-boundary`; blocked
  next action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `audit-record-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-rollback-plan-boundary` with
   `rollback-plan-boundary-ready`,
   `nextAction=design-audit-record-boundary`, safe target references, verified
   prior review state, matched scope, modeled token requirements, modeled lease
   requirements, and modeled rollback requirements.
2. Matching rollback boundary state is recorded as a prerequisite signal only;
   top-level `auditRecordCreated`, `rollbackPlanCreated`,
   `executionLeaseCreated`, `writeTokenIssued`, `mutationApprovalGranted`,
   `uploadApproved`, and `uploadExecutionAllowed` remain false.
3. The output explicitly records audit record requirements: audit required
   before execution, artifact scope binding, audit review, token precondition,
   lease precondition, rollback precondition, and artifact-byte precondition.
   Each required item remains uncreated/unbound.
4. Mismatched, missing, malformed, blocked, forged, or leaky rollback plan
   boundary inputs produce a blocked audit record boundary with safe blocker
   codes and without copying private values.
5. The CLI reads only one local rollback plan boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing rollback plan boundary, execution lease boundary, write-token
   boundary, prerequisite plan, mutation approval review, mutation plan,
   execution gate, mock harness, continuation, and team backend no-SDK
   boundaries remain valid.

Verification performed during the slice:

- Focused builder/unit:
  `node --experimental-strip-types ./test/unit/knowledge-team-upload-audit-record-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types ./test/contract/knowledge-team-upload-audit-record-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types ./test/integration/cli-knowledge-upload-audit-record-boundary-main.test.mjs`
- CLI import/help checks:
  `node --experimental-strip-types -e "import('./src/cli/main.ts').then(() => console.log('cli import ok'))"`
  and `node --experimental-strip-types ./src/cli/main.ts --help`
- Full final verification:
  `npm run verify` passed after adding validator drift coverage; coverage
  finished above thresholds at approximately 89.30% lines, 75.06% branches,
  and 96.73% functions.

Core files changed:

- `src/knowledge/team-upload-audit-record-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-audit-record-boundary.test.mjs`
- `test/contract/knowledge-team-upload-audit-record-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-audit-record-boundary-main.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Current remaining risk:

- The artifact still models only an audit-record boundary; it does not produce
  audit content, verify persisted audit records, load artifact bytes, inject
  adapters, issue write tokens, create leases, or execute uploads.
- Next safe step is `design-artifact-bytes-boundary`: consume the saved audit
  record boundary and model the future local artifact-byte staging
  preconditions while keeping adapters, clients, credentials, live checks,
  commands, object writes, index writes, and remote mutation disabled.

## 2026-05-10 Completed Upload Rollback Plan Boundary

Status:

- Completed. This slice adds the next private dry-run boundary after
  `upload-execution-lease-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-lease-boundary` and emit a
  private rollback plan boundary artifact that records rollback requirements
  needed before any future upload execution design can proceed.
- This slice does not create rollback plans, create execution leases, issue
  write tokens, grant mutation approval, allow upload execution, stage artifact
  bytes, inject adapters, create SDK clients, read credential values, check
  credential presence, perform live checks, generate upload commands, mutate
  object storage, or mutate a metadata index.

Why this direction:

- The completed execution lease boundary only modeled the lease contract. It
  did not create a lease and deliberately advanced to rollback-plan boundary
  design.
- The next safe step is to isolate rollback planning before any audit,
  adapter, artifact-byte, or backend mutation design exists.
- This preserves the Claude Code-style permission model: compact routing state,
  explicit next actions, no implicit mutation, and fail-closed validation for
  malformed, forged, or leaky inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-rollback-plan-boundary`.
- CLI:
  `infra-agent knowledge upload-rollback-plan-boundary <execution-lease-boundary.json> [--out <rollback-plan-boundary.json>] [--json]`.
- Ready status is `rollback-plan-boundary-ready`, meaning only that the source
  execution lease boundary is safe and the future rollback requirements are
  modeled. It is not rollback creation and not execution readiness.
- Ready next action is expected to be `design-audit-record-boundary`; blocked
  next action remains `resolve-blockers`.

Implemented acceptance criteria:

1. `rollback-plan-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-lease-boundary` with
   `execution-lease-boundary-ready`,
   `nextAction=design-rollback-plan-boundary`, safe target references, verified
   prior review state, matched scope, modeled token requirements, and modeled
   lease requirements.
2. Matching execution lease state is recorded as a prerequisite signal only;
   top-level `rollbackPlanCreated`, `executionLeaseCreated`,
   `writeTokenIssued`, `mutationApprovalGranted`, `uploadApproved`, and
   `uploadExecutionAllowed` remain false.
3. The output explicitly records rollback plan requirements: rollback required
   before execution, artifact scope binding, rollback scope review, audit
   binding, token precondition, lease precondition, and artifact-byte
   precondition. Each required item remains uncreated/unbound.
4. Mismatched, missing, malformed, blocked, forged, or leaky execution lease
   boundary inputs produce a blocked rollback plan boundary with safe blocker
   codes and without copying private values.
5. The CLI reads only one local execution lease boundary JSON file and writes
   only an optional local `--out` JSON artifact.
6. Existing upload execution lease boundary, write-token boundary,
   prerequisite plan, mutation approval review, mutation plan, execution gate,
   mock harness, continuation, and team backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `91993c1` docs: record upload rollback plan boundary plan
2. `df5a588` feat: add upload rollback plan boundary contract
3. `1bbfbd4` test: cover upload rollback plan boundary ready path
4. `8188e64` test: block unsafe upload rollback plan inputs
5. `45db6d8` test: guard upload rollback plan boundary
6. `970b46b` feat: validate upload rollback plan boundaries
7. `0467d2a` test: cover upload rollback plan boundary contract
8. `704455d` feat: parse upload rollback plan boundary args
9. `16c0cae` feat: wire upload rollback plan boundary cli
10. `3f6a2e1` test: cover upload rollback plan boundary cli
11. `303f0a8` docs: document upload rollback plan boundary

Verification completed before this handoff update:

- Focused unit:
  `node --experimental-strip-types test/unit/knowledge-team-upload-rollback-plan-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types test/contract/knowledge-team-upload-rollback-plan-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types test/integration/cli-knowledge-upload-rollback-plan-boundary-main.test.mjs`
- Focused parser/help/no-SDK:
  `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Documentation script check:
  `npm run validate:content` is not available in this package; `npm run`
  confirms the current scripts are lint/test/verify/package gates.
- Lint:
  `npm run lint` passed.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds; the new
  `team-upload-rollback-plan-boundary.ts` file reports 97.95% line, 95.00%
  branch, and 100.00% function coverage.
- Full gate:
  `npm run verify` passed after code, test, and documentation updates.

Key files changed:

- `src/knowledge/team-upload-rollback-plan-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-rollback-plan-boundary.test.mjs`
- `test/contract/knowledge-team-upload-rollback-plan-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-rollback-plan-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Subagent review alignment:

- Architecture, implementation, and test review subagents all converged on the
  same non-goal: rollback-plan boundary must not become rollback-plan
  creation. The implemented artifact keeps `rollbackPlanCreated=false` at the
  top level, in `rollbackPlanBoundary`, and in remaining execution boundaries.
- Review notes recommended consuming exactly one saved execution lease boundary
  and keeping status/next-action explicit. The implementation uses
  `rollback-plan-boundary-ready` and advances only to
  `design-audit-record-boundary`.
- Test review asked for ready, blocked, forged-state, leak, validator,
  contract, CLI, help, and no-SDK coverage; those checks are now present.

Current remaining risks:

- There is still no real rollback artifact, audit writer, token issuer,
  execution lease implementation, adapter injection, artifact byte handoff, or
  backend mutation.
- The upload chain remains intentionally private and dry-run. A
  `rollback-plan-boundary-ready` artifact is only a prerequisite signal for the
  next audit-record boundary, not executable authorization.

Next recommended stage:

- Design a separate audit-record boundary artifact that consumes the rollback
  plan boundary as a prerequisite signal only. It should keep audit record
  creation, rollback creation, lease creation, token issuance, adapter
  injection, artifact byte handoff, object/index writes, SDK clients,
  credential reads, live checks, upload commands, and upload execution
  disabled until each is split into explicit future boundaries.

## 2026-05-10 Completed Upload Execution Lease Boundary

Status:

- Completed and verified. This slice adds the next private dry-run boundary
  after `upload-write-token-boundary`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-write-token-boundary` and emit a private
  execution lease boundary artifact that records lease requirements needed
  before any future upload execution design can proceed.
- This slice does not create execution leases, issue write tokens, grant
  mutation approval, allow upload execution, stage artifact bytes, create
  rollback plans, inject adapters, create SDK clients, read credential values,
  check credential presence, perform live checks, generate upload commands,
  mutate object storage, or mutate a metadata index.

Why this direction:

- The completed write-token boundary only modeled the token contract. It did
  not issue a token and deliberately advanced to execution lease boundary
  design.
- The safe next step was to isolate the execution lease boundary before any
  rollback, audit, adapter, artifact-byte, or backend mutation design exists.
- This keeps the Claude Code-style permission model intact: compact state,
  explicit next actions, no implicit mutation, and fail-closed validation for
  malformed, forged, or leaky inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-lease-boundary`.
- CLI:
  `infra-agent knowledge upload-execution-lease-boundary <write-token-boundary.json> [--out <execution-lease-boundary.json>] [--json]`.
- Ready status is `execution-lease-boundary-ready`, meaning only that the
  source write-token boundary is safe and the future execution lease
  requirements are modeled. It is not lease creation and not execution
  readiness.

Implemented acceptance criteria:

1. `execution-lease-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-write-token-boundary` with
   `write-token-boundary-ready`, `nextAction=design-execution-lease-boundary`,
   safe target references, verified prior review state, matched scope, and
   modeled token requirements.
2. Matching write-token state is recorded as a prerequisite signal only;
   top-level `executionLeaseCreated`, `writeTokenIssued`,
   `mutationApprovalGranted`, `uploadApproved`, and `uploadExecutionAllowed`
   remain false.
3. The output explicitly records execution lease requirements: lease required
   before execution, artifact scope binding, single-use semantics, expiry
   policy, token precondition, audit binding, and rollback precondition. Each
   required item remains uncreated/unissued/unbound.
4. Mismatched, missing, malformed, blocked, forged, or leaky write-token
   boundary inputs produce a blocked execution lease boundary with safe blocker
   codes and without copying private values.
5. The CLI reads only one local write-token boundary JSON file and writes only
   an optional local `--out` JSON artifact.
6. Existing upload write-token boundary, prerequisite plan, mutation approval
   review, mutation plan, execution gate, mock harness, continuation, and team
   backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `d395fff` docs: record upload execution lease boundary plan
2. `f12bb3a` feat: add upload execution lease boundary contract
3. `08987b6` test: cover upload execution lease boundary ready path
4. `0e2a7f1` test: block unsafe upload execution lease inputs
5. `5edfdaa` test: guard upload execution lease boundary
6. `9adc41d` feat: validate upload execution lease boundaries
7. `649e102` test: cover upload execution lease boundary contract
8. `aec61df` feat: parse upload execution lease boundary args
9. `217ae33` feat: wire upload execution lease boundary cli
10. `c346865` test: cover upload execution lease boundary cli
11. `595eb82` docs: document upload execution lease boundary

Verification completed:

- Focused unit:
  `node --experimental-strip-types test/unit/knowledge-team-upload-execution-lease-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types test/contract/knowledge-team-upload-execution-lease-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-lease-boundary-main.test.mjs`
- Focused parser/help/no-SDK:
  `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds; the new
  `team-upload-execution-lease-boundary.ts` file reports 100% line, branch, and
  function coverage.
- Full gate:
  `npm run verify` passed after code, test, and documentation updates.

Key files changed:

- `src/knowledge/team-upload-execution-lease-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-lease-boundary.test.mjs`
- `test/contract/knowledge-team-upload-execution-lease-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-lease-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Subagent review alignment:

- Architecture, implementation, and test review subagents agreed on the core
  direction: consume only a saved write-token boundary, model lease
  requirements, keep token issuance and lease creation false, and advance to a
  separate rollback-plan boundary.
- Minor naming differences from review notes were resolved in favor of the
  existing project style: the implemented nested section uses
  `executionLeaseBoundary.executionLeaseRequiredBeforeExecution` and
  `executionLeaseBoundary.executionLeaseCreated` to stay aligned with existing
  `executionLeaseCreated` field naming across the upload chain.

Current remaining risks:

- There is still no real token issuer, execution lease implementation, rollback
  artifact, audit writer, adapter injection, artifact byte handoff, or backend
  mutation.
- The upload chain remains intentionally private and dry-run. An
  `execution-lease-boundary-ready` artifact is only a prerequisite signal for
  the next boundary, not executable authorization.

Next recommended stage:

- Design a separate rollback plan boundary artifact that consumes the execution
  lease boundary as a prerequisite signal only. It should keep lease creation,
  token issuance, rollback creation, adapter injection, artifact byte handoff,
  object/index writes, SDK clients, credential reads, live checks, upload
  commands, and upload execution disabled until each is split into explicit
  future boundaries.

## 2026-05-10 Completed Upload Write Token Boundary

Status:

- Completed and verified. This slice adds the next private dry-run boundary after
  `upload-execution-prerequisite-plan`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-execution-prerequisite-plan` and emit a
  private write-token boundary artifact that records the token requirements
  needed before any future upload execution design can proceed.
- This slice does not issue write tokens, grant mutation approval, allow upload
  execution, create execution leases, stage artifact bytes, create rollback
  plans, inject adapters, create SDK clients, read credential values, check
  credential presence, perform live checks, generate upload commands, mutate
  object storage, or mutate a metadata index.

Why this direction:

- The completed prerequisite plan made future boundaries explicit. The next
  safe step is to isolate the write-token boundary before any lease, rollback,
  audit, adapter, artifact-byte, or mutation design exists.
- A ready write-token boundary must mean "token requirements are modeled", not
  "a token exists" and not "upload execution is allowed".
- This preserves the Claude Code-style permission-gate pattern already used in
  the upload chain: each boundary is a compact artifact, has validator coverage,
  and fails closed on malformed, forged, or leaky inputs.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-write-token-boundary`.
- CLI:
  `infra-agent knowledge upload-write-token-boundary <execution-prerequisite-plan.json> [--out <write-token-boundary.json>] [--json]`.
- Ready status is `write-token-boundary-ready`, meaning only that the source
  prerequisite plan is safe and the future write-token requirements are
  modeled. It is not token issuance and not execution readiness.

Implemented acceptance criteria:

1. `write-token-boundary-ready` requires a valid
   `infra-agent.knowledge-team-upload-execution-prerequisite-plan` with
   `prerequisite-plan-ready`, `nextAction=design-write-token-boundary`, safe
   target references, verified human review state, matched scope, and
   `writeTokenRequiredBeforeExecution=true`.
2. Matching prerequisite state is recorded as a prerequisite signal only;
   top-level `writeTokenIssued`, `mutationApprovalGranted`, `uploadApproved`,
   and `uploadExecutionAllowed` remain false.
3. The output explicitly records write-token requirements: token scope binding,
   single-use semantics, expiry policy, audit binding, lease precondition, and
   rollback precondition. Each required item remains unissued/uncreated.
4. Mismatched, missing, malformed, blocked, forged, or leaky prerequisite inputs
   produce a blocked write-token boundary with safe blocker codes and without
   copying private values.
5. The CLI reads only one local prerequisite plan JSON file and writes only an
   optional local `--out` JSON artifact.
6. Existing upload prerequisite plan, mutation approval review, mutation plan,
   execution gate, mock harness, continuation, and team backend no-SDK
   boundaries remain valid.

Completed commits for this slice:

1. `4aa3faf` docs: record upload write token boundary plan
2. `31f729d` feat: add upload write token boundary contract
3. `f159f92` test: cover upload write token boundary ready path
4. `a27fd39` test: block unsafe upload write token inputs
5. `536c6b7` test: guard upload write token boundary
6. `6fdf453` feat: validate upload write token boundaries
7. `27e965b` test: cover upload write token boundary contract
8. `6d8ca36` feat: parse upload write token boundary args
9. `05a52ab` feat: wire upload write token boundary cli
10. `3e922cd` test: cover upload write token boundary cli
11. `b7673f2` test: guard upload write token boundary surface
12. `f196fc8` docs: document upload write token boundary

Verification completed:

- Focused unit:
  `node --experimental-strip-types test/unit/knowledge-team-upload-write-token-boundary.test.mjs`
- Focused contract:
  `node --experimental-strip-types test/contract/knowledge-team-upload-write-token-boundary-contract.test.mjs`
- Focused CLI:
  `node --experimental-strip-types test/integration/cli-knowledge-upload-write-token-boundary-main.test.mjs`
- Focused parser/help/no-SDK:
  `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
  `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
  `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Lint:
  `npm run lint` passed.
- Coverage:
  `npm run test:coverage` passed with total coverage above thresholds; the new
  `team-upload-write-token-boundary.ts` file reports 100% line, branch, and
  function coverage.
- Full gate:
  `npm run verify` passed after code, test, and documentation updates.
- Note: `npm run validate:content` and `npm run validate:pages` were attempted
  but are not defined scripts in this package.

Key files changed:

- `src/knowledge/team-upload-write-token-boundary.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-write-token-boundary.test.mjs`
- `test/contract/knowledge-team-upload-write-token-boundary-contract.test.mjs`
- `test/integration/cli-knowledge-upload-write-token-boundary-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-core-main.test.mjs`
- `test/unit/knowledge-team-backend-no-sdk.test.mjs`

Current remaining risks:

- There is still no real token issuer, execution lease, rollback artifact,
  audit writer, adapter injection, artifact byte handoff, or backend mutation.
- The upload chain remains intentionally private and dry-run. A
  `write-token-boundary-ready` artifact is only a prerequisite signal for the
  next boundary, not executable authorization.

Next recommended stage:

- Design a separate execution lease boundary artifact that consumes the
  write-token boundary as a prerequisite signal only. It should keep token
  issuance, lease creation, rollback planning, adapter injection, artifact byte
  handoff, object/index writes, SDK clients, credential reads, live checks, and
  upload commands disabled until each is split into explicit future boundaries.

## 2026-05-10 Completed Upload Execution Prerequisite Plan

Status:

- Completed and verified. This slice adds the next private dry-run boundary after
  `upload-mutation-approval-review`.
- Scope is local JSON planning only: consume one saved
  `infra-agent.knowledge-team-upload-mutation-approval-review` and emit a
  private execution prerequisite plan that records which boundaries must exist
  before any future upload execution can be designed.
- This slice does not grant mutation approval, allow upload execution, issue
  write tokens, create execution leases, stage artifact bytes, create rollback
  plans, inject adapters, create SDK clients, read credential values, check
  credential presence, perform live checks, generate upload commands, mutate
  object storage, or mutate a metadata index.

Why this direction:

- The previous review artifact records only that a human reviewed the exact
  mutation-plan fingerprint. It is a prerequisite signal, not execution
  authority.
- The next safe step is to make the execution prerequisites explicit and
  contract-validated before any separate token, lease, rollback, audit, adapter,
  artifact-byte, or backend mutation design exists.
- This keeps planning, human review, prerequisite modeling, and actual mutation
  execution as separate artifacts and commands.

Implemented artifact and CLI:

- Artifact kind:
  `infra-agent.knowledge-team-upload-execution-prerequisite-plan`.
- CLI:
  `infra-agent knowledge upload-execution-prerequisite-plan <approval-review.json> [--out <plan.json>] [--json]`.
- Ready status is `prerequisite-plan-ready`, meaning only that the prerequisite
  boundary plan is well-formed and derived from a safe `review-ready` input.
  It is not execution readiness.

Implemented acceptance criteria:

1. `prerequisite-plan-ready` requires a valid
   `infra-agent.knowledge-team-upload-mutation-approval-review` with
   `review-ready`, `humanReviewRecorded=true`, `fingerprintVerified=true`, and
   the existing next action `plan-execution-prerequisite-boundaries`.
2. Matching review state is recorded as a prerequisite signal only; top-level
   `mutationApprovalGranted`, `uploadApproved`, and `uploadExecutionAllowed`
   remain false.
3. The output explicitly records required future boundaries: artifact bytes,
   adapter injection, write token, execution lease, rollback plan, and audit
   record. Each required item remains uncreated/unprovided.
4. Mismatched, missing, malformed, blocked, forged, or leaky review inputs
   produce a blocked prerequisite plan with safe blocker codes and without
   copying private values.
5. The CLI reads only one local review JSON file and writes only an optional
   local `--out` JSON artifact.
6. Existing upload mutation approval review, mutation plan, execution gate,
   mock harness, continuation, and team backend no-SDK boundaries remain valid.

Completed commits for this slice:

1. `e9f1f87` docs: record upload execution prerequisite plan
2. `ac7cc2e` feat: add upload execution prerequisite plan contract
3. `0f109d7` test: cover upload execution prerequisite ready path
4. `d9bb548` test: block unsafe upload execution prerequisites
5. `51a834a` test: guard upload execution prerequisite boundary
6. `92fd7c4` feat: validate upload execution prerequisite plans
7. `c0408b1` test: cover upload execution prerequisite contract
8. `4b27f33` feat: parse upload execution prerequisite args
9. `8b01b63` feat: wire upload execution prerequisite cli
10. `b78b828` test: guard upload execution prerequisite surface
11. `9fc7297` docs: document upload execution prerequisite boundary
12. `d3f102c` test: cover malformed execution prerequisite plans

Verification completed:

- Focused unit:
  `node --experimental-strip-types test/unit/knowledge-team-upload-execution-prerequisite-plan.test.mjs`
- Focused contract:
  `node --experimental-strip-types test/contract/knowledge-team-upload-execution-prerequisite-plan-contract.test.mjs`
- Coverage:
  `npm run test:coverage` passed with total branch coverage at 75.34%; the new
  `team-upload-execution-prerequisite-plan.ts` file reports 100% line, branch,
  and function coverage.
- Full gate:
  `npm run verify` passed after the code and test commits.

Key files changed:

- `src/knowledge/team-upload-execution-prerequisite-plan.ts`
- `src/knowledge/team-upload-approval-validation.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-upload-execution-prerequisite-plan.test.mjs`
- `test/contract/knowledge-team-upload-execution-prerequisite-plan-contract.test.mjs`
- `test/integration/cli-knowledge-upload-execution-prerequisite-plan-main.test.mjs`

Next recommended stage:

- Design a separate write-token boundary artifact. It should consume the
  prerequisite plan as a prerequisite signal only and still keep upload
  execution disabled until token issuance, lease creation, rollback planning,
  audit recording, adapter injection, artifact bytes, and backend mutation are
  split into explicit future boundaries.

## Current Test Architecture

Status as of 2026-05-06:

- Tests are split into `test/unit/`, `test/integration/`, and
  `test/contract/`; shared helpers live under `test/support/`.
- Category runners use `test/run-category.mjs` to discover direct `.test.mjs`
  shards in stable filename order. Do not manually add shard imports to
  `test/run-unit.mjs`, `test/run-integration.mjs`, or `test/run-contract.mjs`.
- `npm test` runs `npm run test:structure` before `npm run test:all`.
- `npm run verify` is the full local gate: lint, structure, explicit unit,
  integration, and contract suites, isolated shard execution, smoke, e2e,
  coverage, and package dry-run.
- `npm run test:coverage` is the coverage gate over `src/**/*.ts`: minimum 85%
  lines, 75% branches, and 90% functions.
- `.github/workflows/verify.yml` reports failures by layer: static
  lint/structure/package shape, unit, integration, contract, isolated shards,
  smoke/e2e, and coverage. The workflow uses read-only permissions,
  concurrency cancellation, and per-job timeouts.
- `docs/TESTING.md` is the compact extension guide for future test shards.

Current guardrails:

- no root-level or nested `.test.mjs` shards
- no broad `test/support/cli-smoke-harness.mjs`
- no committed `.only` or `.skip` tests
- `.test.mjs` shards at or below 1,000 lines
- `test/support/*.mjs` helpers at or below 1,000 lines
- no test-like files outside direct `test/unit`, `test/integration`, or
  `test/contract` `.test.mjs` shards
- package and CI scripts must keep the expected test, coverage, smoke/e2e, and
  package dry-run gates wired

## 2026-05-09 Active Upload Mutation Approval Review Plan

Status:

- Completed and verified. This slice adds a private dry-run human fingerprint
  review record after `upload-mutation-plan`.
- Scope is local JSON review only: consume one saved
  `infra-agent.knowledge-team-upload-mutation-plan` plus an explicit
  operator-supplied `--approval-fingerprint`, then record whether the exact
  mutation-plan approval-audit fingerprint was reviewed.
- This slice does not grant mutation approval, allow upload execution, issue
  write tokens, create execution leases, stage artifact bytes, create rollback
  plans, inject adapters, create SDK clients, read credential values, check
  credential presence, perform live checks, generate upload commands, mutate
  object storage, or mutate a metadata index.

Why this direction:

- The previous `upload-mutation-plan` slice made a deterministic approval-audit
  fingerprint available but intentionally stopped before human review. The next
  safe step is a separate review record that proves the operator compared the
  exact plan fingerprint without converting that review into execution
  authority.
- This keeps the learning-claude-code permission pattern intact: planning,
  human review records, future execution prerequisites, and actual mutation
  execution remain separate artifacts and commands.

Completed commits and checkpoints:

1. `690abb5` docs: record upload mutation approval review plan.
2. `4efe144` feat: add upload mutation approval review contract.
3. `6065d6c` test: cover upload mutation approval review ready path.
4. `d9465ee` test: block unsafe mutation approval reviews.
5. `b7819c1` feat: validate upload mutation approval reviews.
6. `1b11502` test: cover upload mutation approval review contract.
7. `2f9b100` feat: parse upload mutation approval review args.
8. `8df6b43` feat: wire upload mutation approval review cli.
9. `b7b73e8` test: guard upload mutation approval review surface.
10. `7afc357` docs: document upload mutation approval review boundary.
11. `9db3ac4` test: cover malformed mutation approval reviews.
12. `5d08c28` test: cover mutation approval review validator drift.

Current design:

- `src/knowledge/team-upload-mutation-approval-review.ts` owns the private
  `infra-agent.knowledge-team-upload-mutation-approval-review` contract and
  builder. `review-ready` requires a `plan-ready`
  `infra-agent.knowledge-team-upload-mutation-plan`, a safe
  `stage-knowledge-pack-mutation-plan-v1` SHA-256 fingerprint, and an exact
  supplied fingerprint match.
- The output records human review only in `approvalReview` via
  `humanReviewRecorded=true` and `fingerprintVerified=true`. Top-level
  `mutationApprovalGranted`, `uploadApproved`, and `uploadExecutionAllowed`
  remain false.
- `executionBoundary` is explicitly non-executable and keeps artifact bytes,
  adapter injection, write token, execution lease, rollback plan, audit record,
  client, credential read/presence check, live check, upload command, object
  write, metadata index write, and remote mutation flags false.
- `src/knowledge/team-upload-approval-validation.ts` validates both ready and
  blocked review artifacts through the `knowledge validate` dispatcher.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-mutation-approval-review <mutation-plan.json>
  --approval-fingerprint <sha256> [--out <review.json>] [--json]`.
  `src/cli/output.ts` prints safe text output that states review status while
  keeping mutation approval, write tokens, leases, and execution disabled.

Acceptance criteria:

- `review-ready` can be emitted only for a valid `plan-ready` mutation plan and
  an exact operator-supplied fingerprint match.
- Matching fingerprint records a human review but does not grant mutation
  approval and does not unlock execution.
- Mismatched, missing, malformed, unsafe, blocked, forged, or leaky inputs
  produce a blocked review artifact with safe blocker codes and without copying
  private values.
- CLI reads only one local mutation-plan JSON file plus the explicit
  fingerprint flag, and writes only an optional local `--out` review JSON.
- Existing upload mutation plan, execution gate, mock harness, continuation,
  and team backend no-SDK boundaries remain valid.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-mutation-approval-review.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-mutation-approval-review-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-mutation-approval-review-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-upload-mutation-plan.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-mutation-plan-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-mutation-plan-main.test.mjs`
- `git diff --check`
- `npm run test:coverage`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 158.

Notes from validation:

- The first full `npm run verify` run reached `test:coverage` and failed at
  branch coverage 74.49% after the new validator branches were added.
  Additional malformed-input and validator-drift tests raised coverage above
  the 75% branch threshold; `npm run test:coverage` and the final full
  `npm run verify` both passed afterward.

Current risks to monitor:

- The command name includes "approval", so future agents must preserve the
  "review record only" semantics. It is not an approval grant.
- A future execution-prerequisite slice must not treat
  `humanReviewRecorded=true` as sufficient authority to write. It should remain
  a prerequisite signal only, with a separate token/lease/rollback/audit design.
- The artifact is private chain state and must not be promoted to public
  descriptor, publication plan, index entry, or readiness schemas.

Next step:

- Design the next dry-run execution-prerequisite boundary separately. Keep real
  uploads, write-token issuance, execution leases, rollback artifact creation,
  SDK clients, credential presence checks, live backend checks, upload commands,
  and object/index mutation out of scope until each has an explicit approval
  and audit artifact.

## 2026-05-09 Active Upload Adapter Preflight Plan

Status:

- Completed and verified. This slice adds a private dry-run adapter dependency
  preflight for team knowledge upload routing after explicit upload approval
  continuation.
- Scope is local JSON review only: consume a saved
  `infra-agent.knowledge-team-upload-approval-continuation` plus a saved backend
  adapter resolution plan, then report whether a future test harness could
  inject a safe mock adapter dependency.
- This slice must not add a cloud SDK, perform network calls, read credential
  values, check credential presence, create clients, instantiate real backend
  adapters, generate upload commands, mutate remote objects/indexes, or treat
  `continuation-ready` as upload authorization.

Why this direction:

- The previous slice made explicit approval continuation structured but still
  inert. The next safe step is to model the adapter dependency boundary that
  would sit before any future execution harness.
- The design follows the learning-claude-code permission pattern: permission
  state, dependency state, and mutation execution stay separate. This slice only
  reviews dependency injection readiness and keeps mutation disabled.

Completed commits and checkpoints:

1. `0792b5a` docs: record upload adapter preflight plan.
2. `a4339da` feat: add upload adapter preflight contract.
3. `648febe` fix: accept safe artifact keys in adapter preflight.
4. `ca50066` test: cover upload adapter preflight ready path.
5. `8b3e017` test: block unsafe upload adapter continuations.
6. `77e5e49` test: block unsafe upload adapter plans.
7. `ce31c94` feat: validate upload adapter preflight artifacts.
8. `06ef4b5` test: validate upload adapter preflight artifacts.
9. `222ce1d` test: lock upload adapter preflight contract.
10. `223bd26` feat: parse upload adapter preflight args.
11. `97e4246` test: cover upload adapter preflight args.
12. `9bf7602` feat: wire upload adapter preflight cli.
13. `7e7334e` test: cover upload adapter preflight cli.
14. `c04b86a` test: document upload adapter preflight help.
15. `8d872b0` test: guard upload adapter preflight boundary.
16. `8cd9a47` docs: document upload adapter preflight boundary.

Current design:

- `src/knowledge/team-upload-adapter-preflight.ts` owns the private
  `infra-agent.knowledge-team-upload-adapter-preflight` contract and builder.
  It consumes a saved upload approval continuation and a saved adapter
  resolution plan. It does not call the adapter resolver, instantiate adapters,
  create clients, or inspect environment variables.
- A `preflight-ready` artifact requires a continuation-ready input with a
  verified fingerprint and a resolvable `mock-s3-compatible` adapter resolution
  plan. Real `s3-compatible` plans remain blocked with
  `real-backend-not-implemented` and `unsupported-adapter-backend`.
- The output keeps `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, and `uploadCommand=null`.
- `src/knowledge/team-upload-approval-validation.ts` now validates
  upload-adapter-preflight artifacts behind the `knowledge validate`
  dispatcher.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-adapter-preflight <continuation.json>
  --adapter-plan <adapter-plan.json> [--out <preflight.json>] [--json]`.
  `src/cli/output.ts` adds safe text output that reports no upload execution,
  no client creation, and no adapter injection.

Acceptance criteria:

- Preflight can report `preflight-ready` only for a continuation-ready artifact
  plus a resolvable mock adapter resolution plan.
- `preflight-ready` means structurally ready for a future dependency-injected
  test harness, not upload-ready and not executable.
- Output keeps `mutationAllowed=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `clientCreated=false`,
  `adapterInjected=false`, and `uploadCommand=null`.
- CLI reads only local JSON and writes only an optional local `--out` artifact.
- Existing upload intent, upload continuation, backend reference readiness, and
  public team artifact contracts remain unchanged.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-adapter-preflight.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-adapter-preflight-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-adapter-preflight-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-upload-approval-continuation.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-approval-continuation-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-approval-continuation-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-adapter-resolver.test.mjs`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 154.

Current risks to monitor:

- `preflight-ready` may be mistaken for upload-ready. It is only a local
  dependency-injection review state for a future test harness.
- The CLI currently consumes a saved adapter resolution plan. Producing that
  plan remains an internal/module-level workflow; do not add a real backend
  adapter-plan command unless it stays dry-run and side-effect free.
- The next real-backend slice must remain separate and start with an explicit
  mutation gate, not by widening this preflight artifact.

Next step:

- Design the explicit execution harness boundary for mock dependency injection
  first. Keep real S3-compatible adapter implementation, SDK clients,
  credential presence checks, live backend checks, upload commands, and remote
  writes out of scope until a separate approval-gated slice.

## 2026-05-09 Active Upload Mock Harness Plan

Status:

- Completed and verified. This slice adds a private dry-run in-memory mock
  harness review after `upload-adapter-preflight`.
- Scope remains review-only: consume a saved
  `infra-agent.knowledge-team-upload-adapter-preflight`, construct only a safe
  in-memory mock adapter descriptor boundary, and prove that future mock
  dependency injection can be modeled without staging bytes or writing an
  index.
- The implementation does not call `artifactStore.putObject`,
  `metadataIndex.putEntry`, `stageKnowledgePackArtifactForTeamStore`, a real
  resolver for S3-compatible backends, SDK clients, credential readers,
  credential presence checks, live backend checks, upload command builders, or
  remote object/index mutation.

Why this direction:

- The previous slice made dependency injection preflight explicit but did not
  instantiate or inject anything. The next safe step is to model the mock-only
  harness boundary and keep all write attempts disabled.
- This follows the learning-claude-code pattern of separating permission
  review, dependency review, and mutation execution. `harness-ready` must mean
  "mock harness review is structurally ready", not upload-ready.

Completed commits and checkpoints:

1. `3d1b67f` docs: record upload mock harness plan.
2. `36a510e` feat: add upload mock harness contract.
3. `ebb8134` fix: allow safe mock harness metadata fields.
4. `d3d2e51` test: cover upload mock harness ready path.
5. `f7dea59` test: block unsafe upload mock harness preflights.
6. `626b85a` test: block unsafe upload mock harness adapters.
7. `df683fb` feat: validate upload mock harness artifacts.
8. `b062310` test: cover upload mock harness contract.
9. `44a08c7` feat: parse upload mock harness cli args.
10. `fd6689a` feat: wire upload mock harness cli.
11. `9acb1f7` test: guard upload mock harness cli surface.
12. `8b9c3f9` docs: document upload mock harness boundary.

Current design:

- `src/knowledge/team-upload-mock-harness.ts` owns the private
  `infra-agent.knowledge-team-upload-mock-harness` contract and builder. It
  consumes saved preflight JSON and performs fail-closed parsing before any
  mock probe is attempted.
- A `harness-ready` artifact requires `preflight-ready` input with a safe
  `mock-s3-compatible` adapter dependency. Real backend drift, adapter
  capability drift, blocked preflight state, unsafe adapter names, unsafe
  artifact references, backend details, client fields, upload commands, and
  credential leakage all produce `blocked`.
- The only instantiated dependency is
  `createMockKnowledgeTeamBackendAdapter({ name })`, and only after the saved
  preflight passes the dry-run safety checks. The harness checks descriptor and
  method availability but never calls object-store or metadata-index write
  methods.
- The output keeps `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`.
- `src/knowledge/team-upload-approval-validation.ts` validates upload mock
  harness artifacts behind the `knowledge validate` dispatcher.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-mock-harness <preflight.json>
  [--out <harness.json>] [--json]`. `src/cli/output.ts` adds safe text output
  that reports no upload execution, no client creation, no adapter injection,
  no object write attempt, no index write attempt, and no remote mutation.

Acceptance criteria:

- Harness can report `harness-ready` only for `preflight-ready` input with a
  mock adapter dependency.
- Output must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`.
- CLI reads only local preflight JSON and writes only the optional local
  `--out` artifact.
- Existing upload intent, upload continuation, upload adapter preflight,
  backend reference readiness, and public team artifact contracts remain
  unchanged.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-mock-harness.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-mock-harness-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-mock-harness-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 155.

Current risks to monitor:

- `harness-ready` may be mistaken for upload-ready. It is only a private
  dry-run mock harness review state.
- The harness can instantiate the in-memory mock adapter descriptor boundary,
  but it must not be widened into dependency injection for upload execution
  without a separate approval-gated slice.
- Real S3-compatible adapter implementation, SDK clients, credential presence
  checks, live backend checks, upload commands, and remote writes remain out of
  scope.

Next step:

- Design an explicit approval-gated execution slice before any real backend or
  upload work. Start with permission state and mutation audit requirements,
  then decide whether a mock-only dependency-injection execution harness is
  needed before real backend clients. Keep real remote writes disabled until
  that separate slice is documented and approved.

## 2026-05-09 Active Upload Mutation Approval Review Plan

Status:

- In progress. This slice adds a private dry-run human mutation approval review
  record after `upload-mutation-plan`.
- Scope is still non-executable review only: consume a saved
  `infra-agent.knowledge-team-upload-mutation-plan` plus an explicit
  operator-supplied mutation approval fingerprint, verify the fingerprint
  against the plan's approval-audit fingerprint, and emit sanitized review
  state for later execution-prerequisite design.
- This slice must not grant upload approval, allow upload execution, issue
  write tokens, create execution leases, create rollback artifacts, inject
  adapters into execution, create SDK clients, read artifact bytes, read
  credential values or presence, run live backend checks, generate upload
  commands, or mutate object/index storage.

Why this direction:

- The previous slice produced the auditable plan but intentionally did not
  record human review. The next safe step is to make the human fingerprint
  review machine-checkable while still keeping actual mutation capability
  absent.
- This follows the learning-claude-code permission pattern: plan, human review,
  execution prerequisites, and mutation execution stay separate. `review-ready`
  must mean "the operator supplied the expected mutation-plan fingerprint", not
  upload-ready or executable.

Planned checkpoints:

1. Record this active mutation approval review plan and non-goals before
   feature changes.
2. Add a private
   `infra-agent.knowledge-team-upload-mutation-approval-review` contract.
3. Cover the ready path from a saved `plan-ready` mutation plan and matching
   approval fingerprint.
4. Block non-ready, invalid, or leaky mutation-plan artifacts.
5. Block mismatched, missing, unsafe, or forged approval fingerprints.
6. Block forged approval, token, lease, command, client, artifact-byte, and
   write state.
7. Add validation support behind `knowledge validate`.
8. Add contract tests for stable private JSON shape and non-executable review
   fields.
9. Add CLI parsing for
   `infra-agent knowledge upload-mutation-approval-review <mutation-plan.json>
   --approval-fingerprint <sha256> [--out <review.json>] [--json]`.
10. Wire the CLI command and safe text output.
11. Add CLI integration, help, and no-SDK/no-env guard coverage.
12. Update rules, roadmap, README, skill, and handoff docs with validation
    results and remaining risks.

Acceptance criteria:

- Review can report `review-ready` only for a valid `plan-ready` mutation plan
  and exact matching supplied fingerprint.
- Output may record `humanReviewRecorded=true` only inside the review section
  when the fingerprint is verified, but must keep `mutationApprovalGranted=false`
  and all execution capabilities disabled.
- Output must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `artifactBytesProvided=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`.
- CLI reads only local mutation-plan JSON and one fingerprint flag, and writes
  only the optional local `--out` artifact.
- Existing upload intent, upload continuation, upload adapter preflight, upload
  mock harness, upload execution gate, upload mutation plan, backend reference
  readiness, and public team artifact contracts remain unchanged.

## 2026-05-09 Active Upload Mutation Plan

Status:

- Completed and verified. This slice adds a private dry-run upload mutation
  plan after `upload-execution-gate`.
- Scope remains non-executable review only: consume a saved
  `infra-agent.knowledge-team-upload-execution-gate`, verify that it is
  `gate-ready`, and emit the approval/audit plan that a later human mutation
  approval flow would review.
- This slice does not grant upload approval, allow upload execution, issue
  write tokens, create execution leases, create rollback artifacts, inject
  adapters into execution, create SDK clients, read artifact bytes, read
  credential values or presence, run live backend checks, generate upload
  commands, or mutate object/index storage.

Why this direction:

- The previous slice made scope and execution-gate state machine-checkable, but
  it intentionally stopped before any mutation approval. The next safe step is
  to produce an auditable plan for what would need separate approval later.
- This follows the learning-claude-code permission pattern: route state,
  approval request state, and mutation execution stay separate. `plan-ready`
  must mean "ready to request explicit mutation approval", not upload-ready.

Completed commits and checkpoints:

1. `b931d9d` docs: record upload mutation plan.
2. `e644331` feat: add upload mutation plan contract.
3. `626b651` test: cover upload mutation plan ready path.
4. `0462d0f` test: block non-ready upload mutation gates.
5. `3696ddb` fix: block forged upload mutation state.
6. `2ee2a08` feat: validate upload mutation plan artifacts.
7. `6b2dde0` fix: allow safe blocker metadata validation.
8. `450e2fc` test: cover upload mutation plan contract.
9. `2a2d990` feat: parse upload mutation plan cli args.
10. `7dbda51` feat: wire upload mutation plan cli.
11. `bbc99f6` test: guard upload mutation plan cli surface.
12. `05e567b` docs: document upload mutation plan boundary.

Current design:

- `src/knowledge/team-upload-mutation-plan.ts` owns the private
  `infra-agent.knowledge-team-upload-mutation-plan` contract and builder. It
  consumes only a saved upload execution gate artifact and never imports SDK,
  mock adapter, resolver, credential, object-store, or metadata-index write
  APIs.
- A `plan-ready` artifact requires a valid `gate-ready`
  `approval-gated-dry-run` input, matched scope, verified continuation
  fingerprint, ready in-memory mock harness summary, and safe manifest/object
  references. Anything malformed, blocked, leaky, or already mutated becomes
  `blocked`.
- The output records a non-executable `approval-audit-dry-run` plan with a
  safe mutation-plan fingerprint and next action
  `request-human-mutation-approval`. It keeps every execution capability false
  or null, including approval grants, artifact bytes, write token, execution
  lease, rollback-plan creation, adapter injection, client creation, commands,
  object/index writes, and remote mutation.
- `src/knowledge/team-upload-approval-validation.ts` validates mutation-plan
  artifacts behind `knowledge validate`; `src/cli/main.ts` adds
  `infra-agent knowledge upload-mutation-plan <gate.json>
  [--out <mutation-plan.json>] [--json]`; `src/cli/output.ts` adds safe text
  output.

Acceptance criteria met:

- Plan can report `plan-ready` only for a valid `gate-ready` execution gate.
- Output must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `clientCreated=false`,
  `adapterInjected=false`, `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `artifactBytesProvided=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`.
- CLI reads only local execution-gate JSON and writes only the optional local
  `--out` artifact.
- Existing upload intent, upload continuation, upload adapter preflight, upload
  mock harness, upload execution gate, backend reference readiness, and public
  team artifact contracts remain unchanged.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-mutation-plan.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-mutation-plan-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-mutation-plan-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-gate.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-gate-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-gate-main.test.mjs`
- `git diff --check`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 157.

Current risks to monitor:

- `plan-ready` may be mistaken for approval. It is only approval-audit plan
  readiness and keeps `mutationApprovalGranted=false`.
- The next slice must remain separate from this plan artifact. Do not widen
  this command to accept backend configs, approval fingerprints, artifact
  bytes, write tokens, leases, adapters, SDK clients, credential checks, upload
  commands, object/index writes, or remote mutation.
- Subagent reviews preferred longer names such as "mutation approval audit
  plan"; the implemented CLI keeps the existing active-plan name
  `upload-mutation-plan`, so docs now explicitly define it as
  `approval-audit-dry-run` and non-executable.

Next step:

- Design a separate human mutation approval record/review artifact if remote
  upload execution is still desired. Keep it separate from write-token issuance,
  execution leases, byte staging, backend client construction, and actual
  object/index mutation.

## 2026-05-09 Active Upload Execution Gate Plan

Status:

- Completed and verified. This slice adds a private dry-run execution gate
  review after `upload-approval-continuation` and `upload-mock-harness`.
- Scope is still review-only: consume a saved
  `infra-agent.knowledge-team-upload-approval-continuation` and a saved
  `infra-agent.knowledge-team-upload-mock-harness`, verify that their artifact
  scope matches, and emit permission/audit state for a future approval-gated
  execution design.
- This slice must not grant upload approval, allow upload execution, issue
  write tokens, create execution leases, inject adapters into execution, create
  SDK clients, read credential values or presence, run live backend checks,
  generate upload commands, stage artifact bytes, or mutate object/index
  storage.

Why this direction:

- The previous slice proved the in-memory mock adapter descriptor boundary.
  The next safe step is to model the execution gate and mutation audit
  preconditions without crossing into execution.
- This follows the learning-claude-code permission pattern: approval state,
  dependency review, and mutation execution remain separate structured states.
  `gate-ready` must mean "ready to request a separately approved execution
  design", not upload-ready.

Completed commits and checkpoints:

1. `e765b99` docs: record upload execution gate plan.
2. `2e8f630` feat: add upload execution gate contract.
3. `c8ca344` test: cover upload execution gate ready path.
4. `613b348` test: block forged execution gate continuations.
5. `8a6c2db` test: block forged execution gate harnesses.
6. `e80b6e4` test: enforce execution gate scope matching.
7. `b104851` feat: validate upload execution gate artifacts.
8. `1bfb9b6` test: cover upload execution gate contract.
9. `c4e17e1` feat: parse upload execution gate cli args.
10. `f0b76fd` feat: wire upload execution gate cli.
11. `66dfff9` test: guard upload execution gate cli surface.
12. `c3f7c5c` docs: document upload execution gate boundary.

Current design:

- `src/knowledge/team-upload-execution-gate.ts` owns the private
  `infra-agent.knowledge-team-upload-execution-gate` contract and builder. It
  consumes saved continuation and mock-harness JSON, parses both fail-closed,
  and never reads artifact bytes, credentials, environment values, SDK clients,
  backend configs, or upload commands.
- A `gate-ready` artifact requires a continuation-ready input with a verified
  fingerprint and a harness-ready input for the same manifest id, object key,
  object hash, and artifact id. Any scope mismatch clears the target summary
  and emits `scope-mismatch`.
- The output records explicit permission/audit state: upload approval is still
  false, upload execution is still false, mutation approval is still false,
  no write token is issued, no execution lease is created, no adapter is
  injected, no artifact bytes are provided, and no object/index write is
  attempted.
- `src/knowledge/team-upload-approval-validation.ts` validates execution gate
  artifacts behind the `knowledge validate` dispatcher, including forged output
  states such as upload approval, execution approval, write tokens, leases,
  adapter injection, artifact bytes, live checks, commands, and remote
  mutation attempts.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-execution-gate <continuation.json>
  --mock-harness <harness.json> [--out <gate.json>] [--json]`.
  `src/cli/output.ts` adds safe text output that reports the permission/audit
  boundary without echoing private backend details.

Acceptance criteria:

- Gate can report `gate-ready` only for a continuation-ready artifact with a
  verified fingerprint plus a harness-ready artifact for the same manifest,
  object key, object hash, and artifact id.
- Output must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`.
- CLI reads only local continuation and harness JSON and writes only the
  optional local `--out` artifact.
- Existing upload intent, upload continuation, upload adapter preflight,
  upload mock harness, backend reference readiness, and public team artifact
  contracts remain unchanged.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-execution-gate.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-execution-gate-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-execution-gate-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `git diff --check`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 156.

Current risks to monitor:

- `gate-ready` may be mistaken for upload-ready. It is only a local
  permission/audit review state for requesting a separate mutation design.
- The gate currently proves scope consistency between continuation and
  mock-harness artifacts, but it does not model rollback execution, write
  tokens, leases, or actual artifact-byte handling. Those must remain in a
  later explicitly approved slice.
- Real S3-compatible adapter implementation, SDK clients, credential presence
  checks, live backend checks, upload command generation, artifact-byte staging,
  object writes, metadata index writes, and remote mutation remain out of
  scope.

Next step:

- Design a separate mutation-approval slice that consumes the execution gate
  artifact and produces only a non-executable approval/audit plan first. Do not
  add a real backend upload command, credential presence checks, SDK client
  creation, write-token issuance, lease creation, or remote writes until that
  mutation plan has its own contract, validator, CLI surface, and tests.

## 2026-05-09 Active Upload Approval Continuation Plan

Status:

- Completed and verified. This slice adds a private explicit upload approval continuation
  contract for team knowledge publication planning.
- Scope is still dry-run planning only: consume a saved
  `infra-agent.knowledge-team-upload-approval-intent` plus an explicit matching
  approval fingerprint supplied by the operator, then emit compact continuation
  state for a future dependency-injected adapter design.
- This slice must not add a cloud SDK, perform network calls, read credential
  values, check credential presence, create clients, generate upload commands,
  mutate remote objects/indexes, or change public team artifact/readiness JSON
  schemas.

Why this direction:

- The previous slice modeled the permission boundary before upload. The next
  safe step is to make the explicit continuation boundary structured and
  machine-checkable without treating it as upload permission.
- This follows the Claude Code-style approval resume pattern: continuation
  metadata can preserve an approval scope, but execution remains separate and
  mutation-disabled until a later explicitly gated implementation exists.

Completed commits and checkpoints:

1. `f76ed8a` docs: record upload approval continuation plan.
2. `0b76115` feat: fingerprint upload approval intent scope.
3. `9ca6156` feat: add upload approval continuation contract.
4. `fea03e4` test: cover upload approval continuation paths.
5. `aeb1790` test: lock upload approval continuation contract.
6. `2f68f4b` test: validate upload approval continuation artifacts.
7. `b8b6f9b` feat: wire upload approval continuation cli.
8. `1859ec1` test: guard upload continuation backend boundary.
9. `3c7a7df` docs: document upload approval continuation boundary.
10. Final handoff update: record focused and full verification.

Current design:

- `src/knowledge/team-upload-approval-intent.ts` now emits an
  `approvalFingerprint` object for approval-required intents. The fingerprint is
  a SHA-256 digest over safe canonical scope fields: planned operation,
  backend/publication backend kinds, manifest id, content-addressed object
  metadata, artifact id, and private reference names. Blocked intents keep the
  fingerprint value `null`.
- `src/knowledge/team-upload-approval-continuation.ts` owns the private
  `infra-agent.knowledge-team-upload-approval-continuation` contract and
  builder. It consumes a saved upload approval intent and an explicit
  fingerprint string, recomputes the expected fingerprint, and reports either
  `continuation-ready` or `blocked`.
- A continuation-ready payload is still inert. It keeps
  `uploadApproved=false`, `uploadExecutionAllowed=false`, `clientCreated=false`,
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`, and
  `uploadCommand=null`.
- `src/knowledge/team-upload-approval-validation.ts` validates both upload
  approval intent and continuation payloads behind `knowledge validate`.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-approval-continuation <intent.json>
  --approval-fingerprint <sha256> [--out <continuation.json>] [--json]`.
  `src/cli/output.ts` adds safe text output for the continuation artifact.

Acceptance criteria:

- `infra-agent knowledge upload-approval-continuation <intent.json>
  --approval-fingerprint <sha256> [--out <continuation.json>] [--json]` reads
  only local JSON and writes only the optional local output artifact.
- Continuation can report `continuation-ready` only when the saved intent is
  `approval-required`, all mutation/credential/live-check/upload-command flags
  remain disabled, and the supplied fingerprint matches the deterministic intent
  scope fingerprint.
- Continuation output must keep `mutationAllowed=false`,
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `uploadApproved=false`, `uploadExecutionAllowed=false`, `clientCreated=false`,
  and `uploadCommand=null`.
- Continuation must not copy raw backend config, endpoint/bucket details,
  credential values, env var values, upload commands, signed URLs, or absolute
  local paths.
- Existing public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, backend-readiness, backend-reference-readiness, and
  upload-intent public-adjacent contracts remain mutation-disabled and
  no-leak.

Current risks to monitor:

- The command name and output must not imply that upload was executed or that a
  real backend adapter/client now exists.
- The approval fingerprint is a scope confirmation aid, not a secret, credential,
  or durable authorization mechanism.
- The continuation artifact must remain private routing state and must not be
  embedded into public artifact/readiness JSON.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-approval-continuation.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-approval-continuation-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-approval-continuation-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-upload-approval-intent.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-approval-intent-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-approval-intent-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `npm run test:structure`
- `npm run lint`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 153.

Next step:

- Future work should keep the next real-backend slice separate and start from a
  dependency-injected adapter execution design guarded by explicit approval,
  not from a direct upload command.

## 2026-05-09 Active Upload Approval Intent Plan

Status:

- Completed and verified. This slice adds a private offline upload approval
  intent review surface for future real S3-compatible team backend work.
- Scope is contract-first planning only: compose an existing team publication
  readiness report with an existing S3-compatible backend reference validation
  summary, then emit a compact intent that says whether explicit human upload
  approval would be required after all dry-run preconditions are met.
- The slice must not add a cloud SDK, perform network calls, read credential
  values, check credential presence, create clients, generate upload commands,
  mutate remote objects/indexes, or change public team artifact/readiness JSON
  schemas.

Why this direction:

- Previous slices made backend config, reference registries, and reference
  readiness reviewable without side effects. The next safe step is to model the
  approval boundary that would sit immediately before any future upload path.
- The design follows the Claude Code-style permission pattern: structured
  runtime state can request explicit approval, but approval is separate from
  execution and no mutation capability appears in the handoff object.

Completed commits and checkpoints:

1. `58bb307` docs: record upload approval intent plan.
2. `370941b` feat: add upload approval intent contract.
3. `cfc05bf` test: cover upload approval intent happy path.
4. `37b304e` test: block upload intent on publication readiness.
5. `22e37db` test: block upload intent on backend references.
6. `ecf4cdf` test: guard upload intent credential boundary.
7. `4641900` feat: parse upload approval intent args.
8. `fea27e0` feat: wire upload approval intent cli.
9. `ef6418b` test: cover upload approval intent cli.
10. `f8aebf8` test: lock upload approval intent contract.
11. `055cf98` test: expose upload approval intent in help.
12. `305af0c` docs: document upload approval intent boundary.
13. `6ed6dea` docs: record upload approval intent progress.
14. Final handoff update: record full verification and next-stage plan.

Current design:

- `src/knowledge/team-upload-approval-intent.ts` owns the private
  `infra-agent.knowledge-team-upload-approval-intent` contract and builder. It
  composes saved `infra-agent.knowledge-team-publication-readiness` and saved
  `infra-agent.knowledge-team-s3-compatible-reference-validation` inputs.
- The intent reports `approval-required` only when publication readiness is
  `upload-required`, publication is allowed, and backend reference readiness is
  `valid`. Otherwise it reports `blocked` with fixed, non-leaky blocker codes.
- Credential boundary is modeled as a private precondition inside the intent:
  environment variable names can be listed, while credential values and
  credential presence checks remain disabled.
- `src/cli/main.ts` adds
  `infra-agent knowledge upload-approval-intent <publication-readiness.json>
  --backend-reference <reference-readiness.json> [--out <intent.json>] [--json]`.
  It reads only local JSON files and writes only the local `--out` file when
  requested.
- `src/cli/output.ts` adds safe text output for the intent. Text and JSON output
  never include upload commands, credential values, backend URLs, buckets,
  endpoints, or absolute paths.
- Public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, backend-readiness, and backend-reference-readiness
  JSON shapes are unchanged.

Acceptance criteria:

- `infra-agent knowledge upload-approval-intent <publication-readiness.json>
  --backend-reference <reference-readiness.json> [--out <intent.json>] [--json]`
  reads only local JSON files.
- The output kind is a private
  `infra-agent.knowledge-team-upload-approval-intent` summary. It may list
  required/optional environment variable names inherited from the reference
  summary, but it must never read or report environment variable values.
- The intent can report `approval-required` only when publication readiness is
  `upload-required`, publication is allowed, and backend reference validation is
  `valid`.
- The intent must keep `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`, and
  `uploadCommand=null`.
- Existing public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, backend-readiness, and backend-reference-readiness
  contracts remain unchanged.

Current risks to monitor:

- The command name and text output must not imply that an upload was approved
  or that credentials/backend reachability were checked.
- Environment variable names are allowed private routing metadata; environment
  variable values remain forbidden.
- Approval intent must not become a remote mutation command or SDK adapter
  factory.
- A valid intent still requires a future separate implementation slice for any
  real backend adapter, live-check policy, credential value access boundary, and
  explicit approval continuation.

Verification completed:

- `node --experimental-strip-types test/unit/knowledge-team-upload-approval-intent.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-upload-approval-intent-main.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-upload-approval-intent-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-backend-no-sdk.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-core-main.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-artifact-public-contract.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-backend-readiness-contract.test.mjs`
- `npm run test:structure`
- `npm run lint`
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 151.

Next step:

- Future real backend work should stay in a separate slice and start with
  adapter dependency injection plus an explicit approval continuation model,
  not an upload command.

## 2026-05-09 Active S3-Compatible Reference Readiness CLI Plan

Status:

- Completed and verified. This slice adds a dry-run file/CLI review path for
  the private S3-compatible reference registry contract.
- Scope is CLI argument parsing, local JSON loading, text/JSON output,
  integration/contract tests, and documentation. It must not read environment
  variable values, perform live backend checks, import SDKs, create clients,
  generate upload commands, mutate remote objects/indexes, or change public
  team artifact/readiness JSON schemas.

Why this direction:

- The previous registry slice created the private parser and validation
  summary but left operators without a stable local file review path. A
  dedicated dry-run CLI keeps the handoff explicit and testable without
  broadening public readiness JSON.
- The design follows the Claude Code-style compact handoff pattern: parse
  private inputs, emit bounded structured state, and keep mutation and
  reachability separate from planning metadata.

Completed commits and checkpoints:

1. `6ec2fb5` docs: record s3 reference readiness cli plan.
2. `6b1e98c` feat: parse s3 reference readiness cli args.
3. `02328bf` feat: print s3 reference readiness summaries.
4. `007c4ce` feat: wire s3 reference readiness cli.
5. `d00cdaa` test: cover s3 reference readiness cli.
6. `c42b55b` test: lock s3 reference readiness contract.
7. `30f020c` docs: add s3 reference readiness cli usage.
8. `44a1c2f` docs: define s3 reference readiness boundary.
9. `94edcbe` docs: update s3 reference readiness roadmap.
10. `193195f` test: expose s3 reference readiness in help.
11. `328fa1f` docs: record s3 reference readiness verification.

Acceptance criteria:

- The command reads only local JSON files: backend config as the positional
  input and registry via `--registry`.
- Output kind remains
  `infra-agent.knowledge-team-s3-compatible-reference-validation`; it may list
  required/optional environment variable names but never environment values.
- The CLI must not alter existing `knowledge backend-readiness` behavior or
  public team artifact/readiness schemas.
- Valid references may report structural readiness, but real S3-compatible
  adapter resolution stays fail-closed elsewhere.
- Focused CLI, parser, registry, public contract, lint, structure, and full
  verify checks pass.

Current design:

- `infra-agent knowledge backend-reference-readiness <backend-config.json>
  --registry <reference-registry.json> [--out <readiness.json>] [--json]`
  loads only local JSON files and calls
  `validateKnowledgeTeamS3CompatibleBackendReferences()`.
- The command emits
  `infra-agent.knowledge-team-s3-compatible-reference-validation`, the same
  private validation summary produced by the registry module. It may report
  required/optional environment variable names, but it never reads or reports
  environment variable values.
- Text output uses
  `printKnowledgeTeamS3CompatibleReferenceValidationSummary()` and shows status,
  backend/config refs, disabled capability flags, required/optional env var
  names, and blocker issues. Blocked summaries remain review results rather
  than fatal process failures; only argument/file/JSON loading failures are
  fatal.
- `--out` writes the pure private validation summary JSON locally. JSON stdout
  adds `outputPath` only as command metadata when `--out` is used.
- The existing public `knowledge backend-readiness` command and public team
  artifact/readiness contracts are unchanged. Registry refs and env var names
  still do not enter public backend-readiness JSON.

Verification completed:

- Focused new CLI tests passed:
  `cli-knowledge-args-main.test.mjs`,
  `cli-knowledge-backend-reference-readiness-main.test.mjs`,
  `knowledge-team-s3-reference-validation-contract.test.mjs`, and
  `cli-core-main.test.mjs`.
- Focused existing registry/backend tests passed:
  `knowledge-team-s3-compatible-reference-registry.test.mjs`,
  `knowledge-team-s3-compatible-backend-config.test.mjs`,
  `knowledge-team-backend-adapter-resolver.test.mjs`, and
  `knowledge-team-backend-no-sdk.test.mjs`.
- Focused public regression tests passed:
  `cli-knowledge-backend-readiness-main.test.mjs`,
  `knowledge-team-backend-readiness-contract.test.mjs`, and
  `knowledge-team-artifact-public-contract.test.mjs`.
- `npm run test:structure` passed with 102 test files checked.
- Full `npm run verify` passed. This covered lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. The package dry-run reported `entryCount` 150.

Remaining risks and constraints:

- The command name must not imply credential validation or backend
  reachability. It is only an offline registry/config consistency review.
- Env var names containing words like `SECRET` or `TOKEN` are valid names, but
  env var values must never be read or echoed.
- The command must not become an upload approval path.
- S3-compatible support still has no real client, no SDK dependency, no live
  backend probe, no credential presence check, no upload command, and no remote
  mutation.

Next step:

- Move only to a separate design slice for credential-boundary and explicit
  upload approval if real S3 adapter work is required.

## 2026-05-09 Active S3-Compatible Reference Registry Plan

Status:

- Completed and verified. This slice adds an offline credential/source
  reference registry contract for the existing private S3-compatible backend
  config.
- Scope is registry parsing, safe environment-variable-name validation,
  config-reference matching, fail-closed resolution planning, guard tests, and
  documentation only. It must not add cloud SDKs, perform network calls, read
  environment variable values, create clients, generate upload commands, mutate
  remote objects/indexes, or change public team artifact/readiness JSON
  schemas.

Why this direction:

- The previous S3-compatible slice intentionally stopped at safe structural
  references (`storageProfileRef`, `authProfileRef`). The next safe step is to
  validate those references against a private offline registry that names the
  required environment variables without reading their values.
- Claude Code architecture notes favor compact contracts, parser-enforced
  handoffs, injected dependencies, and explicit mutation gates. This stage
  keeps credential/source ownership explicit while preserving fail-closed real
  backend resolution.

Completed commits and checkpoints:

1. `5c34826` docs: record s3 reference registry plan.
2. `378b7c2` feat: add s3 reference registry contract.
3. `4699c7b` test: cover s3 reference registry happy path.
4. `a4638cf` test: prove s3 registry avoids env value reads.
5. `9119e3f` test: reject unsafe s3 registry env names.
6. `29f39ed` test: block inline s3 registry details.
7. `4d11768` test: block missing s3 registry refs.
8. `6820342` feat: validate s3 refs during resolution planning.
9. `73c5117` test: keep s3 registry resolution fail closed.
10. `c58aadd` test: guard s3 registry runtime access.
11. `7635c20` test: keep s3 registry out of readiness json.
12. `e111c26` docs: document s3 reference registry boundary.
13. `029b4a3` test: cover s3 registry shape failures.
14. Final handoff update: record focused checks, full verification, remaining
    risks, and next-stage plan.

Acceptance criteria:

- Registry entries may contain only safe structural refs and environment
  variable names; they must not contain endpoint URLs, bucket names,
  credential values, signed URLs, headers, or absolute local paths.
- Registry validation must never read `process.env` values. It may report only
  required environment variable names.
- Config-reference validation must fail closed when the referenced storage or
  auth profile is missing or the registry itself is unsafe.
- `planKnowledgeTeamBackendAdapterResolution()` may consume registry validation
  as offline metadata, but real `s3-compatible` resolution must remain blocked
  with no client, no network, no upload command, and no mutation permission.
- Public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness schemas remain unchanged.

Current design:

- `src/knowledge/team-s3-compatible-reference-registry.ts` owns the private
  registry parser and validation summary. It accepts safe storage/auth refs and
  uppercase environment variable names for endpoint URL, bucket name, region,
  access key id, secret access key, and optional session token.
- The registry parser rejects unsafe registry shape, duplicate refs, unsafe env
  var names, unknown fields, inline backend/credential fields, URLs, absolute
  paths, and secret-shaped values without echoing private input.
- `validateKnowledgeTeamS3CompatibleBackendReferences()` composes the existing
  S3-compatible private config parser with the registry parser. It reports only
  required/optional environment variable names and fixed dry-run capability
  flags; it never reads `process.env` values.
- `planKnowledgeTeamBackendAdapterResolution(config, { referenceRegistry })`
  can consume registry validation as optional offline metadata. Valid refs keep
  capability metadata structurally ready, but real `s3-compatible` resolution
  still returns a blocked `real-backend-not-implemented` plan. Missing or unsafe
  refs block before real adapter design.
- Public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness JSON shapes remain unchanged.
  Registry refs and env var names are not copied into public readiness JSON.
- `test/unit/knowledge-team-backend-no-sdk.test.mjs` now covers the registry
  module and blocks SDK/network imports plus direct `process.env` reads in team
  backend contract modules.

Verification completed:

- Focused registry/backend tests passed:
  `knowledge-team-s3-compatible-reference-registry.test.mjs`,
  `knowledge-team-s3-compatible-backend-config.test.mjs`,
  `knowledge-team-backend-adapter-resolver.test.mjs`, and
  `knowledge-team-backend-no-sdk.test.mjs`.
- Focused existing team-storage regressions passed:
  `knowledge-team-backend-readiness.test.mjs`,
  `knowledge-team-backend-readiness-validation.test.mjs`,
  `knowledge-team-backend-adapter-conformance.test.mjs`,
  `knowledge-team-backend-adapter-store.test.mjs`,
  `knowledge-team-backend-adapter-index.test.mjs`,
  `knowledge-team-backend-readiness-contract.test.mjs`,
  `knowledge-team-artifact-public-contract.test.mjs`, and
  `cli-knowledge-backend-readiness-main.test.mjs`.
- Repo checks passed: `git diff --check`, `npm run lint`, and
  `npm run test:structure`.
- Full `npm run verify` passed. The full gate included lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run. Isolated execution checked 86 shards; package dry-run
  reported 150 packaged entries.

Remaining risks and constraints:

- The registry is a private contract, not a credential loader. Env var names
  must not be confused with env var values, backend reachability, or upload
  permission.
- S3-compatible support still has no real client, no SDK dependency, no
  credential lookup, no live backend probe, no upload command, and no remote
  mutation.
- The existing backend readiness report remains compact and must not copy
  private refs, backend details, registry entries, or environment variable
  names into public JSON.
- Future real adapter work still needs a separate credential boundary,
  explicit upload approval model, live-check policy, and mutation-gate design.

Next step:

- Add a dry-run CLI or file-input review path for the private reference
  registry only if operators need local validation ergonomics. Do not build a
  real S3 client until the credential access boundary, live-check posture, and
  explicit upload approval model are designed and contract-tested.

## 2026-05-09 Active S3-Compatible Backend Contract Plan

Status:

- Completed and verified. This slice defines the first real backend family as
  a contract-first, private S3-compatible configuration shell.
- Scope is private config parsing, sanitized internal descriptors, resolver
  fail-closed behavior, and mock-backed conformance tests only. It must not add
  cloud SDKs, perform network calls, read credential values, generate upload
  commands, mutate remote objects/indexes, or change public team
  artifact/readiness JSON schemas.

Why this direction:

- The completed backend adapter interface slice created the internal adapter
  seam and mock-only resolver. The next safe step is to define the private
  shape a future real S3-compatible implementation must satisfy without
  creating a real client.
- Claude Code architecture notes favor compact contracts, injected
  dependencies, parser-enforced handoffs, and explicit mutation gates. This
  stage keeps real backend work contract-first and fail-closed while preserving
  those gates.

Completed commits and checkpoints:

1. `428804c` docs: record s3 backend contract plan.
2. `d72b478` feat: add s3 backend private config parser.
3. `a03e67e` test: cover s3 backend config safety.
4. `94c3cf2` feat: project s3 config to readiness input.
5. `d5867a6` feat: plan backend adapter resolution safely.
6. `08abc6f` test: cover real backend plan safety.
7. `7c5656b` test: add backend adapter conformance checks.
8. `8c36349` feat: describe s3 backend capabilities safely.
9. `3606697` test: block team backend sdk imports.
10. `65642fc` test: block team backend network clients.
11. `feb0826` docs: document s3 backend contract shell.
12. Final handoff update: record focused checks, full verification, remaining
    risks, and next-stage plan.

Acceptance criteria:

- Existing public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness schemas remain unchanged.
- Private S3-compatible config may contain only safe structural references and
  flags; it must not expose endpoint, bucket, header, credential values,
  signed URLs, absolute local paths, or upload commands.
- Resolver behavior stays fail-closed for real `s3-compatible` backends; the
  only executable adapter remains injected/mock-backed.
- Adapter and planned-real capability metadata preserve
  `mutationAllowed=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`, and
  `uploadCommand=null`.
- Focused config/parser/resolver/conformance tests, existing team-storage
  contracts, lint, structure, diff check, and full verify pass.

Current design:

- `src/knowledge/team-s3-compatible-backend-config.ts` owns the private
  contract parser for future S3-compatible backend work. It accepts only safe
  structural references (`storageProfileRef`, `authProfileRef`) plus existing
  prefix/credential-mode/disabled-gate fields.
- The S3-compatible parser rejects backend detail or credential-shaped keys and
  values without echoing private data. It does not read environment credential
  values.
- `toKnowledgeTeamBackendReadinessConfig()` projects a valid private config
  into the existing `infra-agent.knowledge-team-backend-config` shape without
  copying private refs into public readiness JSON.
- `buildKnowledgeTeamS3CompatibleBackendDescriptor()` creates an internal
  sanitized descriptor/capability object for future adapter design only.
- `planKnowledgeTeamBackendAdapterResolution()` recognizes valid
  S3-compatible private configs but returns a blocked
  `real-backend-not-implemented` plan. `resolveKnowledgeTeamBackendAdapter()`
  remains mock-only.
- `test/support/knowledge-team-backend-adapter-conformance.mjs` defines
  mock-backed object-store and metadata-index conformance checks that future
  real adapters must satisfy.

Verification completed:

- Focused new S3/backend tests passed:
  `knowledge-team-s3-compatible-backend-config.test.mjs`,
  `knowledge-team-backend-adapter-resolver.test.mjs`,
  `knowledge-team-backend-adapter-conformance.test.mjs`, and
  `knowledge-team-backend-no-sdk.test.mjs`.
- Focused existing team-storage tests passed:
  `knowledge-team-backend-readiness.test.mjs`,
  `knowledge-team-backend-readiness-validation.test.mjs`,
  `knowledge-team-backend-adapter-store.test.mjs`,
  `knowledge-team-backend-adapter-index.test.mjs`,
  `knowledge-team-artifact-public-contract.test.mjs`,
  `knowledge-team-backend-readiness-contract.test.mjs`, and
  `cli-knowledge-backend-readiness-main.test.mjs`.
- Repo checks passed: `git diff --check`, `npm run lint`,
  `npm run test:structure`, and full `npm run verify`.
- Full verify included lint, structure, unit, integration, contract, isolated,
  smoke, e2e, coverage, and package dry-run checks. Unit reported 449 passing
  tests, coverage reported 577 passing tests in the coverage run, isolated
  execution checked 85 shards, and package dry-run reported 149 packaged
  entries.

Remaining risks and constraints:

- S3-compatible support is a private config contract and fail-closed resolution
  plan only. There is still no real S3 client, no SDK dependency, no credential
  lookup, no live backend probe, no upload command, and no remote mutation.
- Safe structural refs (`storageProfileRef`, `authProfileRef`) are internal
  design inputs. They must not be copied into public team artifact/readiness
  JSON or treated as bucket/endpoint/credential values.
- Public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness schemas remain compact and
  unchanged. Future real adapter work should preserve those contracts unless a
  dedicated schema migration is planned and tested.

Next recommended stage:

- Add an explicit offline credential/source reference registry contract for
  S3-compatible configs. It should validate reference names and required
  environment variable names without reading values, keep resolution
  fail-closed, and extend the no-SDK/no-network guards before any real client
  or upload path is introduced.

## 2026-05-09 Active Team Backend Adapter Interface Plan

Status:

- Completed and verified. This slice defines a backend adapter interface
  boundary and mock-backed contract tests before any real team storage backend
  is added.
- Scope remains interface, dependency-boundary, and mock adapter work only. It
  does not add cloud SDKs, perform network calls, read credential values,
  generate upload commands, mutate remote objects/indexes, or change public
  team artifact/readiness JSON schemas.

Why this direction:

- The previous validation split made `knowledge validate` a dispatcher and
  isolated team artifact/backend readiness contracts. The next safe step is a
  typed adapter seam that future real backends can implement without changing
  compact public contracts.
- Claude Code architecture notes favor parser-enforced compact contracts,
  explicit permission/mutation gates, and injected dependencies. This stage
  keeps backend behavior injected and mock-backed while preserving those gates.

Completed commits and checkpoints:

1. `00be0ce` docs: record team backend adapter plan.
2. `56d97df` test: lock team artifact key helpers.
3. `2bd9321` refactor: extract team artifact key helpers.
4. `e695a39` feat: add team backend adapter contract.
5. `0567ef6` test: cover team backend adapter contract.
6. `be6c5f6` feat: add mock team backend adapter.
7. `3095d15` test: cover adapter object store contract.
8. `22ab9cd` test: cover adapter metadata index contract.
9. `2a74d43` feat: add mock backend adapter resolver.
10. `1454b0b` test: cover backend adapter resolver safety.
11. `d655ef3` docs: document backend adapter boundary.
12. Final handoff update: record focused checks, full verification, remaining
    risks, and next-stage plan.

Acceptance criteria:

- Existing team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness public schemas remain unchanged.
- Adapter capabilities explicitly preserve `mutationAllowed=false`,
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, and `uploadCommand=null`.
- The only implemented adapter is mock/in-memory and injected by tests or
  callers; no real S3/GCS/Azure/Postgres client is created.
- Existing staging/retrieval/publication helper behavior remains compatible
  with the current mock store and metadata index.
- Focused adapter tests, lint, structure, diff check, and full verify pass.

Current design:

- `src/knowledge/team-artifact-keys.ts` owns backend-neutral artifact family,
  content type, SHA, object-key, index-key, and safe-reference helpers.
- `src/knowledge/team-backend-adapter.ts` defines the internal adapter
  descriptor/capability boundary. Capability metadata is intentionally compact
  and fixed to disabled mutation, remote write, live check, credential exposure,
  and upload command.
- `src/knowledge/team-backend-adapter-mock.ts` composes the existing
  in-memory mocked S3-compatible object store and metadata index behind that
  boundary.
- `src/knowledge/team-backend-adapter-resolver.ts` resolves only safe
  `mock-s3-compatible` configs and rejects backend-detail or credential
  leakage without echoing private values.

Verification completed:

- Focused adapter/key tests passed:
  `knowledge-team-backend-adapter.test.mjs`,
  `knowledge-team-backend-adapter-store.test.mjs`,
  `knowledge-team-backend-adapter-index.test.mjs`,
  `knowledge-team-backend-adapter-resolver.test.mjs`, and
  `knowledge-team-artifact-keys.test.mjs`.
- Focused existing team-storage contracts passed:
  `knowledge-s3-compatible-storage.test.mjs`,
  `knowledge-team-artifact-index-readiness.test.mjs`,
  `knowledge-team-artifact-public-contract.test.mjs`, and
  `knowledge-team-backend-readiness-contract.test.mjs`.
- Repo checks passed: `git diff --check`, `npm run lint`,
  `npm run test:structure`, and full `npm run verify`.
- Full verify included lint, structure, unit, integration, contract, isolated,
  smoke, e2e, coverage, and package dry-run checks. Coverage reported
  565 passing tests in the coverage run, and package dry-run reported
  148 packaged entries.

Remaining risks and constraints:

- The only adapter implementation is the injected in-memory
  `mock-s3-compatible` adapter. This is deliberate; no real S3/GCS/Azure/
  Postgres backend exists yet.
- The resolver intentionally rejects backend detail and credential-shaped
  config. A future real backend must introduce an explicit private config shape
  plus approval/mutation gates rather than weakening this resolver.
- Public team artifact descriptor, publication-plan, index-entry,
  publication-readiness, and backend-readiness schemas remain compact and
  backend-neutral. Future adapter work should add implementation behind the
  internal adapter boundary, not by expanding public handoff JSON.

Next recommended stage:

- Add the first real backend adapter design only as a contract-first slice:
  choose one backend, define private config parsing separately from public
  readiness JSON, preserve `remoteWriteAllowed=false` by default, and add
  mock-backed tests for config validation before any SDK, credential lookup,
  live check, upload command, or remote mutation is introduced.

## 2026-05-09 Active Team Validation Helper Split Plan

Status:

- Completed. This slice reduces `src/knowledge/validate.ts` risk by moving
  team artifact and team backend readiness validation helpers into focused
  modules before any real backend adapter work starts.
- Scope is structural refactor plus focused regression coverage. It must not
  change public JSON schemas, add backend SDKs, perform network calls, read
  credential values, create upload commands, or mutate remote storage/indexes.

Why this direction:

- The previous slices locked public team artifact contracts and added backend
  readiness as a compact dry-run routing surface. `validate.ts` is now large
  enough that future backend adapter work would raise regression risk unless
  team-specific validators are isolated behind narrower modules.
- Claude Code architecture notes favor parser-enforced compact handoff
  contracts. This split keeps those contracts parser-enforced while making the
  validation boundary easier for future agents to inspect and extend.

Planned commits and checkpoints:

1. Completed: record this active validation split plan in `docs/HANDOFF.md`.
2. Completed: add shared knowledge validation primitives used by extracted
   validators.
3. Completed: add direct tests for shared blocker/code summary helpers.
4. Completed: extract backend readiness validation into
   `src/knowledge/team-backend-readiness-validation.ts`.
5. Completed: add focused backend readiness validation regression tests.
6. Completed: extract shared team artifact validation helpers into
   `src/knowledge/team-artifact-validation.ts`.
7. Completed: move descriptor/index-entry validation into the team artifact
   validation module.
8. Completed: move publication-plan/readiness validation into the team artifact
   validation module.
9. Completed: run existing team artifact/backend contract and CLI regression
   tests during each migration checkpoint.
10. Completed: update README, Rules, Roadmap/pattern notes, and this handoff
    with the split boundary and remaining non-goals.
11. Completed: run lint, test structure, diff check, focused
    unit/contract/integration checks, and full `npm run verify`.
12. Completed: record final completed commits, validation, remaining risks, and
    next stage in this handoff.

Current validation split modules:

- `src/knowledge/validation-primitives.ts` contains shared validation issue,
  report, empty freshness/report, scalar reader, and blocker-code summary
  helpers.
- `src/knowledge/storage-policy-validation.ts` contains reusable storage
  policy summary validation.
- `src/knowledge/team-artifact-validation.ts` owns team artifact descriptor,
  publication-plan, index-entry, publication-readiness, content-addressed key,
  blocker summary, and leakage validation.
- `src/knowledge/team-backend-readiness-validation.ts` owns backend-readiness
  report validation and backend detail/credential leakage checks.
- `src/knowledge/validate.ts` is now the top-level knowledge payload
  dispatcher plus non-team knowledge validators.

Acceptance criteria:

- `validateKnowledgePayload` continues to accept and reject the same team
  artifact and backend readiness payloads as before the split.
- Descriptor, publication-plan, index-entry, publication-readiness, and
  backend-readiness public JSON schemas remain unchanged.
- Existing contract and CLI validation round-trip tests continue to pass.
- New helper modules do not import CLI code, create backend clients, read
  credentials, perform network calls, write remote storage, or produce upload
  commands.
- `src/knowledge/validate.ts` becomes primarily the top-level dispatcher plus
  non-team knowledge validators.

Completed commits:

1. `398fa3a` docs: record team validation split plan
2. `d598260` refactor: add knowledge validation primitives
3. `fa6b399` test: cover knowledge validation primitives
4. `1d2c1bd` refactor: extract team backend readiness validation
5. `59b20a2` test: cover backend readiness validation module
6. `f14ff65` refactor: share storage policy summary validation
7. `2a99973` refactor: extract team artifact descriptor validation
8. `b603f41` refactor: extract team publication validation
9. `6cd63a8` test: cover team artifact validation module
10. `0272c16` docs: document team validation split boundary

Verification completed:

- `git diff --check`
- `npm run test:structure`
- `npm run lint`
- Focused team artifact/backend readiness unit, contract, and CLI regression
  shards during migration checkpoints.
- `npm run verify`
- Coverage after verify: lines 89.17%, branches 77.31%, functions 96.47%.
- Package dry-run after verify: `entryCount` 144.

Remaining risks and next stage:

- `src/knowledge/team-artifact-validation.ts` is now intentionally isolated
  but large; if future real adapter work adds more team-storage contract
  families, split common key/leak/blocker helpers into a smaller internal
  helper module first.
- The next backend stage should define a real adapter interface and mock-backed
  contract tests before any cloud SDK, credential lookup, network check, upload
  command, or remote index mutation is added.
- Public contract payloads remain frozen for descriptor, publication-plan,
  index-entry, publication-readiness, and backend-readiness unless a future
  slice explicitly documents and tests a schema migration.

## 2026-05-09 Team Backend Readiness Boundary

Status:

- Completed. This slice defines the safe boundary for future real team-cache
  backend adapters without implementing cloud SDKs, network access, remote
  writes, upload commands, or credential handling.
- Scope stayed limited to a private backend config parser, a compact backend
  readiness report, validation and CLI coverage for that readiness report, and
  documentation that keeps existing descriptor/publication-plan/index-entry/
  readiness public contracts free of backend details.

Why this direction:

- The previous slice locked compact team artifact public contracts. The next
  backend-oriented step needs an explicit adapter/config/readiness boundary
  before any remote mutation can be designed safely.
- Claude Code architecture notes favor parser-enforced compact handoff surfaces
  and permission gates before mutation. A dry-run backend readiness report is
  the smallest useful next surface: it can describe whether a local backend
  config is structurally ready for future explicit upload while keeping
  `remoteWriteAllowed=false`.

Subagent review inputs:

- `Hilbert` recommended backend readiness/config boundary as the next main
  slice rather than a broad validation refactor. It called out no SDK, no
  network, no upload, no credential-value reads, and no readiness-as-approval.
- `Cicero` recommended a separate pure module for backend readiness metadata
  rather than adding cloud-provider details to `team-artifact-store.ts` or the
  existing public artifact contracts.
- `Nash` recommended one focused unit shard, one contract shard, one CLI
  integration shard, args coverage, leak regressions, and the full `verify`
  gate.

Completed commits:

1. `3ec8b13` docs: record team backend readiness plan
2. `7ac49ab` feat: add team backend readiness model
3. `723a6a7` test: cover team backend readiness success path
4. `ad7f5f8` fix: sanitize team backend readiness blockers
5. `2d75494` test: cover blocked team backend readiness
6. `137d61f` feat: validate team backend readiness payloads
7. `9a6d9c9` test: lock team backend readiness contract
8. `1c561c6` feat: parse team backend readiness args
9. `813f98f` feat: add team backend readiness command
10. `31efdd4` test: cover team backend readiness command
11. `0021d35` docs: document team backend readiness boundary
12. This handoff update records final verification for the slice.

Core files changed:

- `src/knowledge/team-backend-readiness.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-backend-readiness.test.mjs`
- `test/contract/knowledge-team-backend-readiness-contract.test.mjs`
- `test/integration/cli-knowledge-backend-readiness-main.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `skills/infra-configuration/SKILL.md`

What changed:

- Added `infra-agent.knowledge-team-backend-readiness`, a compact dry-run
  report derived from a local private backend config.
- Added a pure readiness builder for `s3-compatible` backend config shape. It
  never reads environment values, creates a backend client, performs a live
  check, writes remote objects, mutates a metadata index, or produces an upload
  command.
- Blocked configs keep structured blocker codes and sanitized blocker paths
  while avoiding backend detail, credential-value, URL, and absolute-path
  leakage.
- Extended `knowledge validate` to accept and reject backend-readiness payloads
  with status/action/blocker consistency checks.
- Added `infra-agent knowledge backend-readiness <backend-config.json>
  [--out <readiness.json>] [--json]` for local readiness reporting. `--out`
  only writes a local JSON artifact.
- Updated docs and the infra skill so downstream agents treat backend readiness
  as routing state for future explicit-upload design, not upload approval or
  proof that a remote backend was checked.

Acceptance criteria:

- A local backend config can produce a compact
  `infra-agent.knowledge-team-backend-readiness` report.
- The readiness report is dry-run only: `mutationAllowed=false`,
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, and `uploadCommand=null`.
- The readiness report must not expose backend URLs, buckets, endpoints,
  headers, credential values, absolute paths, raw docs, raw facts, or raw source
  arrays.
- Unsafe or incomplete backend configs produce blocked readiness reports rather
  than throwing away structured blocker state.
- Existing descriptor, publication-plan, index-entry, and publication-readiness
  payloads remain unchanged and backend-neutral.
- No real backend adapter, SDK, network call, credential lookup, upload command,
  remote object read/write, or metadata index mutation is introduced.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-backend-readiness.test.mjs`
- `node --experimental-strip-types test/contract/knowledge-team-backend-readiness-contract.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-backend-readiness-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `npm run test:structure`
- `npm run lint`
- `git diff --check`
- `npm run verify`

Full verification result:

- `npm run verify` passed on 2026-05-09.
- Coverage gate passed at 89.16% lines, 77.30% branches, and 96.50%
  functions.
- `npm pack --dry-run --json` passed with 140 package entries.

Remaining risks:

- There is still no real S3/GCS/Azure/Postgres backend adapter, no real remote
  metadata index service, and no CLI upload/publication command.
- Backend readiness reports prove only local config shape. They do not prove
  remote reachability, credentials, object existence, or index state.
- `src/knowledge/validate.ts` is now larger after adding another compact
  payload. The next backend-oriented implementation should split team artifact
  and backend readiness validation helpers before adding real adapter behavior.

Next stage:

- Split team artifact/backend readiness validation helpers into focused modules,
  then design the real adapter interface behind the already-validated readiness
  and public artifact contracts.
- Keep remote write execution behind a separate explicit approval model; do not
  let backend readiness, publication readiness, or CLI `--out` imply upload
  approval.

## 2026-05-09 Team Artifact Public Contract Hardening

Status:

- Completed. This slice hardens the public JSON contracts for compact team
  artifact handoff payloads before any real backend adapter work starts.
- Scope stayed limited to contract tests, shared test fixtures, CLI validation
  coverage, documentation, and minimal validator hardening for existing payload
  families: descriptor, publication plan, index entry, and publication
  readiness. It did not introduce real remote backends, credentials, upload
  commands, SDKs, or live index reads/writes.

Why this direction:

- The team artifact store, publication plan, metadata index entry, and readiness
  report are now agent-to-agent handoff surfaces. The Claude Code architecture
  notes require parser-enforced contracts before downstream agents route on
  compact JSON.
- Contract hardening is the safest next step because it freezes the external
  compact shapes and catches drift before a real backend adapter depends on
  them.

Subagent review inputs:

- `Hilbert` recommended freezing the public JSON shapes first with 10+ commits,
  explicit non-goals for real backend/upload work, and a final `npm run verify`
  gate.
- `Cicero` recommended importing the existing content-address key builders into
  validation, enforcing blocker-code summaries, and keeping validator hardening
  schema-compatible.
- `Nash` recommended dedicated contract coverage for descriptor, publication
  plan, index entry, and readiness payloads plus CLI validation round trips and
  negative leak regressions.

Completed commits:

1. `65dcc2e` docs: record team artifact contract plan
2. `e8a3350` test: add team artifact contract fixtures
3. `652bffc` test: cover team artifact descriptor contract
4. `f7d58c4` feat: harden team artifact descriptor contract validation
5. `50e9751` test: cover team publication plan contract
6. `f41d319` test: cover team artifact index entry contract
7. `c8691a8` test: cover team publication readiness contract
8. `c95aa74` test: cover team artifact contract CLI validation
9. `8fa4fdc` docs: document team artifact contract gate
10. This handoff update records final verification for the slice.

Core files changed:

- `src/knowledge/validate.ts`
- `test/support/knowledge-team-artifact-fixtures.mjs`
- `test/contract/knowledge-team-artifact-public-contract.test.mjs`
- `test/integration/cli-knowledge-team-contract-main.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `skills/infra-configuration/SKILL.md`

What changed:

- Added reusable generated fixtures for public team artifact descriptor,
  publication-plan, index-entry, and readiness payloads.
- Added contract tests for valid public payload shapes and negative drift cases:
  remote write posture, backend detail fields, upload commands, credentials,
  unsafe keys, absolute local paths, raw facts/sources, object/index key drift,
  and blocker-code summary drift.
- Added CLI validation coverage that writes the four public payloads and checks
  `knowledge validate --json` accepts valid files and rejects a forged readiness
  payload.
- Hardened validators so content-addressed object/index keys must match their
  SHA-256 values and publication/readiness blocker summaries must match their
  blocker arrays.
- Updated user and agent-facing docs to treat descriptor, publication plan,
  index entry, and readiness JSON as public contract handoff payloads, not raw
  artifact or backend configuration containers.

Acceptance criteria:

- Contract tests cover `infra-agent.knowledge-team-artifact-descriptor`,
  `infra-agent.knowledge-team-publication-plan`,
  `infra-agent.knowledge-team-artifact-index-entry`, and
  `infra-agent.knowledge-team-publication-readiness`.
- Validators reject malformed mutation posture, remote writes, credentials,
  upload commands, backend URLs/buckets/endpoints/headers, absolute workspace
  paths, cache roots, raw docs, raw repo content, unsafe object keys, and
  content-address/key/hash drift.
- Blocker code summaries must match blocker arrays for publication plans and
  readiness reports.
- Valid generated fixtures continue to pass `knowledge validate` and contract
  tests.
- No real backend, upload, network, credential, or live metadata index behavior
  is introduced.

Validation completed:

- `node --experimental-strip-types test/contract/knowledge-team-artifact-public-contract.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-artifact-index-readiness.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-team-contract-main.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-artifact-descriptor-validation.test.mjs`
- `node --experimental-strip-types test/unit/knowledge-team-artifact-publication-plan.test.mjs`
- `npm run test:structure`
- `npm run lint`
- `git diff --check`
- `npm run verify`

Full verification result:

- `npm run verify` passed on 2026-05-09.
- Coverage gate passed at 89.17% lines, 77.44% branches, and 96.52%
  functions.
- `npm pack --dry-run --json` passed with 139 package entries.

Remaining risks:

- There is still no real S3/GCS/Azure/Postgres backend adapter, no real remote
  metadata index service, and no CLI upload/publication command.
- Readiness reports remain compact local routing artifacts. They do not prove a
  remote object exists.
- `src/knowledge/validate.ts` is getting large. The next backend-oriented slice
  should consider splitting team artifact validation helpers once the adapter
  boundary is clearer.

Next stage:

- Add a real backend adapter only after preserving these public contracts.
- Keep remote writes disabled by default and require explicit future design for
  credentials, backend configuration, upload approval, and metadata index
  mutation.

## 2026-05-09 Team Metadata Index Readiness

Status:

- Completed. This slice extends the completed team artifact descriptor and
  publication-plan dry run with a compact metadata index/readiness boundary.
- Scope is still non-mutating with respect to real team infrastructure. It may
  model an injected mock metadata index and read local JSON artifacts, but it
  must not introduce AWS/GCS/Azure SDKs, credentials, buckets, endpoints,
  signed URLs, network reads, remote writes, or a real upload command.

Why this direction:

- `knowledge publish-plan` can now prove whether a persisted pack is eligible
  for future publication. The next safe step is to model the metadata record a
  future team cache would index and a compact readiness report that says
  `already-published`, `upload-required`, `blocked`, or `conflict` without
  touching real infrastructure.
- This follows the Claude Code architecture notes: downstream agents should
  route on compact validated state, not raw artifacts, backend details, or
  prose-only assumptions.

Subagent review inputs:

- `Hilbert` recommended metadata index records before any real cloud backend,
  with a 10+ commit path, compact validation, and explicit no-remote non-goals.
- `Cicero` recommended keeping this as a dry-run metadata/index boundary rather
  than introducing cloud SDKs, credentials, or an upload command. The final
  implementation adds compact index entries and readiness reports while
  preserving that boundary.
- `Nash` recommended focused unit/integration tests for readiness, metadata
  safety, validator negative cases, CLI args, CLI JSON/text behavior, and full
  verification.

Completed commits:

1. `22722af` docs: record team metadata readiness plan
2. `8fc3d34` feat: add team artifact index readiness contracts
3. `523077f` feat: build team publication readiness reports
4. `824af1b` test: cover team artifact index entries
5. `31876b6` test: cover team publication readiness outcomes
6. `b872773` feat: add mock team artifact metadata index
7. `8de8cfe` test: cover mock team artifact metadata index
8. `d4acbfa` feat: validate team artifact index readiness payloads
9. `cadcdd1` test: cover team index readiness validation
10. `1f018ba` feat: parse knowledge publish-readiness args
11. `3089da8` feat: add knowledge publish-readiness command
12. `5b591a8` test: cover knowledge publish-readiness command
13. `0741f38` docs: document publication readiness dry run

Core files changed:

- `src/knowledge/team-artifact-store.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-artifact-index-readiness.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-knowledge-publish-readiness-main.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `skills/infra-configuration/SKILL.md`

What changed:

- Added `infra-agent.knowledge-team-artifact-index-entry`, a compact metadata
  record derived from a team artifact descriptor.
- Added `infra-agent.knowledge-team-publication-readiness`, a dry-run report
  derived from a publication plan plus an optional compact index entry. It
  reports `already-published`, `upload-required`, `blocked`, or `conflict`.
- Added a pure readiness builder and descriptor-to-index-entry builder. These
  builders do not call a store, read a remote index, or mutate an index.
- Added an injected in-memory `mock-s3-compatible` metadata index with
  idempotent put, get, find-by-object, list, unsafe key rejection, and conflict
  detection.
- Extended `knowledge validate` for compact index entries and readiness reports,
  including forged remote-write, upload-command, backend-detail, URL, and
  credential rejection.
- Added `infra-agent knowledge publish-readiness <plan.json> [--index-entry
  <entry.json>] [--out <readiness.json>] [--json]` with input validation and
  safe text/JSON output.

Acceptance criteria:

- New payloads use `mutationAllowed=false`, `remoteWriteAllowed=false`,
  `credentialRequired=false`, and `uploadCommand=null` where publication
  posture is discussed.
- Index entries are compact metadata records derived from validated team
  artifact descriptors. They may include backend kind, object key, hash, byte
  length, artifact id/counts, storage-policy summary, and publication counts,
  but not backend URLs, buckets, endpoints, credentials, headers, absolute
  paths, raw docs, or raw repo content.
- Readiness reports are compact dry-run decisions derived from a publication
  plan and optional compact index entry. They must not call a store, read a
  remote index, or mutate an index.
- Blocked publication plans remain valid readiness inputs and produce blocked
  readiness reports with compact blocker codes.
- `knowledge validate` can validate saved index-entry and readiness JSON
  artifacts without remote reads or writes.
- CLI behavior remains local-only and explicitly dry-run.

Design notes:

- This slice intentionally kept real metadata services out of scope. The mock
  index proves the compact contract and conflict behavior only.
- Readiness reports do not prove a remote object exists. They compare local
  compact plan/index metadata and produce routing state for future agents.
- The implementation kept the existing `team-artifact-store.ts` boundary to
  minimize new module churn in this stage. A future cleanup may split store,
  publication plan, and index readiness code once the next real backend adapter
  boundary is ready.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-artifact-index-readiness.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-publish-readiness-main.test.mjs`
- `npm run test:structure`
- `npm run lint`
- `npm run verify`

Full verification result:

- `npm run verify` passed on 2026-05-09.
- Coverage gate passed: lines 89.09%, branches 77.40%, functions 96.46%.
- `npm pack --dry-run --json` passed with 139 package entries.

Remaining risks and next stage:

- There is still no real S3/GCS/Azure/Postgres backend, credential model,
  signed URL flow, upload command, or remote metadata index service.
- `already-published` readiness only means the provided compact index entry
  matches the plan; it does not prove remote object existence.
- Next stage should either add contract-style tests for the public JSON shapes
  or design the first real backend adapter behind the existing dry-run,
  validation, and approval boundaries.

## 2026-05-09 Team Publication Plan Dry-Run

Status:

- Completed. This slice extends the completed team artifact store abstraction
  with a non-mutating publication dry-run plan for persisted knowledge packs.
- Scope remains plan generation and validation only. It reads a persisted
  `knowledge-pack` artifact, its plan-only artifact manifest, and optionally a
  compact team artifact descriptor, then reports whether a future team-cache
  publication would be allowed. It does not call `putObject`, does not write a
  mock store, and does not introduce a real remote backend.

Why this direction:

- The previous slice proved content-addressed staging through an injected mock
  adapter. The next safe step is a compact plan artifact that downstream agents
  can validate and discuss before any real publication command exists.
- This follows the local Claude Code architecture notes: preserve compact,
  validated handoff state and permission posture instead of passing raw
  artifacts, raw logs, or backend details between agents.

Subagent review inputs:

- `Hilbert` recommended a 10+ commit plan centered on
  `infra-agent.knowledge-team-publication-plan`, with dry-run semantics,
  blocked-plan results as first-class output, descriptor reuse checks, validator
  support, CLI JSON/text output, and final documentation/verification.
- `Cicero` recommended keeping this as a compact dry-run payload rather than
  reusing the staging helper, because staging intentionally writes through a
  store adapter. The final implementation follows that boundary.
- `Nash` recommended focused unit coverage, CLI args coverage, CLI integration
  coverage, and first-class blocked-plan validation. Those checks are now in
  place.

Completed commits:

1. `3710f26` docs: record team publication plan slice
2. `e50922e` feat: add team publication plan builder
3. `8eefc18` test: cover team publication plan dry run
4. `5e5ccc7` test: cover blocked team publication plans
5. `6309ffc` feat: validate team publication plans
6. `e0a1a54` test: cover team publication plan validation
7. `88417dd` feat: parse knowledge publish-plan args
8. `5a00d12` test: cover knowledge publish-plan args
9. `c68c7c9` feat: add knowledge publish-plan command
10. `059ae42` test: cover knowledge publish-plan command
11. `58706eb` docs: document publication plan dry run

Core files changed:

- `src/knowledge/team-artifact-store.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/unit/knowledge-team-artifact-publication-plan.test.mjs`
- `test/integration/cli-knowledge-args-main.test.mjs`
- `test/integration/cli-knowledge-publish-plan-main.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `skills/infra-configuration/SKILL.md`

What changed:

- Added `infra-agent.knowledge-team-publication-plan` as a compact,
  backend-neutral dry-run artifact for future team-cache publication decisions.
- Added `buildKnowledgeTeamPublicationPlan`, a pure builder that checks manifest
  bytes, artifact hash, manifest metadata, publication policy, and optional
  descriptor reuse without accepting a store adapter or writing object bytes.
- Added first-class blocked plans for workspace-private sources, stale sources,
  unchecked sources, forged publication posture, hash drift, metadata drift, and
  descriptor mismatch.
- Extended `knowledge validate` to accept allowed and blocked publication plans
  while rejecting mutation flags, upload commands, unsafe object keys, backend
  details, credentials, URLs, raw content, and path leakage.
- Added `infra-agent knowledge publish-plan <manifest.json> [--descriptor <descriptor.json>] [--out <plan.json>] [--json]`
  with safe text and JSON output.

Acceptance criteria:

- `infra-agent.knowledge-team-publication-plan` uses
  `mutationAllowed=false`, `remoteWriteAllowed=false`, and dry-run execution.
- The plan is compact and backend-neutral. It may include backend kind,
  content-addressed object key, artifact hash, byte length, source/fact counts,
  required validation labels, policy status, and blocker codes, but never
  backend URLs, buckets, endpoints, headers, credentials, absolute workspace
  paths, cache roots, raw docs, or raw repo content.
- Allowed plans require fresh public-reference `knowledge-pack` artifacts with
  matching manifest bytes and metadata.
- Blocked plans are first-class results for workspace-private sources, stale
  sources, unchecked sources, forged publication posture, hash drift, metadata
  drift, and descriptor mismatch.
- `knowledge validate` can validate saved publication-plan JSON without
  performing remote reads or writes.
- CLI behavior remains explicitly dry-run and local-only.

Design notes:

- The publication-plan builder is intentionally separate from
  `stageKnowledgePackArtifactForTeamStore`, because the staging path performs a
  store write and this slice must remain a pure planning surface.
- A blocked plan is valid handoff state, not an exception. Downstream agents can
  inspect blocker codes without reconstructing raw artifact content.
- An allowed plan is not an approval to upload. The plan only proves the current
  local artifact is eligible for a future publication flow under the existing
  policy checks.

Validation completed:

- `node --experimental-strip-types test/unit/knowledge-team-artifact-publication-plan.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-args-main.test.mjs`
- `node --experimental-strip-types test/integration/cli-knowledge-publish-plan-main.test.mjs`
- `npm run test:structure`
- `npm run lint`
- `npm run verify`

Full verification result:

- `npm run verify` passed on 2026-05-09.
- Coverage gate passed: lines 89.30%, branches 77.86%, functions 96.57%.
- `npm pack --dry-run --json` passed with 139 package entries.

Remaining risks and next stage:

- There is still no real S3/GCS/Azure backend, upload command, credential
  model, signed URL flow, or remote metadata index.
- Descriptor reuse checks compare compact local metadata only; they do not prove
  a remote object exists.
- Future upload implementation must consume this plan as a precondition and
  preserve the same backend-detail and credential leak boundaries.

## 2026-05-09 Active Team Artifact Store Plan

Status:

- Completed. This slice implements the first Team Backend Abstraction step
  from `docs/ROADMAP.md`: a backend-neutral, content-addressed artifact store
  contract plus a mocked S3-compatible adapter for knowledge packs.
- Scope is intentionally narrow. Local filesystem remains the default cache and
  artifact persistence path. This slice does not introduce real S3/GCS/Azure,
  network writes, credentials, buckets, endpoints, signed URLs, upload
  commands, or automatic agent-loop publication.

Why this direction:

- Existing knowledge artifacts can already emit plan-only manifests with byte
  hashes, publication posture, and validation requirements.
- The next durable step is a storage abstraction that proves object identity,
  privacy gating, and retrieval integrity before any real remote backend is
  designed.
- The Claude Code architecture lesson remains the same: pass compact,
  validated descriptors between agents; do not pass raw docs, raw repo files,
  credentials, or backend details through handoff surfaces.

Subagent review inputs:

- `Goodall` confirmed this must be a new artifact/team store layer, not an
  expansion of the existing source-cache `KnowledgeStore`.
- `Plato` recommended focused unit shards for store contracts, mocked
  S3-compatible behavior, and publication policy; existing large cache/pack
  shards should not absorb this whole feature.
- `Pasteur` proposed a 10+ commit path with independent checkpoints covering
  planning, types, canonical bytes, object keys, policy gates, mock adapter,
  service round trips, descriptor validation, docs, and final verification.

Planned commits and checkpoints:

1. Record this active team artifact store plan in `docs/HANDOFF.md`.
2. Add canonical knowledge artifact serialization and full-sha256 object key
   helpers.
3. Cover deterministic canonical bytes and secret-safe content-addressed keys.
4. Define backend-neutral team artifact descriptor and store interfaces.
5. Implement an in-memory mocked S3-compatible artifact store.
6. Cover put/get/head/idempotency, key validation, conflicts, and missing
   objects.
7. Add team artifact publication policy checks for public-reference,
   non-stale knowledge packs.
8. Cover blocking workspace-private, stale, unchecked, forged, and
   hash-mismatched artifacts.
9. Wire high-level staging and retrieval through the mocked adapter.
10. Cover descriptor round trips and tamper rejection without leaking paths,
    backend details, credentials, or raw content.
11. Extend knowledge validation to accept the compact team artifact descriptor
    contract.
12. Update roadmap, agent rules, bundled skill docs, README, and this handoff
    with completed behavior and remaining risks.
13. Run focused validation after important phases and the full `npm run verify`
    gate before final handoff.

Acceptance criteria:

- Existing `knowledge pack --out --manifest-out` behavior stays local-only and
  plan-only by default.
- The mocked S3-compatible adapter stores and retrieves artifact bytes by a
  full SHA-256 content address, not by local paths, source URLs, pack ids, or
  caller-provided mutable keys.
- Only validated, public-reference, fresh knowledge packs may be staged to the
  team artifact store. Workspace-private, stale, unchecked, forged, or
  hash-mismatched artifacts are rejected before any mock store write.
- Store descriptors are compact and backend-neutral. They include kind,
  schemaVersion, mutationAllowed=false, backend kind, object key, hash, byte
  length, counts, storage-policy summary, and publication counts, but never
  backend URLs, buckets, endpoints, headers, credentials, absolute workspace
  paths, cache roots, raw docs, or raw repo content.
- Retrieval re-hashes stored bytes and rejects tampering before returning the
  artifact payload.
- Full verification passes before the stage is considered complete.

Core files changed:

- `src/knowledge/team-artifact-store.ts`
- `src/knowledge/validate.ts`
- `test/unit/knowledge-team-storage-contracts.test.mjs`
- `test/unit/knowledge-s3-compatible-storage.test.mjs`
- `test/unit/knowledge-team-publication-policy.test.mjs`
- `test/unit/knowledge-team-artifact-roundtrip.test.mjs`
- `test/unit/knowledge-team-artifact-descriptor-validation.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`
- `skills/infra-configuration/SKILL.md`

What changed:

- Added canonical knowledge artifact JSON serialization and full SHA-256 object
  key helpers under `knowledge-artifacts/v1/<family>/sha256/<prefix>/<hash>.json`.
- Added `infra-agent.knowledge-team-artifact-descriptor` as a compact,
  backend-neutral descriptor for staged public-reference knowledge packs.
- Added a `KnowledgeTeamArtifactStore` interface and in-memory
  `mock-s3-compatible` adapter with put/head/get, idempotent writes, content
  type checks, safe metadata checks, unsafe key rejection, missing-object
  behavior, and conflict detection.
- Added publication-policy gating that rejects non-pack artifacts, forged
  publication plans, workspace-private sources, stale sources, unchecked
  sources, explicit-opt-in-required sources, and hash/metadata mismatches before
  a mock store write.
- Added high-level staging and retrieval helpers. Staging re-hashes bytes,
  parses the pack, checks manifest metadata, evaluates policy, stores by
  content address, and returns a compact descriptor. Retrieval checks backend
  kind, content type, byte length, byte hash, and descriptor/payload metadata
  before returning the pack.
- Extended `knowledge validate` to accept and validate compact team artifact
  descriptors without performing any remote read or write.

Design notes:

- This is still an abstraction slice, not a remote backend. It adds no AWS SDK,
  cloud provider dependency, endpoint, bucket, credential, signed URL, upload
  command, environment variable, network path, CLI publication command, or
  agent-loop publication behavior.
- The existing source-cache `KnowledgeStore` remains separate and local-first.
  Team artifact storage is a distinct pack/blob object-store boundary.
- Object identity uses the full artifact byte SHA-256, not the short pack id or
  a local file path.
- Descriptors intentionally omit manifest `artifact.path`, `workspaceRoot`,
  `cacheRoot`, backend URLs, buckets, endpoints, headers, credentials, raw docs,
  and raw repo content.

Known validation:

- `node --experimental-strip-types test/unit/knowledge-team-storage-contracts.test.mjs`:
  passed with 3 tests.
- `node --experimental-strip-types test/unit/knowledge-s3-compatible-storage.test.mjs`:
  passed with 3 tests.
- `node --experimental-strip-types test/unit/knowledge-team-publication-policy.test.mjs`:
  passed with 4 tests.
- `node --experimental-strip-types test/unit/knowledge-team-artifact-roundtrip.test.mjs`:
  passed with 4 tests.
- `node --experimental-strip-types test/unit/knowledge-team-artifact-descriptor-validation.test.mjs`:
  passed with 3 tests.
- `npm run lint`: passed with 214 checked files.
- `npm run test:structure`: passed with 77 checked files.
- `npm run verify`: passed. This covered lint, test structure, unit,
  integration, contract, isolated shards, smoke, e2e, coverage, and package
  dry-run.
- Coverage remained above gates: 89.33% lines, 78.11% branches, and 96.55%
  functions.
- Package dry-run passed with 139 entries, including
  `src/knowledge/team-artifact-store.ts`.

Remaining risks and constraints:

- No real S3/GCS/Azure/Postgres backend exists yet.
- No metadata index, search/query API, or CLI publication command exists yet.
- There is no explicit opt-in path for sharing workspace-private packs. Private,
  stale, and unchecked sources remain blocked by default.
- The mocked S3-compatible adapter is intentionally in-memory and test/injected
  only. It proves object identity and safety gates, not cloud provider
  integration.

## 2026-05-09 Active Official-Doc HTML Normalization Plan

Status:

- Completed. This slice adds lightweight HTML-to-Markdown normalization for
  official docs fetched through the explicit `prefetch` / `knowledge prefetch`
  path.
- Scope is fetched-cache normalization only. No agent-loop live refresh, no
  background network fetch, no team cache backend, no broad HTML parser
  dependency, and no raw official-doc expansion into compact handoff is in
  scope.

Why this direction:

- `docs/ROADMAP.md` now leaves optional live-doc markdown normalization as the
  next public official-doc gap after cache freshness UX.
- Existing Pulumi and Helm markdown extractors intentionally skip HTML-shaped
  cache entries. Normalizing explicit fetch results to bounded Markdown lets
  the existing cache-first extract/pack path use official docs without
  weakening the agent-loop boundary.
- The Claude Code architecture lesson stays bounded here: normalize tool/fetch
  output at the cache boundary, keep compact facts and summaries downstream,
  and avoid passing raw fetched pages into planner prompts.

Subagent review inputs:

- `Raman` confirmed the slice belongs at the explicit fetch/prefetch boundary,
  not in the agent loop. Suggested optional CLI gating was not adopted because
  `prefetch` / `knowledge prefetch` is already the deliberate refresh boundary.
- `Hypatia` recommended a new focused unit shard for normalization and warned
  not to grow `knowledge-sources-retrieval.test.mjs`, which is near the
  1,000-line guard.
- `Ohm` confirmed the PM plan, acceptance criteria, and hard boundaries:
  no agent-loop live refresh, no team backend, no crawler, no compact raw-doc
  exposure, and no source-selection/fact-ranking/storage-policy changes.

Planned commits and checkpoints:

1. Record this active official-doc HTML normalization plan in
   `docs/HANDOFF.md`.
2. Add a small deterministic official-doc content normalizer with HTML
   detection and unsafe-block stripping.
3. Cover HTML detection, unsafe block stripping, heading/list/code/link
   Markdown conversion, and entity decoding.
4. Extend the normalizer with compact HTML table-to-Markdown conversion.
5. Cover normalized table output for Pulumi resource-style and Helm
   value-style docs.
6. Integrate the normalizer into `fetchOfficialKnowledgeSource` so explicit
   official-doc fetches store normalized Markdown when the response is HTML.
7. Cover official fetch normalization, metadata, stale-after preservation, and
   non-HTML passthrough.
8. Cover normalized Pulumi official docs flowing through cached fact
   extraction without raw HTML.
9. Cover normalized Helm chart docs flowing through cached fact extraction
   without raw HTML.
10. Update README, agent rules, roadmap, bundled skill docs, and this handoff
    with completed behavior and remaining risks.
11. Run focused validation after each important phase and the full
    `npm run verify` gate before final handoff.

Acceptance criteria:

- `fetchOfficialKnowledgeSource` converts `text/html` official-doc responses
  into compact `text/markdown` cache writes before persistence.
- Normalization handles common headings, paragraphs, bullets, code spans,
  links, and simple HTML tables used by Pulumi Registry and Helm docs.
- Scripts, styles, SVG, comments, and other unsafe or high-noise blocks are
  stripped before cache writes.
- Existing cached Markdown, JSON, YAML, and plain text behavior remains
  compatible.
- Pulumi and Helm cached-doc fact extraction can consume normalized explicit
  fetch output without accepting raw HTML-shaped cache entries directly.
- No live refresh is added to `agent`, `run`, planner prompts, or automatic
  retrieval paths.
- JSON/text compact outputs do not expose raw fetched HTML, raw Markdown,
  cache hashes, request headers, or credentials.

Progress log:

- Commit 1 records this active official-doc HTML normalization plan, scope,
  acceptance criteria, and checkpoints in `docs/HANDOFF.md`. Focused
  validation: `git diff --check`.
- Commit 2 adds the deterministic official-doc HTML normalizer with HTML
  detection, unsafe block stripping, entity decoding, and common
  heading/list/code/link conversion. Focused validation:
  `node --experimental-strip-types -e "import('./src/knowledge/official-doc-normalize.ts')"`;
  `git diff --check`.
- Commit 3 adds focused normalizer coverage in a new unit shard. Focused
  validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 4 adds compact HTML table normalization for existing Pulumi and Helm
  Markdown fact extractors. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `git diff --check`.
- Commit 5 covers Pulumi input and Helm values table normalization, including
  code-span preservation and Markdown table shape. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 6 wires normalization into `fetchOfficialKnowledgeSource` for explicit
  official-doc HTML fetches, preserving stale-after behavior and safe retrieval
  metadata. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-sources.test.mjs`;
  `git diff --check`.
- Commit 7 covers official fetch normalization and non-HTML Markdown
  passthrough. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-sources.test.mjs`;
  `git diff --check`.
- Commit 8 proves normalized Pulumi resource docs extract compact
  `pulumi-docs-markdown` argument facts without raw HTML. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-extraction.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 9 proves normalized Helm chart docs extract compact
  `helm-chart-docs-markdown` chart-value facts without raw HTML. Focused
  validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `node --experimental-strip-types test/unit/knowledge-helm-chart-docs-extraction.test.mjs`;
  `git diff --check`.
- Commit 10 proves explicit prefetch stores normalized HTML docs and does not
  rewrite fresh cache entries solely for normalization. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-official-doc-normalization.test.mjs`;
  `node --experimental-strip-types test/unit/knowledge-runtime-prefetch.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 11 updates README, roadmap, agent rules, bundled skill docs, and this
  handoff with the implemented official-doc HTML normalization boundary.
  Focused validation: `git diff --check`.
- Commit 12 records final verification results in this handoff. Full
  validation: `npm run verify` passed lint, test structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.
  Coverage summary: 89.29% lines, 78.03% branches, 96.52% functions.

Remaining risks and constraints:

- The normalizer is intentionally lightweight and deterministic. It is not a
  browser, sanitizer for untrusted display, or general-purpose HTML-to-Markdown
  engine.
- Normalized docs remain advisory cache content. Native validators, plan/preview
  output, and repo-local facts remain authoritative.
- This slice does not implement team storage, remote cache sharing, or automatic
  agent-loop fetches.

## 2026-05-09 Active Official-Doc Cache Freshness UX Plan

Status:

- Completed. This slice adds deliberate official-doc cache freshness reporting
  for `knowledge sources` and clearer previous-cache posture for
  `knowledge prefetch`.
- Scope is reporting and explicit prefetch UX only. No agent-loop live refresh,
  background network fetch, team cache backend, retrieval semantic rewrite, or
  raw cached-content exposure is in scope.

Why this direction:

- `docs/ROADMAP.md` leaves deliberate refresh UX for stale public docs as a
  remaining knowledge gap after local knowledge freshness work.
- `knowledge sources` already reports source and storage posture, but it does
  not tell the operator whether public official-doc cache entries are fresh,
  stale, or missing before a deliberate prefetch run.
- `knowledge prefetch` already distinguishes cached, fetched, stale-cache,
  skipped, and failed outcomes, but it does not expose compact prior cache
  posture for each source.
- The Claude Code architecture lesson stays bounded here: cache and tool
  outputs are summarized into compact state, permissioned refresh remains
  explicit, and raw documents never enter planner or handoff surfaces.

Subagent review inputs:

- `Averroes` recommended an additive cache freshness classifier, source report
  summary counts, previous-cache posture on prefetch results, and docs updates
  that preserve cache-first official-doc rules.
- `Wegener` recommended a new focused unit shard for source freshness reports,
  extending the existing prefetch unit shard, and extending the existing
  `cli-knowledge-sources-main` integration shard while avoiding near-limit
  knowledge pack/source retrieval tests.
- Architecture review is tracking the same boundary: reuse existing
  `KnowledgeStore` staleness semantics, avoid changing existing prefetch
  status strings, and keep network access limited to explicit prefetch.

Planned commits and checkpoints:

1. Record this active official-doc cache freshness UX plan in
   `docs/HANDOFF.md`.
2. Add a shared cache-status classifier around `KnowledgeStore.read` and
   `store.isStale`.
3. Add focused unit coverage for local, missing, fresh, and stale cache
   status classification.
4. Extend `knowledge sources` report entries with compact cache status.
5. Add source report summary counts for external fresh, stale, and missing
   cache entries.
6. Surface source cache posture in `knowledge sources` text output.
7. Add focused unit/integration coverage for `knowledge sources` JSON and text
   cache freshness reporting.
8. Extend `knowledge prefetch` source results with additive previous-cache
   posture.
9. Surface previous-cache posture in `knowledge prefetch` text/JSON output and
   add focused prefetch coverage.
10. Update README, agent rules, roadmap, bundled skill docs, and this handoff
    with completed behavior and remaining risks.
11. Run focused validation after each important stage and the full
    `npm run verify` gate before final handoff.

Acceptance criteria:

- `infra-agent knowledge sources --json` reports cache freshness for public
  URL-backed official-doc sources without fetching.
- Local workspace-private sources remain marked local and do not get stale
  public-doc refresh guidance.
- `knowledge sources` text output clearly identifies fresh, stale, and missing
  external cache entries and when deliberate `knowledge prefetch` is useful.
- `knowledge prefetch` remains the only deliberate refresh path and reports
  each source's previous cache posture without changing existing status values.
- JSON/text outputs do not expose raw cache content, cache hashes, request
  headers, credentials, or raw markdown.
- Tests use injected stores/fetchers or local fixture cache entries with fixed
  dates; no unit, integration, smoke, or e2e test requires network access.

Progress log:

- Commit 1 records this active official-doc cache freshness UX plan,
  subagent review inputs, acceptance criteria, and stage checkpoints in
  `docs/HANDOFF.md`. Focused validation: `git diff --check`.
- Commit 2 adds the shared `resolveKnowledgeSourceCacheStatus` classifier for
  local, missing, fresh, and stale cache posture. Focused validation:
  `git diff --check`.
- Commit 3 adds focused unit coverage for cache status classification. Focused
  validation:
  `node --experimental-strip-types test/unit/knowledge-source-cache-freshness-report.test.mjs`;
  `git diff --check`.
- Commit 4 extends `knowledge sources` report entries with additive
  `cacheStatus` and source-summary cache counts using the existing
  `KnowledgeStore` staleness semantics. Focused validation:
  `node --experimental-strip-types -e "import('./src/knowledge/sources.ts')"`;
  `git diff --check`.
- Commit 5 covers source report fresh, stale, missing, and local cache posture
  with an injected store and fixed clock. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-source-cache-freshness-report.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 6 surfaces cache freshness in `knowledge sources` text output without
  exposing cached content, hashes, or timestamps. Focused validation:
  `node --experimental-strip-types -e "import('./src/cli/output.ts')"`;
  `git diff --check`.
- Commit 7 adds CLI JSON/text coverage for source cache freshness and raw
  cache-content exclusion. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 8 adds additive `previousCacheStatus` to `knowledge prefetch` source
  results while preserving existing status values. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-runtime-prefetch.test.mjs`;
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`;
  `git diff --check`.
- Commit 9 covers cached, fetched, stale-cache fallback, and local prefetch
  previous-cache posture with injected stores/fetchers. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-runtime-prefetch.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 10 adds previous-cache summary counts and text output for prefetch
  results. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-runtime-prefetch.test.mjs`;
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`;
  `git diff --check`.
- Commit 11 covers CLI prefetch JSON/text previous-cache posture output.
  Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 12 updates README, roadmap, agent rules, skill docs, and this handoff
  with the implemented official-doc cache freshness UX. Focused validation:
  `git diff --check`.
- Commit 13 records final verification results in this handoff. Full
  validation: `npm run verify` passed lint, test structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.
  Coverage summary: 89.24% lines, 78.01% branches, 96.53% functions.

Remaining risks and constraints:

- This slice is additive. Existing prefetch `status` values and retrieval
  fallback semantics should not change.
- Cache freshness is advisory metadata based on current cache entries. It does
  not validate whether an upstream official doc changed since the last fetch.
- Freshness reports must stay compact and must not become a side channel for
  raw cached content, hashes, timestamps in compact handoff, or fetched payloads.

## 2026-05-09 Active Pulumi Component Internals Plan

Status:

- Completed. This slice extends the
  existing conservative Node.js/TypeScript
  Pulumi `ComponentResource` knowledge path from component interface facts to
  bounded child-resource facts.
- Scope is read-only static evidence. No validation-time Pulumi stack
  bootstrap, `pulumi stack init`, deployment, state mutation, import, refresh,
  or automatic resource repair is in scope.
- The output remains advisory compact knowledge. `pulumi preview`, project
  type checks, and repository tests remain authoritative for runtime behavior.

Why this direction:

- `docs/ROADMAP.md` already lists richer Pulumi component internals as a
  remaining knowledge gap after component input/output facts landed.
- Subagent review split three possible next slices:
  component internals, public-doc cache refresh UX, and tool-output/lifecycle
  guardrails. Component internals is the most direct product capability gap for
  Infra-Agent's local IaC understanding.
- The Claude Code architecture lesson stays bounded here: strengthen compact
  handoff facts and parser contracts, but do not introduce a coordinator
  engine, recursive runtime subagents, live refresh in the query loop, or raw
  source/tool-output handoff.

Subagent review inputs:

- `Lagrange` recommended a Pulumi component internals slice limited to
  read-only Node.js/TypeScript evidence. Acceptance: detect child Pulumi
  resource constructors inside conservative `ComponentResource` class bodies,
  keep facts compact, skip raw constructor args/secrets/generated/test files,
  and treat the result as advisory only.
- `Lorentz` recommended a deliberate official-doc refresh UX slice. That is
  valid follow-up work, but not this slice; no live agent-loop refresh is being
  added now.
- `Bacon` recommended borrowing Claude Code's deterministic output-budget and
  lifecycle discipline. This slice applies that as a constraint: only bounded
  knowledge summaries, source locators, fact counts, and compact contract
  updates are allowed into planner/handoff surfaces.

Planned commits and checkpoints:

1. Record this active Pulumi component internals plan in `docs/HANDOFF.md`.
2. Add parser coverage for child resource constructors inside component
   classes, including namespace imports, named class imports, and comment/string
   masking.
3. Implement conservative child resource extraction in
   `src/domain/pulumi-components.ts`.
4. Include child resource summaries in component knowledge content without raw
   source, constructor args, or import text.
5. Add `pulumi-component-child-resource` to the knowledge fact schema and
   parser contract.
6. Extract child resource facts from component summaries with safe paths,
   values, source locators, and related workspace paths.
7. Rank child resource facts as local component evidence below required inputs
   and above public Pulumi docs guidance.
8. Cover bounded packs and planner prompt compaction for child resource facts.
9. Cover CLI knowledge extract/pack behavior in a focused new shard instead of
   growing near-limit integration tests.
10. Update rules, roadmap, README/skill docs, and this handoff with the new
    boundary and remaining risks.
11. Run focused validation after each important phase and the full
    `npm run verify` gate before final handoff.

Acceptance criteria:

- Child-resource facts are emitted only for resource constructors inside a
  detected Pulumi `ComponentResource` class body.
- Supported evidence is conservative Node.js/TypeScript `@pulumi/*`
  import/require constructor syntax already compatible with Pulumi resource
  token detection patterns.
- Facts include resource name, Pulumi type token, component class, source
  locator, source id, extraction method, confidence, and safe related paths.
- Facts exclude raw source content, constructor argument objects, import text,
  external URLs, cache hashes/timestamps in compact handoff, generated/test
  files, declaration files, and secret-like names or tokens.
- Stale/unchecked source confidence downgrade behavior remains unchanged.
- Existing Pulumi validation/config safety boundaries remain intact.

Progress log:

- Commit 1 records this active component-internals plan, subagent inputs,
  acceptance criteria, and stage checkpoints in `docs/HANDOFF.md`. Focused
  validation: `git diff --check`.
- Commit 2 adds conservative child-resource summary extraction by reusing
  existing Pulumi Node.js/TypeScript resource-token parsing and filtering
  evidence to detected `ComponentResource` class-body line ranges. Focused
  validation:
  `node --experimental-strip-types --test test/unit/pulumi-component-inspection.test.mjs`;
  `git diff --check`.
- Commit 3 extends component summary content-safety coverage so child resource
  summaries appear in JSON while raw source, imports, `super(...)`, and
  constructor argument objects stay out. Focused validation:
  `node --experimental-strip-types test/unit/pulumi-component-inspection.test.mjs`;
  `git diff --check`.
- Commit 4 adds `pulumi-component-child-resource` to the knowledge fact schema,
  compact agent-result contract, ranking table, and schema-constant coverage.
  Focused validation:
  `node --experimental-strip-types test/unit/knowledge-cache-contracts.test.mjs`;
  `git diff --check`.
- Commit 5 extracts child-resource facts from component summaries with safe
  fact paths, resource type tokens, source locators, and related source paths.
  Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-component-facts.test.mjs`;
  `git diff --check`.
- Commit 6 verifies bounded knowledge packs include component input and child
  resource facts without raw source. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-component-facts.test.mjs`;
  `git diff --check`.
- Commit 7 verifies local component child-resource facts rank above public
  Pulumi docs guidance while required component inputs remain first. Focused
  validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-component-facts.test.mjs`;
  `git diff --check`.
- Commit 8 covers planner prompt compaction for child-resource facts and raw
  source exclusion. Focused validation:
  `node --experimental-strip-types test/unit/planner-knowledge-facts-prompt.test.mjs`;
  `git diff --check`.
- Commit 9 covers compact `agent --json` result contract acceptance for the new
  fact kind while still rejecting raw source/cache fields. Focused validation:
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`;
  `git diff --check`.
- Commit 10 adds a focused CLI integration shard for `knowledge extract` and
  `knowledge pack` child-resource facts instead of growing near-limit main
  shards. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pulumi-component-child-main.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 11 aligns the CLI shard with subagent review: clearer filename, shared
  JSON CLI helper, `--max-facts 3`, and a stronger raw-source guard. Focused
  validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pulumi-component-child-resources-main.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 12 updates README, agent rules, roadmap, and bundled skill docs with
  the new component child-resource fact boundary. Focused validation:
  `git diff --check`.
- Commit 13 records final verification results in this handoff. Full
  validation: `npm run verify` passed lint, test structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.
  Coverage summary: 89.08% lines, 77.95% branches, 96.30% functions.

Remaining risks and constraints:

- Static evidence is intentionally conservative and can miss dynamic factories,
  alias/dataflow-driven constructors, non-Node languages, generated code, and
  deeper component internals.
- Child-resource facts are advisory local knowledge only. They do not prove
  runtime deployment state, replacement safety, provider defaults, or preview
  impact.
- Public Pulumi resource docs selection may see root-level resource constructor
  evidence separately; component child-resource facts do not automatically turn
  public docs into validator-grade authority.

## 2026-05-09 Active Pulumi Safety Remediation Plan

Status:

- Completed. This slice paused feature expansion and repaired the Pulumi
  validation/config safety boundary found during the project review.
- The core goal is to keep agent-loop validation read-only, require explicit
  approval for bounded native Pulumi stack config writes, and align docs,
  result surfaces, tests, and handoff notes with that boundary.

Why this direction:

- The current Pulumi validation plan embeds local backend bootstrap work
  (`mkdir` plus `pulumi stack init`) inside `validate_targets`, which makes a
  non-mutating validation tool perform local state setup.
- `pulumi_config_set` is already modeled as `native-stack-config-write` and
  `mutatesExternalState=true`; the default workspace approval posture should
  require an explicit tool-category approval before the session harness runs
  that native mutation.
- This matches the adopted Claude Code architecture patterns: a single
  session-owned harness, permission gates immediately before mutation,
  parser-validated compact state, bounded native tools, and no recursive
  subagent runtime.

Subagent review inputs:

- `Ampere` reviewed the Pulumi validation/config safety surface and proposed
  removing validation-time local-state bootstrap, blocking Pulumi stack
  bootstrap commands in validation, and requiring approval for native stack
  config writes.
- `Noether` mapped focused test coverage and noted that knowledge pack text
  output still lacks direct text-mode coverage for unchecked source counts.
- `Sagan` checked `learning-claude-code` alignment and recommended keeping all
  remediation inside `runQueryLoop`/owned helpers, preserving compact-state
  contracts, and avoiding any generic Pulumi remediation DSL.

Planned commits and checkpoints:

1. Record this active Pulumi safety remediation plan in `docs/HANDOFF.md`.
2. Tighten validation command safety so Pulumi stack bootstrap/setup commands
   are rejected while plain `pulumi preview` remains allowed.
3. Remove local Pulumi backend bootstrap from default validation preflight
   commands.
4. Add validation-plan tests proving generated Pulumi validation commands are
   preview-only and pass the unsafe-command classifier.
5. Require `native-stack-config-write` approval by default in workspace policy.
6. Add approval policy tests for the default native stack config gate.
7. Cover runtime approval behavior before Pulumi config-set execution.
8. Surface unchecked source counts in `knowledge pack` text output.
9. Add dedicated knowledge pack text-mode coverage without growing oversized
   integration shards.
10. Update rules, architecture notes, README, roadmap, and bundled skill docs
    for the repaired Pulumi safety boundary.
11. Refresh this handoff with completed checkpoints, remaining risks, and
    focused verification results.
12. Run the full verification gate and record final results before handoff.

Progress log:

- Commit 1 records this active remediation plan, subagent inputs, architecture
  boundary, and acceptance checkpoints in `docs/HANDOFF.md`. Focused
  validation: `git diff --check`.
- Commit 2 tightens `classifyUnsafeValidationCommand` so shell setup,
  `pulumi stack init/select`, `pulumi login`, and `pulumi config set/rm` are
  unsafe validation commands, while plain `pulumi preview` remains allowed.
  Focused validation:
  `node --experimental-strip-types --test test/unit/tool-execution-validation.test.mjs`;
  `git diff --check`.
- Commit 3 removes validation-time `mkdir` and `pulumi stack init` bootstrap
  from default Pulumi preflight commands. Focused validation:
  `node --experimental-strip-types --test test/unit/workspace-profile-targeting.test.mjs`;
  `node --experimental-strip-types --test test/unit/tool-execution-validation.test.mjs`;
  `git diff --check`.
- Commit 4 adds preflight regression coverage proving generated Pulumi
  validation commands are preview-only and pass the unsafe-command classifier.
  Focused validation:
  `node --experimental-strip-types --test test/unit/workspace-profile-targeting.test.mjs`;
  `node --experimental-strip-types --test test/unit/tool-execution-validation.test.mjs`;
  `git diff --check`.
- Commit 5 makes `native-stack-config-write` approval required by default in
  workspace policy. Focused validation:
  `node --experimental-strip-types --test test/unit/workspace-approval-policy.test.mjs`;
  `git diff --check`.
- Commit 6 covers the default native stack config approval policy and the
  default approval signal for Pulumi config operations. Focused validation:
  `node --experimental-strip-types --test test/unit/workspace-approval-policy.test.mjs`;
  `git diff --check`.
- Commit 7 adds runtime coverage proving `runSingleStep` stops at the
  `native-stack-config-write` approval gate before any Pulumi config-set tool
  execution. Focused validation:
  `node --experimental-strip-types --test test/integration/agent-runtime-execution.test.mjs`;
  `git diff --check`.
- Commit 8 removes implicit `mkdir` and `pulumi stack init` from
  `PulumiConfigSetTool`; the direct tool test now prepares explicit temporary
  stack context before invoking the bounded native CLI write. Focused
  validation:
  `node --experimental-strip-types test/unit/tool-execution-validation.test.mjs`;
  `node --experimental-strip-types --test test/integration/agent-runtime-execution.test.mjs`;
  `git diff --check`.
- Commit 9 adds `uncheckedSources` to `knowledge pack` text summaries. Focused
  validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`;
  `git diff --check`.
- Commit 10 adds a dedicated text-mode knowledge pack integration shard without
  growing the larger JSON pack shard. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-text-main.test.mjs`;
  `npm run test:structure`; `git diff --check`.
- Commit 11 updates `AGENTS.md`, README, agent rules, roadmap, Claude Code
  architecture notes, and the bundled infra skill to clarify preview-only
  Pulumi validation and default native stack config approval. Focused
  validation: `git diff --check`.
- Commit 12 aligns smoke coverage with the new boundary: the smoke script now
  verifies unapproved Pulumi stack config writes stop at the approval gate, then
  prepares explicit temporary stack context before exercising an approved
  bounded `pulumi_config_set` write. Focused validation: `npm run smoke`;
  `git diff --check`.
- Commit 13 records final verification results in this handoff. Full
  validation: `npm run verify` passed lint, test structure, unit, integration,
  contract, isolated shards, smoke, e2e, coverage, and package dry-run.
  Coverage summary: 89.04% lines, 77.86% branches, 96.28% functions.

Design decisions:

- Validation command generation no longer performs Pulumi local-state setup.
  If preview requires missing backend/stack context, that is a blocker or
  operator handoff instead of an agent-loop bootstrap step.
- Validation command safety now rejects shell setup and Pulumi stack/config
  mutations before `validate_targets` executes any command.
- `pulumi_config_set` remains a bounded native stack config tool, but it no
  longer initializes stacks internally. It requires explicit approval at the
  session harness boundary and explicit stack context at execution time.
- Knowledge pack text output now matches compact/JSON freshness posture by
  reporting unchecked source counts without exposing raw source content.
- The first full verification attempt exposed the old smoke assumption that
  approved Pulumi config writes implicitly initialized local stack context. The
  fix kept the product boundary intact by updating smoke setup, not by
  restoring hidden stack initialization in production code.

Remaining risks and constraints:

- This slice does not add deploy/apply/state repair, Pulumi imports, refresh,
  state editing, secrets handling, component introspection, or a generic
  Pulumi config DSL.
- If `pulumi preview` cannot run without pre-existing backend/stack context,
  the agent should report that as a validation blocker or operator handoff
  rather than bootstrapping state during validation.
- Direct low-level tool execution tests may still exercise
  `pulumi_config_set`; the session runtime must gate that native mutation
  before execution by default.
- Historical follow-up lists below may mention earlier work. The active plan
  above and `docs/ROADMAP.md` are the source of truth for current direction.

## 2026-05-08 Active Knowledge Freshness Reporting Plan

Status:

- Completed. This session continued `infra-agent` development under the
  existing architecture and safety rules, with 14 meaningful commits completed
  for this slice.
- The selected product slice is local knowledge freshness and staleness
  reporting polish: make repo-local fact drift and unchecked local source
  posture visible in validation reports, CLI output, compact `knowledgeFacts`,
  result cards, and durable docs without exposing raw source content.

Why this direction:

- `docs/ROADMAP.md` lists local fact refresh/staleness reporting as the next
  remaining knowledge-system gap after Pulumi component facts.
- The completed Pulumi component slice added recheckable local fingerprints;
  this slice makes that freshness state easier for downstream agents and human
  operators to route on before they reuse saved facts or packs.
- This follows the Claude Code patterns already adopted here: session-owned
  harness state, compact parser-validated handoff, budgeted context, explicit
  permission/freshness posture, and no recursive subagent runtime.

Subagent plan:

- `Epicurus` is the read-only project-plan explorer for durable Plan, Rules,
  roadmap, handoff, and documentation fit.
- `Singer` is the read-only codebase explorer for knowledge validation,
  fingerprint, CLI, compact-output, and test surfaces.
- `Laplace` is the read-only architecture explorer for
  `learning-claude-code` pattern alignment and anti-pattern boundaries.
- The main agent owns edits, focused validation, durable handoff updates,
  staging, and commits.

Planned commits and checkpoints:

1. Record this active execution plan in `docs/HANDOFF.md`.
2. Extend local source fingerprint checks with safe stale/missing path detail.
3. Add a structured knowledge validation freshness summary contract.
4. Cover fact-set validation freshness details for repo-local drift.
5. Cover pack validation freshness details for local pack sources.
6. Surface freshness details in `knowledge validate` CLI text and JSON paths.
7. Add compact `knowledgeFacts` unchecked-source posture.
8. Ensure stale compact facts are not handed off as high-confidence context.
9. Mirror unchecked/stale source posture in result cards and compact contracts.
10. Cover runtime/CLI handoff behavior for freshness counts.
11. Split freshness budget tests to keep unit shards within project limits.
12. Update roadmap, rules, README, and bundled skill guidance.
13. Align the smoke compact fixture with the new unchecked-source contract.
14. Run full verification and record final validation in this handoff.

Remaining risks and constraints:

- This slice reports freshness only. It does not implement team storage
  backends, automatic external refresh, live network calls in the agent loop,
  Pulumi non-Node parsing, component dataflow, or state/deploy operations.
- Stale or unchecked repo-local facts remain advisory and must not be treated
  as validator-grade authority. Native validation, `pulumi preview`, Terraform
  validation, Helm rendering, and provider/schema checks remain authoritative.
- Freshness reports may include safe workspace-relative paths, source ids,
  source kinds, source names, stale reasons, and aggregate fact counts. They
  must not expose raw source content, raw cache payloads, secrets, backend URLs,
  or per-file content hashes in ordinary compact handoff.

Progress log:

- Commit 1 records this active knowledge freshness reporting plan, subagent
  responsibilities, planned checkpoints, architecture boundary, and risk
  constraints. Focused validation: `git diff --check`.
- Commit 2 extends local source fingerprint checks with safe per-file stale and
  missing path details. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-cache-contracts.test.mjs`;
  `git diff --check`.
- Commit 3 adds the structured
  `infra-agent.knowledge-freshness-summary` validation report surface. Focused
  validation:
  `node --experimental-strip-types --test test/unit/knowledge-extraction-content.test.mjs`;
  `git diff --check`.
- Commit 4 reports stale repo-local fact-set sources with safe source metadata,
  stale reasons, fact counts, and workspace-relative stale/missing paths.
  Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-extraction-content.test.mjs`;
  `node --experimental-strip-types --test test/unit/knowledge-cache-contracts.test.mjs`;
  `git diff --check`.
- Commit 5 reports stale local pack sources through validation freshness
  details. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-artifact-integrity.test.mjs`;
  `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`;
  `git diff --check`.
- Commit 6 surfaces freshness summaries in `knowledge validate` text output and
  JSON paths without leaking raw source content or hashes. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`;
  `node --experimental-strip-types --test test/unit/knowledge-artifact-integrity.test.mjs`;
  `git diff --check`.
- Commit 7 adds compact `knowledgeFacts.uncheckedSourceCount` and parser
  arithmetic checks. Focused validation:
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`;
  `node --experimental-strip-types --test test/unit/agent-output-result-card.test.mjs`;
  `git diff --check`.
- Commit 8 downgrades compact facts from stale or unchecked sources and rejects
  high-confidence compact handoff facts from those sources. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`;
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`;
  `git diff --check`.
- Commit 9 mirrors unchecked knowledge source posture in result cards. Focused
  validation:
  `node --experimental-strip-types --test test/unit/agent-output-result-card.test.mjs`;
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`;
  `git diff --check`.
- Commit 10 covers runtime and compact handoff behavior for unchecked source
  counts. Focused validation:
  `node --experimental-strip-types test/integration/agent-runtime-execution.test.mjs`;
  `node --experimental-strip-types test/integration/agent-runtime-handoff.test.mjs`;
  `git diff --check`.
- Commit 11 splits unchecked-source fact budget coverage into a dedicated unit
  test shard so the existing ranking shard stays under the project structure
  limit. Focused validation: `npm run test:structure`;
  `node --experimental-strip-types --test test/unit/knowledge-fact-budget-freshness.test.mjs`;
  `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`;
  `git diff --check`.
- Commit 12 updates roadmap, rules, README, bundled skill guidance, and this
  handoff so downstream agents can see the implemented freshness contract,
  compact unchecked-source posture, remaining gaps, and validation workflow.
  Focused validation: `npm run test:structure`; `git diff --check`.
- Commit 13 aligns the smoke compact fixture with the required
  `knowledgeFacts.uncheckedSourceCount` field after the first full
  `npm run verify` attempt failed in smoke on that missing compact contract
  field. Focused validation: `npm run smoke`;
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`;
  `git diff --check`.
- Commit 14 records final validation. Full `npm run verify` passed after the
  smoke fixture fix, including lint over 202 files, test structure over 68 test
  files, unit/integration/contract/isolated shards, smoke, e2e, coverage
  thresholds, and `npm pack --dry-run --json` package checking. Coverage summary
  from the full run: 88.97% lines, 77.82% branches, and 96.23% functions.

## 2026-05-08 Active Pulumi Component Facts Plan

Status:

- Completed. This session continued `infra-agent` development under the
  existing architecture and safety rules, with 12 meaningful commits completed
  for this slice.
- The selected product slice is conservative Pulumi component fact extraction:
  detect workspace-contained Node.js/TypeScript `pulumi.ComponentResource`
  class evidence, summarize component inputs and outputs without raw source
  content, and flow those facts through knowledge sources, extraction, packs,
  planner prompts, compact `knowledgeFacts`, validation, and durable docs.

Why this direction:

- `docs/ROADMAP.md` lists Pulumi component facts and durable component packs as
  a remaining knowledge-system gap.
- The existing Pulumi knowledge path already supports config facts, public docs
  facts, YAML resource tokens, and conservative Node.js/TypeScript resource
  constructor evidence. Component facts are the next local, cache-first
  extension without adding deploy, state mutation, live provider calls, or
  general-purpose agent behavior.
- This follows the Claude Code patterns already adopted here: a single
  session-owned harness, bounded structured state, compact fact handoff,
  parser-validated contracts, read-only explorer subagents, and no raw source
  or full docs in ordinary planner context.

Subagent plan:

- `Halley` is the read-only project-plan explorer for durable Plan, Rules,
  architecture, roadmap, handoff, and testing constraints.
- `Zeno` is the read-only architecture explorer for `learning-claude-code`
  pattern alignment and subagent/harness boundary guidance.
- `Tesla` is the read-only codebase explorer for current architecture, safe
  implementation surfaces, validation commands, and candidate tests.
- The main agent owns edits, focused validation, durable handoff updates,
  staging, and commits.

Planned commits and checkpoints:

1. Record this active execution plan in `docs/HANDOFF.md`.
2. Add Pulumi component source and fact contract support with parser coverage.
3. Add conservative Node.js/TypeScript Pulumi component parsing helpers and
   direct unit coverage.
4. Wire component source discovery and summary content generation into Pulumi
   knowledge extraction.
5. Cover `knowledge sources` CLI output for local Pulumi component sources.
6. Extract compact component input/output facts without raw source content.
7. Validate component fact sets and stale local component fingerprints.
8. Include component facts in bounded packs and ranking.
9. Cover CLI `knowledge extract` and `knowledge pack` for component facts.
10. Cover planner prompt and compact `knowledgeFacts` contracts for component
    facts.
11. Update roadmap, rules, README, and bundled skill guidance.
12. Run full verification and record final validation in this handoff.

Current risks and constraints:

- This slice supports only conservative Node.js/TypeScript Pulumi components
  with explicit `pulumi.ComponentResource` or imported `ComponentResource`
  class evidence inside the Pulumi project root.
- It does not parse Python, Go, .NET, Java, generated/test files, dynamic class
  factories, runtime dataflow, component internals beyond constructor argument
  and public/readonly output declarations, or package-only component inference.
- Component facts are high-confidence repo-local interface facts only when they
  come from current workspace source fingerprints. They remain advisory planner
  context and do not replace `pulumi preview`, project type checks, or stack
  validation.
- No deploy, `pulumi up`, stack import, state mutation, alias/state repair,
  external network fetch, or recursive subagent runtime behavior is allowed.

Progress log:

- Commit 1 recorded this active Pulumi component facts plan, subagent
  responsibilities, planned checkpoints, architecture boundary, and risk
  constraints. Focused validation: `git diff --check`.
- Commit 2 added the Pulumi component source kind and component input/output
  fact kinds to the shared knowledge contracts, compact handoff contract, and
  ranking tables. Direct parser coverage proves component facts remain
  source-linked, workspace-private, and schema-validated. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-cache-contracts.test.mjs`.
- Commit 3 added a conservative Pulumi Node.js/TypeScript component parser for
  explicit `ComponentResource` class evidence. It extracts constructor args
  interface/type fields and public output property declarations, skips
  secret-looking fields and commented classes, and records source locators
  without raw source content. Focused validation:
  `node --experimental-strip-types --test test/unit/pulumi-component-inspection.test.mjs`.
- Commit 4 wired Pulumi component source discovery and summary-content
  generation into the cache-first knowledge source path. Component source
  discovery stays bounded to workspace-contained project files, skips
  generated/test/declaration paths, stores summary JSON instead of raw source,
  and uses local file fingerprints for rechecks. Focused validation:
  `node --experimental-strip-types --test test/unit/pulumi-component-inspection.test.mjs`.
- Commit 5 added real CLI coverage for `infra-agent knowledge sources` listing
  local Pulumi component sources. The command now proves component sources are
  workspace-private, fetch-free, target-scoped, and do not expose raw
  TypeScript source content. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`.
- Commit 6 added extraction of compact `pulumi-component-input` and
  `pulumi-component-output` facts from cached component summary JSON. The
  extractor preserves source locators and related paths, skips secret-looking
  fields, and emits no raw source code. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-component-facts.test.mjs`.
- Commit 7 covered workspace extraction and local fingerprint validation for
  Pulumi component facts. Saved component facts now carry a recheckable source
  fingerprint and `knowledge validate --workspace` detects source drift as a
  stale local source. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-component-facts.test.mjs`.
- Commit 8 covered bounded knowledge packs and ranking for Pulumi component
  facts. Local component interface facts enter packs with workspace-private
  fingerprint metadata and rank ahead of lower-authority public Pulumi docs
  guidance under tight budgets. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-component-facts.test.mjs`.
- Commit 9 added real CLI `knowledge extract` and `knowledge pack` coverage for
  Pulumi component facts. The command paths prove component facts flow through
  extraction and bounded packs with fingerprint metadata while excluding raw
  TypeScript source content. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`
  and `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`.
- Commit 10 covered planner prompt and compact `agent --json` contract handling
  for Pulumi component facts. The tests prove downstream agents see only
  budgeted `knowledgeFacts` summaries with source locators and fingerprint
  metadata, not raw source, cache content, or content hashes. Focused
  validation:
  `node --experimental-strip-types --test test/unit/planner-knowledge-facts-prompt.test.mjs`
  and `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`.
- Commit 11 updated durable roadmap, rules, README, and bundled skill guidance
  for Pulumi component facts. The documented boundary now matches the
  implementation: conservative Node.js/TypeScript `ComponentResource` class
  evidence is supported for component interface facts; generated/test files,
  secret-like fields, non-Node languages, dynamic factories, and deeper
  component internals remain out of scope. Focused validation:
  `git diff --check` and `npm run test:structure`.
- Commit 12 recorded final verification for the Pulumi component facts slice.
  Full validation: `npm run verify` passed. This covered lint (201 files),
  structure (67 files), unit (357 tests), integration (78 tests), contract (21
  tests), isolated shard execution (55 files), smoke, e2e, coverage (456 tests,
  89.04% lines, 78.01% branches, 96.24% functions), and package dry-run (136
  entries).

Remaining work:

- Non-Node Pulumi component languages, dynamic component factory support, richer
  component-internal dataflow, and local staleness reporting polish remain
  future roadmap items.
- Component facts remain advisory planner context. `pulumi preview`, project
  type checks, and stack validation remain authoritative before any real infra
  change.

## 2026-05-07 Active Pulumi Language Resource Discovery Plan

Status:

- Completed. This session continued `infra-agent` development under the
  existing architecture and safety rules, with 12 meaningful commits completed
  for this slice.
- The selected product slice is conservative Pulumi Node.js/TypeScript resource
  discovery beyond YAML: parse workspace-contained Pulumi project source files
  for explicit `new <pulumi-provider>.<module>.<Type>(...)` constructor
  evidence, emit deterministic resource tokens, and reuse the existing
  cache-first Pulumi Registry resource docs path.

Why this direction:

- The roadmap listed Pulumi language-import/resource discovery beyond YAML as
  pending, and the completed slice implements the first conservative
  Node.js/TypeScript portion of that gap.
- Existing Pulumi Registry package docs and resource docs source selection is
  already cache-first, bounded, public-reference, and contract-tested.
- This follows the Claude Code architecture patterns already adopted here:
  compact evidence, parser-enforced contracts, read-only subagent analysis,
  budgeted `knowledgeFacts`, and no raw source or docs in ordinary planner
  context.

Subagent plan:

- `Peirce` is the read-only codebase explorer for Pulumi source selection,
  resource token extraction, CLI knowledge flows, compact contracts, and tests.
- `Meitner` is the read-only architecture explorer for slice-fit risks and
  `learning-claude-code` pattern alignment.
- The main agent owns edits, staged validation, durable handoff updates, and
  commits.

Planned commits and checkpoints:

1. Record this active execution plan in `docs/HANDOFF.md`.
2. Add conservative Node.js/TypeScript Pulumi import/require resource parsing
   helpers and direct unit coverage.
3. Add named import and package subpath parser coverage for Pulumi resource
   constructors.
4. Wire language source-file scanning into Pulumi project inspection.
5. Prove language resource tokens improve Pulumi targeting details.
6. Derive Pulumi Registry resource docs sources from language evidence.
7. Cover `knowledge sources` CLI output for language-derived resource docs.
8. Cover `knowledge prefetch` bounded public docs behavior for language-derived
   resource docs.
9. Cover `knowledge extract` from cached language-derived resource docs.
10. Cover `knowledge pack` from cached language-derived resource docs.
11. Update rules, README, roadmap, and bundled skill guidance.
12. Run full verification and record the validation outcome in this handoff.

Current risks and constraints:

- This slice supports only explicit Node.js/TypeScript Pulumi provider imports
  and constructor calls inside the project root. It does not parse Python, Go,
  .NET, Java, generated code, dynamic provider aliases, or component internals.
- Resource docs selected from language evidence remain public-reference
  advisory context. They do not prove runtime usage beyond the parser evidence
  and do not replace `pulumi preview`.
- The parser must skip comments, string literals, test fixtures outside the
  Pulumi project root, ignored directories, declaration files, secret-looking
  aliases/tokens, and source files that exceed the bounded read budget.
- No deploy, `pulumi up`, stack import, state mutation, or provider network
  behavior is allowed.

Progress log:

- Commit 1 recorded this active Pulumi language resource discovery plan,
  subagent responsibilities, 12 planned checkpoints, constraints, and risk
  boundaries. Focused validation: `git diff --check`.
- Commit 2 added a conservative Pulumi Node.js/TypeScript resource constructor
  parser for namespace imports and CommonJS requires. The parser records
  workspace-relative evidence locators, skips strings/comments and provider
  constructors, and emits deterministic Pulumi resource tokens without raw
  source content. Focused validation:
  `node --experimental-strip-types --test test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 3 expanded the language parser to cover named imports, package
  subpath imports, and destructured CommonJS requires. Module aliases such as
  `import { s3 as awsS3 } from "@pulumi/aws"` and direct constructors from
  `@pulumi/aws/s3` or `@pulumi/kubernetes/apps/v1` now map to the same
  deterministic Pulumi resource tokens. Focused validation:
  `node --experimental-strip-types test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 4 wired bounded Node.js/TypeScript source scanning into Pulumi project
  inspection. The scanner reads only workspace-contained project source files,
  skips common generated/test/declaration paths, limits source count and file
  size, and merges YAML and language resource token evidence deterministically.
  Focused validation:
  `node --experimental-strip-types test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 5 covered targeting behavior for language-derived Pulumi resource
  tokens. Explicit Node.js/TypeScript resource constructor evidence now feeds
  the same Pulumi project candidate hint and detail path as YAML resource
  tokens. Focused validation:
  `node --experimental-strip-types test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 6 covered Pulumi Registry resource docs source selection from
  language-derived resource tokens. Explicit Node.js/TypeScript constructor
  evidence now reuses existing public-reference `pulumi-docs:resource:*`
  sources and safe `@pulumi/*` package versions from project manifests.
  Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-sources.test.mjs`.
- Commit 7 added CLI `knowledge sources` coverage for language-derived Pulumi
  resource docs. The real command path now proves Node.js/TypeScript resource
  constructor evidence selects public Pulumi Registry resource docs without
  exposing raw source content. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`.
- Commit 8 covered bounded prefetch for language-derived Pulumi resource docs
  with an injected fetcher and in-memory knowledge store. The test proves the
  public `pulumi-docs:resource:*` source can be deliberately cached without
  live network dependency or raw source leakage. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-sources.test.mjs`.
- Commit 9 added CLI `knowledge extract` coverage for language-derived Pulumi
  resource docs. Explicit Node.js/TypeScript constructor evidence now selects a
  cached public resource-doc source through the real command path and emits
  compact `argument` facts without raw source code, raw markdown, or
  secret-looking doc fields. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`.
- Commit 10 added CLI `knowledge pack` coverage for language-derived Pulumi
  resource docs. Bounded packs now prove cached public resource docs selected
  from Node.js/TypeScript constructor evidence preserve `public-reference`
  source posture and include only compact facts. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`.
- Commit 11 updated durable rules, roadmap, README, and bundled skill guidance
  for Pulumi language resource discovery. The documented boundary now matches
  the subagent review and implementation: YAML tokens plus conservative
  Node.js/TypeScript `@pulumi/*` import/require constructor evidence are
  supported; package-only inference, components, dynamic alias/dataflow,
  generated/test files, and non-Node languages remain out of scope. Focused
  validation: `git diff --check` and `npm run test:structure`.
- Commit 12 recorded final verification for the Pulumi language resource
  discovery slice. Full validation passed with `npm run verify`, including
  lint over 198 files, test structure over 65 files, unit/integration/contract
  suites, isolated shard execution over 53 files, smoke, e2e, coverage
  thresholds, and `npm pack --dry-run --json` with `entryCount=135`.

Final validation:

- `npm run verify` passed.
- Coverage gate passed at 89.07% lines, 78.39% branches, and 96.38% functions
  over `src/**/*.ts`.
- Smoke passed with `/tmp/infra-agent-smoke-i9Nz9a`.
- E2E passed with `/tmp/infra-agent-e2e-ngazhQ`.
- Package dry-run passed for `infra-agent@0.1.0` with 135 packaged entries.

Remaining follow-ups:

- Pulumi component facts and durable component packs.
- Non-Node Pulumi language discovery for Python, Go, .NET, and Java.
- Optional markdown normalization for live official-doc fetches.
- Local fact refresh/staleness reporting for workspace file changes.
- Opt-in team storage backends.

## 2026-05-07 Active Helm Chart Docs Fact Plan

Status:

- Completed. This session continued `infra-agent` development under the
  existing architecture and safety rules, with 13 meaningful commits completed
  for this slice.
- The selected product slice is external Helm chart-doc markdown fact
  extraction: parse already-cached public `chart-docs` markdown, emit compact
  chart-value facts, and prove those facts flow through workspace extraction,
  bounded packs, CLI output, planner prompts, and compact `knowledgeFacts`.

Why this direction:

- The roadmap previously listed external chart-doc extraction beyond local
  `Chart.yaml`/`Chart.lock` metadata as pending.
- Existing Helm chart source selection already emits `chart-docs` sources from
  safe `Chart.yaml` `home`, `sources`, and dependency repository URLs.
- This follows the Claude Code architecture patterns already adopted here:
  cache-first retrieval, budgeted facts, compact handoff, parser-enforced
  contracts, and no raw docs in ordinary planner context.

Subagent plan:

- `Meitner` is the read-only architecture explorer for
  `learning-claude-code` patterns and slice-fit risks.
- `Peirce` is the read-only codebase explorer for current knowledge extraction,
  Helm chart-doc source selection, CLI, pack, contract, and prompt surfaces.
- The main agent owns edits, staged validation, durable handoff updates, and
  commits.

Planned commits and checkpoints:

1. Record this active execution plan in `docs/HANDOFF.md`.
2. Add the chart-doc markdown extraction method to shared contracts.
3. Add cached chart-doc markdown extraction helpers and direct unit coverage.
4. Cover workspace extraction from cached chart-doc sources.
5. Cover chart-doc facts entering bounded public-reference packs.
6. Add CLI `knowledge extract` coverage for cached chart-doc facts.
7. Add CLI `knowledge pack` coverage for cached chart-doc facts.
8. Cover ranking posture so local Helm schema/metadata facts outrank public
   chart-doc guidance under tight budgets.
9. Strengthen compact `knowledgeFacts` contract coverage for chart-doc facts.
10. Cover planner prompt budgeting for chart-doc facts without raw docs.
11. Enforce chart-doc advisory confidence at fact-set, pack validation, and
   compact handoff boundaries.
12. Update durable roadmap, rules, README, and bundled skill guidance.
13. Run full verification and record the validation outcome in this handoff.

Current risks and constraints:

- This slice only consumes cached markdown for existing `chart-docs` URL
  sources. It does not add live fetches to the agent loop and does not parse
  non-document repository schemes.
- Chart docs facts are medium-confidence public-reference guidance. They do
  not replace `values.schema.json`, `helm lint`, `helm template`, or chart
  schema validation.
- The extractor must skip HTML-shaped cache entries and secret-looking values,
  descriptions, paths, defaults, and summaries.
- No Helm upgrade/install, Kubernetes mutation, deploy, or state mutation
  behavior is allowed.

Progress log:

- Commit 1 recorded this active Helm chart-doc facts plan, subagent
  responsibilities, the 12 planned checkpoints, and slice risks. It also
  marked the previous Pulumi package docs plan as completed. Focused
  validation: `git diff --check`.
- Commit 2 added `helm-chart-docs-markdown` as a supported extraction method
  in shared knowledge types and compact agent-result contract constants.
  Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-cache-contracts.test.mjs`.
- Commit 3 added cached Helm chart-doc markdown extraction under a dedicated
  extractor boundary and wired it into the fact dispatcher. Chart docs tables,
  bullets, and headings now emit bounded medium-confidence `chart-value` facts
  while skipping HTML-shaped and secret-looking content. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-helm-chart-docs-extraction.test.mjs`
  and
  `node --experimental-strip-types --test test/unit/knowledge-extraction-content.test.mjs`.
- Commit 4 covered the workspace cache-to-extraction path for chart docs.
  `extractWorkspaceKnowledgeFacts` now has a regression proving selected
  `chart-docs` cache entries become extracted chart-value facts for a Helm
  target. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-helm-chart-docs-extraction.test.mjs`.
- Commit 5 covered the chart-docs-to-pack path. Bounded `KnowledgePack`
  output now has a regression proving chart docs facts retain public-reference
  source posture and omit raw cached markdown. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-helm-chart-docs-extraction.test.mjs`.
- Commit 6 added CLI extraction coverage for cached Helm chart docs.
  `knowledge extract --domain helm --target ... --source ... --json` now has
  an integration regression proving chart docs facts are extracted through the
  real command path without raw cached markdown. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`.
- Commit 7 added CLI pack coverage for cached Helm chart docs.
  `knowledge pack --domain helm --target ... --source ... --json` now proves
  chart docs facts enter bounded public-reference packs through the real
  command path without raw cached markdown. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`.
- Commit 8 added ranking posture coverage for chart docs guidance. Local
  high-confidence Helm schema facts continue to outrank medium-confidence
  public chart docs facts under deterministic fact ranking. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-helm-chart-docs-ranking.test.mjs`.
- Commit 9 added compact agent-result contract coverage for Helm chart-doc
  facts. The handoff contract accepts `helm-chart-docs-markdown` chart values
  with compact source summaries and rejects raw external source URLs. Focused
  validation:
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`.
- Commit 10 added planner prompt budget coverage for Helm chart-doc facts.
  The planner now has a regression proving cached chart docs are surfaced only
  as bounded `knowledgeFacts` summaries, respect `maxFacts`, and omit raw
  markdown/source metadata. Focused validation:
  `node --experimental-strip-types test/unit/planner-knowledge-facts-prompt.test.mjs`.
- Commit 11 enforced the advisory confidence contract for Helm chart-doc
  markdown facts. Fact-set parsing, knowledge pack validation, and compact
  agent-result validation now reject `helm-chart-docs-markdown` facts that are
  promoted above medium confidence. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-cache-contracts.test.mjs`,
  `node --experimental-strip-types --test test/unit/knowledge-helm-chart-docs-contract.test.mjs`,
  and
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`.
- Commit 12 updated durable project and skill documentation for Helm chart-doc
  facts. The roadmap, rules, README, and infra skill references now describe the
  implemented cache-first public-reference chart-doc path, its local-source
  priority order, and the medium-confidence advisory contract. Focused
  validation: `git diff --check` and `npm run test:structure`.
- Commit 13 recorded final verification for the Helm chart-doc facts slice.
  `npm run verify` passed end to end: lint checked 198 files, structure checked
  65 test files, unit passed 339 tests, integration passed 72 tests, contract
  passed 20 tests, isolated shard execution checked 53 files, smoke and e2e
  passed, coverage passed at 89.11% lines / 78.69% branches / 96.31% functions,
  and package dry-run reported 135 packaged entries.

Final validation:

- `npm run verify`: passed.
- `git diff --check`: passed after recording this handoff.

Remaining follow-ups:

- Pulumi component facts and language-import/resource discovery beyond Pulumi
  YAML remain pending.
- Optional markdown normalization for live official docs remains pending.
- Local fact refresh/staleness reporting and opt-in team storage backends
  remain pending.

## 2026-05-07 Active Pulumi Package Docs Fact Plan

Status:

- Completed. This session continued `infra-agent` development under the
  existing architecture and safety rules, with a minimum of 10 meaningful
  commits planned for this slice.
- The selected product slice is Pulumi package-level docs fact extraction:
  parse already-cached Pulumi Registry package docs markdown, emit compact
  package guidance facts, and prove the facts flow through workspace
  extraction, bounded packs, CLI output, planner prompts, and compact
  `knowledgeFacts`.

Why this direction:

- The previous Pulumi package docs source slice already emits
  `pulumi-docs:package:<slug>` sources from safe project-root `@pulumi/*`
  dependencies.
- The previous Pulumi resource docs slice already added deterministic YAML
  resource docs facts. The roadmap still lists Pulumi package docs fact
  extraction as pending.
- This follows the Claude Code agent-architecture patterns already captured in
  this repo: cache-first retrieval, budgeted fact summaries, compact handoff,
  parser-enforced contracts, and no raw docs in ordinary agent context.

Subagent plan:

- `Lorentz` is the read-only architecture explorer for
  `learning-claude-code` patterns relevant to this slice.
- `Bacon` is the read-only codebase explorer for the current knowledge
  extraction/pack/CLI/contract surfaces and the concrete 10-commit breakdown.
- The main agent owns edits, staged validation, durable handoff updates, and
  commits.

Planned commits and checkpoints:

1. Record this active execution plan in `docs/HANDOFF.md`.
2. Add package docs markdown extraction helpers and direct unit coverage.
3. Cover workspace extraction from cached Pulumi package docs sources.
4. Cover package docs facts entering bounded public-reference packs.
5. Add CLI `knowledge extract` coverage for cached Pulumi package docs facts.
6. Add CLI `knowledge pack` coverage for cached Pulumi package docs facts.
7. Strengthen compact `knowledgeFacts` contract coverage for package docs
   facts.
8. Cover planner prompt budgeting for package docs facts without raw docs.
9. Update durable roadmap, rules, and bundled skill guidance.
10. Run full verification and record the validation outcome in this handoff.

Current risks and constraints:

- This slice only consumes explicit package docs sources selected from safe
  project-root `package.json` dependencies. It does not parse TypeScript,
  Python, Go, .NET, or Java imports, and it does not infer components.
- Cached package docs facts are medium-confidence public-reference guidance.
  They remain advisory and do not replace `pulumi preview`, provider schemas,
  or stack config inspection.
- The extractor must skip HTML-shaped cache entries and secret-looking package
  sections, values, descriptions, paths, and summaries.
- No deploy/apply/state mutation behavior is allowed.

Progress log:

- Commit 1 recorded this active Pulumi package docs fact plan, subagent
  responsibilities, the 10 planned checkpoints, and the slice risks. Focused
  validation: `git diff --check`.
- Commit 2 added cached Pulumi package docs markdown extraction under the
  existing `pulumi-docs-markdown` extractor boundary. Package docs tables,
  link/code bullets, and module headings now emit bounded medium-confidence
  `pulumi-docs-guidance` facts while skipping HTML-shaped and secret-looking
  content. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-docs-extraction.test.mjs`.
- Commit 3 covered the workspace cache-to-extraction path for package docs.
  `extractWorkspaceKnowledgeFacts` now has a regression proving selected
  `pulumi-docs:package:aws` cache entries become extracted package guidance
  facts for a Pulumi target. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-docs-extraction.test.mjs`.
- Commit 4 covered the package-docs-to-pack path. Bounded
  `KnowledgePack` output now has a regression proving package docs facts retain
  public-reference source posture, do not become examples, and omit raw docs.
  Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-docs-extraction.test.mjs`.
- Commit 5 added CLI extraction coverage for cached Pulumi package docs.
  `knowledge extract --domain pulumi --target ... --source ... --json` now has
  an integration regression proving package docs facts are extracted through
  the real command path without raw cached markdown. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-extract-main.test.mjs`.
- Commit 6 added CLI pack coverage for cached Pulumi package docs.
  `knowledge pack --domain pulumi --target ... --source ... --json` now proves
  package docs facts enter bounded public-reference packs through the real
  command path without raw cached markdown. Focused validation:
  `node --experimental-strip-types test/integration/cli-knowledge-pack-main.test.mjs`.
- Commit 7 added ranking posture coverage for package docs guidance. Local
  high-confidence Pulumi config facts continue to outrank medium-confidence
  public package docs guidance under the deterministic fact ranking path.
  Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pack-ranking.test.mjs`.
- Commit 8 strengthened compact handoff coverage for Pulumi package docs
  facts. The compact agent result parser accepts package docs guidance facts
  and still rejects raw source fields such as package docs URLs inside
  `knowledgeFacts`. Focused validation:
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`.
- Commit 9 added focused planner prompt budgeting coverage for Pulumi package
  docs facts. The prompt includes only bounded `knowledgeFacts` summaries,
  respects `maxFacts`, and excludes raw markdown, URL, cache timestamp, and
  content-hash fields. Focused validation:
  `node --experimental-strip-types test/unit/planner-knowledge-facts-prompt.test.mjs`.
- Commit 10 updated durable roadmap, agent rules, README, and bundled skill
  guidance. The docs now record that cached Pulumi package docs facts are
  implemented, public-reference/advisory, ranked below local Pulumi config
  facts, and still do not cover language imports or components. Focused
  validation: `git diff --check` and `npm run test:structure`.
- Commit 11 recorded final validation for the Pulumi package docs fact slice.
  `npm run verify` passed across lint, test structure, unit, integration,
  contract, isolated shard execution, smoke, e2e, coverage, and package
  dry-run.

Final validation on 2026-05-07:

- `npm run lint`: passed with 194 checked files.
- `npm run test:structure`: passed with 62 checked test files.
- `npm run test:unit`: passed.
- `npm run test:integration`: passed.
- `npm run test:contract`: passed.
- `npm run test:isolated`: passed with 50 checked shards.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm run test:coverage`: passed at 89.03% lines, 78.59% branches, and
  96.20% functions.
- `npm run package:check`: passed with 134 packed entries in the installable
  package surface.

## 2026-05-07 Active Multi-Stage Development Plan

Status:

- Completed. This session continued `infra-agent` development under the
  current `AGENTS.md`, `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, and
  `docs/CLAUDE_CODE_AGENT_PATTERNS.md` constraints.
- The selected product slice is Pulumi resource-level knowledge support:
  detect deterministic Pulumi YAML resource tokens, select Pulumi Registry
  resource docs sources, extract compact resource guidance from cached docs,
  and expose that context through the existing cache-first knowledge and
  compact handoff surfaces.

Why this direction:

- The roadmap lists Pulumi resource-level docs source selection, package/
  resource docs fact extraction, and Pulumi component facts as pending work.
- This slice improves planner context without changing the safety model:
  official docs remain explicit-cache or prefetch driven, facts remain
  advisory, and native validators such as `pulumi preview` remain
  authoritative.
- This follows the Claude Code architecture lessons already adopted by this
  repo: compact context packets, deterministic state, structured handoff, and
  bounded tool/result summaries. It does not add recursive subagents,
  background daemons, chat UI, or apply/deploy behavior.

Planned commits and checkpoints:

1. Record the active execution plan in `docs/HANDOFF.md`.
2. Add Pulumi YAML resource-token discovery to workspace inspection.
3. Surface discovered Pulumi resource metadata in target details and tests.
4. Select resource-level Pulumi Registry docs sources from deterministic
   Pulumi YAML resource tokens.
5. Cover the source selection through knowledge source report and CLI tests.
6. Extend the Pulumi docs markdown extractor to emit compact resource argument
   facts from cached Registry docs markdown.
7. Cover resource docs extraction through knowledge extraction and pack tests.
8. Strengthen compact `knowledgeFacts` contract coverage for Pulumi resource
   docs facts.
9. Update roadmap/skill documentation so future agents know the new capability
   and its remaining limits.
10. Run the full verification gate and record the final validation outcome.

Current risks and constraints:

- Pulumi YAML resources are deterministic enough to inspect, but language
  source imports are not in scope for this session.
- Cached Pulumi Registry docs are advisory and may be stale; compact facts must
  not be treated as validator-grade evidence.
- Resource docs source selection must not expose stack config values, backend
  URLs, secrets, or raw `package.json` content.
- No deploy/apply/state mutation behavior is allowed in this slice.

Progress log:

- Commit 2 added deterministic Pulumi YAML resource-token inspection. It records
  safe `resources.<name>.type` tokens on `PulumiProjectSummary.resourceTokens`
  and skips malformed or secret-looking tokens. Focused validation:
  `node --experimental-strip-types --test test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 3 surfaced Pulumi resource-token metadata through targeting and
  inspection output. Pulumi target details now include bounded resource type
  summaries, and resource names/types can contribute to repository-hint
  targeting. Focused validation:
  `node --experimental-strip-types --test test/unit/pulumi-resource-token-inspection.test.mjs`.
- Commit 4 selected Pulumi Registry resource docs sources from deterministic
  YAML resource tokens. Source selection uses safe package dependency versions
  when available, builds public-reference Registry API docs URLs, and still
  skips secret-looking tokens. Focused validation:
  `node --experimental-strip-types --test test/unit/knowledge-pulumi-docs-sources.test.mjs`.
- Commit 5 added CLI-level coverage for Pulumi resource docs source reporting.
  `knowledge sources --domain pulumi --target ... --json` now has an
  integration assertion proving the public resource docs source appears without
  raw Pulumi YAML, package manifest content, or stack config values. Focused
  validation:
  `node --experimental-strip-types test/integration/cli-knowledge-sources-main.test.mjs`.
- Commit 6 extended cached Pulumi docs markdown extraction for resource docs.
  Cached Registry markdown resource tables and bullets can now emit bounded
  medium-confidence `argument` facts while skipping HTML and secret-looking
  fields. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-extraction.test.mjs`.
- Commit 7 covered the end-to-end cache-to-pack resource docs path. Workspace
  extraction and bounded pack tests now prove cached Pulumi resource docs facts
  are selected for a Pulumi YAML resource target and remain public-reference
  advisory facts. Focused validation:
  `node --experimental-strip-types test/unit/knowledge-pulumi-docs-extraction.test.mjs`.
- Commit 8 strengthened compact handoff coverage for Pulumi resource docs
  facts. The contract accepts compact resource `argument` facts and rejects raw
  source fields such as resource docs URLs inside `knowledgeFacts`. Focused
  validation:
  `node --experimental-strip-types test/contract/agent-result-knowledge-contract.test.mjs`.
- Commit 9 updated durable roadmap, agent rules, and the bundled
  `infra-configuration` skill for the new Pulumi resource docs path. The docs
  record that only Pulumi YAML resource tokens are supported, cached resource
  docs facts remain advisory, and language-source/component inference is still
  out of scope. Focused validation: `git diff --check`.
- Commit 10 recorded final verification for the Pulumi resource knowledge
  slice. `npm run verify` passed, including lint, structure, unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run.

Final validation on 2026-05-07:

- `npm run lint`: passed with 193 checked files.
- `npm run test:structure`: passed with 61 checked test files.
- `npm run test:unit`: passed with 326 tests.
- `npm run test:integration`: passed with 68 tests.
- `npm run test:contract`: passed with 18 tests.
- `npm run test:isolated`: passed with 49 checked shards.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm run test:coverage`: passed at 88.98% lines, 78.55% branches, and
  96.18% functions.
- `npm run package:check`: passed with 134 packed entries in the installable
  package surface.

## 2026-05-06 Pulumi Package Docs Source Slice

Status:

- Implemented locally. This slice extends Pulumi official-doc source selection
  from config/YAML docs to package-level Pulumi Registry docs using explicit
  project-root `package.json` dependencies.

Core files changed:

- `src/domain/inspect-workspace.ts`
- `src/domain/pulumi-docs-context.ts`
- `src/types/repository.ts`
- `test/unit/knowledge-pulumi-docs-sources.test.mjs`
- `test/integration/cli-knowledge-sources-main.test.mjs`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- `PulumiProjectSummary` now records project-root `package.json` files as
  `packageFiles`.
- Pulumi docs source selection reads those manifests and emits one deduped
  public `pulumi-docs:package:<slug>` source for each safe `@pulumi/*`
  dependency except `@pulumi/pulumi`.
- Package docs sources point at Pulumi Registry API docs, for example
  `https://www.pulumi.com/registry/packages/aws/api-docs/`.
- Safe public semver constraints are stored as `source.version`, so cache ids
  can distinguish package major/range changes. Local, workspace, git, HTTP, and
  secret-looking dependency specs are not copied into source metadata.
- `knowledge sources --domain pulumi --target <project> --json` now exposes the
  package docs sources as public-reference, URL-backed sources without exposing
  raw `package.json` or Pulumi YAML content.

Design notes:

- This is package-level source selection only. It does not parse TypeScript,
  Python, Go, .NET, or Java source imports, and it does not infer individual
  resource docs from preview events or source code.
- Package docs remain advisory public-reference knowledge. The agent loop still
  does not fetch docs automatically; explicit `knowledge prefetch` owns any
  network retrieval.
- `packageFiles` is intentionally narrow and records only the Pulumi project
  directory's manifest. Ancestor/workspace package manifests need a separate
  project/package ownership design before they can be used safely.

Known validation:

- Focused direct check passed for
  `test/unit/knowledge-pulumi-docs-sources.test.mjs`.
- Focused direct check passed for
  `test/integration/cli-knowledge-sources-main.test.mjs`.
- `npm run test:structure`: passed with 60 checked test files.
- `npm run lint`: passed with 191 checked files.
- `npm run test:unit`: passed with 321 tests.
- `npm run test:integration`: passed with 68 tests.
- `npm run verify`: passed. This includes lint, structure, layered unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run.
- Isolated shard execution passed with 48 checked shards.
- Coverage gate passed at 89.01% lines, 78.60% branches, and 96.12% functions.
- Package dry-run passed with 133 entries in the installable package surface.

Remaining work:

- Add resource-level Pulumi docs source selection only after deterministic
  resource evidence is available, such as YAML resource tokens or parsed
  language AST/import usage.
- Add package/resource docs fact extraction after source selection and cache
  freshness behavior remain stable.
- Add a markdown normalization path for live Pulumi official docs only if the
  explicit prefetch flow continues to need HTML-backed pages.
- Extend team-cache backend contracts later; public Pulumi docs facts can be
  shareable, but workspace-private Pulumi config/package ownership evidence
  still requires explicit opt-in before remote publication.

## 2026-05-06 Pulumi Docs Guidance Extraction Slice

Status:

- Implemented locally. This slice follows Pulumi official-doc source selection
  by extracting small advisory facts from already-cached official Pulumi docs
  markdown, without adding live fetches or changing the cache-only agent loop.

Core files changed:

- `src/knowledge/fact-extractors/pulumi-docs-markdown.ts`
- `src/knowledge/facts.ts`
- `src/types/knowledge.ts`
- `src/cli/agent-result-contract.ts`
- `src/knowledge/fact-ranking.ts`
- `test/unit/knowledge-pulumi-docs-extraction.test.mjs`
- `test/integration/cli-knowledge-extract-main.test.mjs`
- `test/unit/knowledge-cache-contracts.test.mjs`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- Cached `pulumi-docs:config` and `pulumi-docs:yaml` markdown entries now
  extract bounded `pulumi-docs-guidance` facts with
  `pulumi-docs-markdown` as the extraction method.
- The extractor only accepts `text/markdown` cache entries and ignores
  HTML-shaped content, so live official pages still require a deliberate
  retrieval/normalization step before extraction.
- Extracted docs guidance is medium-confidence and advisory; repo-local Pulumi
  project and stack config facts remain the stronger high-confidence source for
  actual workspace edits.
- Secret-looking command names, descriptions, paths, and summaries are skipped.
- `knowledge extract --source <pulumi-docs source>` can report the source as
  `extracted` when the matching cache entry already exists, and
  `knowledge pack` can include the facts as public-reference knowledge without
  embedding raw docs or example bodies.

Design notes:

- The extractor is isolated under `src/knowledge/fact-extractors/` so
  `src/knowledge/facts.ts` stays a dispatcher instead of absorbing every
  source-specific parser.
- This intentionally covers only the Pulumi config and YAML docs sources that
  the project inspector can already select. Package-level source selection now
  exists in the Pulumi package docs source slice; resource-level source
  selection still needs deterministic resource evidence.
- The facts are guidance-shaped command/runtime facts, not examples. This keeps
  the first Pulumi docs extractor small and avoids leaking large prose snippets
  into planner context.

Known validation:

- Focused direct checks passed for
  `test/unit/knowledge-pulumi-docs-extraction.test.mjs`,
  `test/unit/knowledge-cache-contracts.test.mjs`, and
  `test/integration/cli-knowledge-extract-main.test.mjs`.
- `npm run test:structure`: passed with 60 checked test files.
- `npm run lint`: passed with 191 checked files.
- `npm run verify`: passed. This includes lint, structure, layered unit,
  integration, contract, isolated shard execution, smoke, e2e, coverage, and
  package dry-run.
- Isolated shard execution passed with 48 checked shards.
- Coverage gate passed at 89.01% lines, 78.59% branches, and 96.16% functions.
- Package dry-run passed with 133 entries in the installable package surface.

Remaining work:

- Add a markdown normalization path for live Pulumi official docs only if the
  explicit prefetch flow continues to need HTML-backed pages.
- Add resource-level Pulumi docs source selection once inspection records the
  relevant imports, YAML resource tokens, or resource type usage.
- Extend team-cache backend contracts later; public Pulumi docs facts can be
  shareable, but workspace-private Pulumi config facts still require explicit
  opt-in.

## 2026-05-06 Pulumi Official Docs Source Slice

Status:

- Implemented locally. This slice resumes feature development after test
  structure hardening and fills the first Pulumi official-doc source-selection
  gap without changing the cache-only agent loop policy.

Core files changed:

- `src/domain/pulumi-docs-context.ts`
- `src/knowledge/prefetch.ts`
- `src/knowledge/retrieve.ts`
- `test/unit/knowledge-pulumi-docs-sources.test.mjs`
- `test/integration/cli-knowledge-sources-main.test.mjs`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- Pulumi projects now emit bounded public `pulumi-docs` sources for Pulumi
  official configuration docs when project config or stack-file evidence is
  present.
- Pulumi YAML projects now emit a second public `pulumi-docs` source for the
  official Pulumi YAML docs when `Pulumi.yaml` declares `runtime: yaml` or
  `runtime.name: yaml`.
- `collectWorkspaceKnowledgeSources` wires these docs sources alongside the
  existing local `pulumi-config` source, so `knowledge sources` and
  `knowledge prefetch` can list/prefetch them with target filtering.
- URL-backed public knowledge fetches now receive a default 30-day
  `staleAfter` value when the caller does not provide one, preventing official
  docs cache entries from becoming permanently fresh by omission.

Design notes:

- This intentionally does not parse Pulumi language source imports yet. Package
  manifest source selection now exists in the Pulumi package docs source slice;
  this slice stays focused on project/stack metadata.
- `pulumi-docs` sources have no `localPath`, are classified as
  `public-reference`, and do not contain raw project YAML, stack config values,
  backend URLs, or secrets.
- Fact extraction for cached `pulumi-docs` markdown now exists in the later
  Pulumi docs guidance extraction slice; this source-selection slice remains
  scoped to listing, prefetch wiring, and refresh policy.
- New coverage lives in a focused unit shard rather than extending the
  near-threshold knowledge retrieval/extraction tests.

Known validation:

- Focused direct checks passed for
  `test/unit/knowledge-pulumi-docs-sources.test.mjs` and
  `test/integration/cli-knowledge-sources-main.test.mjs`.
- `npm run test:structure`: passed with 59 checked test files.
- `npm run lint`: passed with 189 checked files.
- `npm run test:unit`: passed with 314 tests.
- `npm run test:integration`: passed with 67 tests.
- `npm run test:contract`: passed with 17 tests.
- `npm run test:isolated`: passed with 47 checked shards.
- `npm run verify`: passed. This includes lint, structure, layered suites,
  isolated shards, smoke, e2e, coverage, and package dry-run.
- Coverage gate passed at 88.98% lines, 78.55% branches, and 96.15% functions.
- Package dry-run passed with 132 entries in the installable package surface.

Remaining work:

- Add resource-level Pulumi docs source selection once inspection records the
  relevant YAML resource tokens, language imports, or resource type usage.
- Broaden Pulumi docs fact extraction only after package/resource docs source
  selection and cache freshness behavior remain stable.
- Extend team-cache backend contracts later; public `pulumi-docs` entries can
  be shareable, but workspace-private Pulumi config facts still require
  explicit opt-in.

## 2026-05-06 Local Knowledge Cache Reuse Slice

Status:

- Implemented locally. This slice follows the artifact integrity work by
  reducing repeated repo-local learning when cached local facts are still
  fingerprint-fresh.

Core files changed:

- `src/knowledge/extract.ts`
- `test/unit/knowledge-extraction-cache-reuse.test.mjs`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- Local source extraction now checks the `KnowledgeStore` before regenerating
  Helm chart schemas, Helm chart metadata, Terraform provider schema summaries,
  Terraform local module facts, and Pulumi config facts.
- A cached local source entry is reused only when it has a fingerprint, the
  content hash matches its content, the content type matches the source kind,
  the entry is not time-stale, and the current workspace files still match the
  recorded fingerprint.
- Stale, missing, corrupt, or unfingerprinted local entries are regenerated and
  written back through the store with `metadata.retrieval=workspace-local`.
- If cache persistence fails, extraction falls back to an in-memory entry so
  read-only local extraction is not blocked by cache filesystem permissions.

Design notes:

- This remains a local cache optimization, not a remote/team-cache feature.
- Cache reuse is validation-first: stale local files never silently produce
  high-confidence fresh facts.
- The dedicated unit shard keeps cache-reuse assertions separate from the
  already-large knowledge extraction content tests.

Known validation:

- Focused direct check passed for
  `test/unit/knowledge-extraction-cache-reuse.test.mjs`.
- `npm run test:structure`: passed with 58 checked test files.
- `npm run lint`: passed with 187 checked files.
- `npm run test:unit`: passed with 309 tests.
- `npm run verify`: passed. This includes lint, structure, layered suites,
  isolated shards, smoke, e2e, coverage, and package dry-run.
- Coverage gate passed at 88.96% lines, 78.53% branches, and 96.13% functions.
- Package dry-run passed with 131 entries in the installable package surface.

Remaining work:

- Extend the same reuse pattern to official docs refresh policy once Pulumi docs
  and broader provider/resource coverage are implemented.
- Add team-cache backend contracts later; they should reuse the same artifact
  and fingerprint validation gates before accepting uploads.

## 2026-05-06 Knowledge Artifact Integrity Slice

Status:

- Implemented locally. This slice continues feature development after the test
  architecture hardening work and closes the first integrity gap for persisted
  knowledge artifacts.

Core files changed:

- `src/knowledge/artifact-manifest.ts`
- `src/knowledge/validation-artifact-reference.ts`
- `src/knowledge/validation-source-fingerprints.ts`
- `src/knowledge/validate.ts`
- `src/knowledge/pack.ts`
- `src/cli/main.ts`
- `test/unit/knowledge-artifact-integrity.test.mjs`
- `test/integration/cli-knowledge-pack-main.test.mjs`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- `knowledge extract --out ... --manifest-out ...` and
  `knowledge pack --out ... --manifest-out ...` now store the manifest
  `artifact.sha256` as the hash of the persisted artifact bytes, not only the
  in-memory payload shape.
- `knowledge validate <manifest.json>` re-reads the referenced artifact and
  rejects missing files, byte-hash drift, and manifest metadata drift for
  artifact kind, id, source ids, source count, fact count, and stale source
  count.
- `knowledge-pack` sources now preserve a compact local fingerprint object
  alongside digest/file-count summaries, so repo-local facts can be rechecked
  later without storing raw local file contents.
- `knowledge validate <pack.json> --workspace <workspace>` rechecks pack source
  fingerprints and fails when local files changed or disappeared.
- Manifest validation delegates to referenced artifact validation, so stale
  repo-local facts surface through the manifest path as well.

Design notes:

- This is still local-only and read-only validation. It adds no backend config,
  credentials, uploads, remote writes, or network refresh.
- Persisted fingerprints include safe workspace-relative paths and SHA-256
  hashes only; they do not include raw docs, schemas, examples, file contents,
  backend URLs, buckets, profiles, or tokens.
- The validator logic was split into focused helper modules for artifact
  reference checks and source fingerprint checks instead of growing one large
  validation file further.
- This slice prepares cache/team-cache reuse policy: a pack can be reused only
  after its artifact bytes and local source freshness still match the recorded
  manifest/fingerprints.

Known validation:

- `npm run test:structure`: passed with 57 checked test files.
- `npm run lint`: passed with 186 checked files.
- `npm run test:unit`: passed with 307 tests.
- `npm run test:integration`: passed with 67 tests.
- `npm run test:contract`: passed.
- `npm run test:isolated`: passed with 45 checked shards.
- `npm run verify`: passed. This includes lint, structure, layered suites,
  isolated shards, smoke, e2e, coverage, and package dry-run.
- Coverage gate passed at 88.95% lines, 78.52% branches, and 96.12% functions.
- Package dry-run passed with 131 entries in the installable package surface.
- Focused direct checks passed for
  `test/unit/knowledge-artifact-integrity.test.mjs` and
  `test/integration/cli-knowledge-pack-main.test.mjs`.
- `npx tsc --noEmit` was attempted but not used as a gate because `npx`
  tried to resolve `tsc` from `registry.npmjs.org` and failed under restricted
  network (`EAI_AGAIN`). This repo currently has no local TypeScript compiler
  dependency; validation uses the existing `node --experimental-strip-types`
  gates.

Remaining work:

- Add cache reuse for extraction: local source extraction should read a
  fingerprinted cache entry first, verify freshness, and only regenerate stale
  or missing local content.
- Add a team-cache backend contract only after the local integrity gate remains
  stable; the backend should refuse artifacts that fail `knowledge validate`.
- Consider a later validator module split if `src/knowledge/validate.ts` grows
  substantially beyond its current contract-validation role.

## 2026-05-06 Near-1000 Test Shard Split Slice

Status:

- Implemented. This slice continues test-system optimization before feature
  development resumes.

Core files changed:

- `scripts/check-test-structure.mjs`
- `test/contract/infra-graph-*-contract.test.mjs`
- `test/support/infra-graph-contract-fixtures.mjs`
- `test/integration/cli-knowledge-*-main.test.mjs`
- `test/unit/agent-output-approval-*.test.mjs`
- `docs/TESTING.md`
- `README.md`
- `AGENTS.md`
- `docs/HANDOFF.md`

What changed:

- Split the remaining near-threshold CLI knowledge integration shard into args,
  source listing/prefetch, extraction, and knowledge-pack command shards.
- Split approval-output unit coverage into approval-required behavior and
  explicit approval grant/snapshot/suggested-command behavior.
- Split the large infra graph shape contract into envelope, source provenance,
  kind totals, node/edge shape, impact summary, and review-target shards.
- Moved the reusable valid infra graph payload to
  `test/support/infra-graph-contract-fixtures.mjs`.
- Lowered the structure guard shard cap from 1,200 to 1,000 lines.

Design notes:

- These splits preserve existing assertions while giving each shard a clear
  contract or behavior boundary.
- The graph fixture is shared from `test/support/` because it is a stable
  contract payload reused across small contract shards, not a broad harness.

Known validation:

- `node --check` passed for all new split shards.
- `npm run test:structure`: passed with 56 checked test files.
- Focused regression passed with 12 tests covering the split infra graph
  contracts, knowledge artifact commands, and approval-required output.
- `npm run test:unit`: passed with 303 tests.
- `npm run test:integration`: passed with 65 tests.
- `npm run test:contract`: passed with 17 tests.
- `npm run test:isolated`: passed with 44 isolated shards.
- `npm run verify`: passed. This includes lint, structure, layered suites,
  isolated shards, smoke, e2e, coverage, and package dry-run.
- Coverage gate passed at 89.14% lines, 78.86% branches, and 96.17% functions.
- Package dry-run passed with 129 entries in the installable package surface.

Remaining work:

- Continue monitoring the largest remaining shards before adding cases:
  `knowledge-sources-retrieval`, `agent-output-result-card`, and
  `knowledge-pack-ranking` are under the hard cap but should be split before
  they grow further.

## 2026-05-06 Process-Isolated Test Gate Slice

Status:

- Implemented. This slice continues test-system optimization before feature
  development resumes.

Core files changed:

- `.github/workflows/verify.yml`
- `package.json`
- `scripts/check-test-structure.mjs`
- `test/run-isolated.mjs`
- `test/unit/*.test.mjs`
- `test/integration/*.test.mjs`
- `test/contract/*.test.mjs`
- `docs/TESTING.md`
- `README.md`
- `AGENTS.md`
- `docs/HANDOFF.md`

What changed:

- Split the remaining 1500-line-class shards by behavior:
  `domain-terraform-pulumi-tail.test.mjs` became domain planner routing,
  Terraform edit-plan routing, and validation issue classification shards;
  `tools-validation-model.test.mjs` became tool execution validation,
  planner/provider model, and planner decision parser shards;
  `agent-runtime-compact.test.mjs` became runtime execution, handoff, and trace
  validation shards; `infra-graph-contracts.test.mjs` became graph shape and
  graph report contract shards.
- Lowered the test shard size cap from 1,800 to 1,200 lines for that slice.
  A later near-threshold split lowered the active cap to 1,000 lines.
- Added `test/run-isolated.mjs` and `npm run test:isolated` to execute every
  unit, integration, and contract shard in a fresh Node process.
- Added the `isolated-shards` CI job and made smoke/e2e depend on it, so broad
  runtime checks only run after normal category execution and process-isolated
  execution both pass.
- Extended `test:structure` to enforce the isolated runner, the lower shard
  cap, the local `verify` gate, and the CI isolated-shards job.

Design notes:

- The normal category runners remain single-process imports because they are
  fast and preserve existing focused-test ergonomics.
- The isolated runner is a second gate, not a replacement. It catches hidden
  dependencies on import order, process globals, exit code state, stdout
  capture, and CLI mocks.
- This keeps test organization file-based and reviewable without introducing a
  new test framework or nested shard hierarchy.

Known validation:

- `npm run test:structure`: passed with 46 checked test files after the shard
  split, lower cap, and isolated-runner wiring.
- `npm run lint`: passed with 172 checked files.
- `npm run test:unit`: passed with 302 tests.
- `npm run test:integration`: passed with 64 tests.
- `npm run test:contract`: passed with 12 tests.
- `npm run test:isolated`: passed with 35 independently spawned shards.
- `npm run verify`: passed. This covered lint, structure, explicit category
  suites, process-isolated shard execution, smoke, e2e, coverage, and package
  dry-run.
- Coverage remained above gates: 89.12% lines, 79.04% branches, and 96.18%
  functions.
- Package dry-run passed with 128 entries in the installable package surface.
- `git diff --check` and `git diff --cached --check` passed.
- Committed as `9c972b6 Tighten test shard isolation`.

## 2026-05-06 Knowledge Artifact Manifest Slice

Status:

- Implemented locally. This slice resumes feature development after the test
  architecture hardening work and adds a plan-only manifest before any
  remote/team-cache backend exists.

Core files changed:

- `src/knowledge/artifact-manifest.ts`
- `src/knowledge/validate.ts`
- `src/cli/main.ts`
- `test/unit/knowledge-pack-ranking.test.mjs`
- `test/integration/cli-knowledge-{args,sources,extract,pack}-main.test.mjs`
- `README.md`
- `AGENTS.md`
- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

What changed:

- Added `infra-agent.knowledge-artifact-manifest`, built from persisted
  knowledge extraction or pack artifacts.
- Added `--manifest-out <manifest.json>` for `knowledge extract` and
  `knowledge pack`. The flag requires `--out`, so manifests always reference a
  persisted artifact path.
- Manifest content records artifact kind/id/path/hash, actual source ids,
  source/fact/stale counts, storage-policy summary, and a plan-only publication
  section.
- Publication planning is deliberately non-mutating:
  `executionMode=plan-only`, `remoteWriteAllowed=false`,
  `credentialRequired=false`, and `uploadCommand=null`.
- Publication planning separates `publishableByDefaultSourceIds` from
  `blockedSources` with explicit reasons such as workspace-private source,
  stale source, or explicit-opt-in-required.
- `knowledge validate` now accepts artifact manifests and rejects forged
  manifests that enable remote writes, require credentials, include upload
  commands, omit validation requirements, or reference source ids outside the
  artifact.

Design notes:

- This is a backend planning contract, not a backend implementation. It adds no
  S3/GCS/Azure/Postgres config, credentials, network behavior, upload command,
  or dependency.
- The manifest derives storage posture from existing source/pack
  `storagePolicy` fields and stale flags instead of re-inferring source safety.
- Manifests do not include raw docs, raw local file content, source fingerprint
  file lists, backend URLs, buckets, profiles, or tokens.

Known validation:

- `npm run test:focused -- --test-name-pattern "knowledge artifact manifests" test/unit/knowledge-pack-ranking.test.mjs`:
  passed with 1 unit test.
- `npm run test:focused -- --test-name-pattern "knowledge pack command writes an artifact manifest|knowledge pack CLI args accept bounded" test/run-all.mjs`:
  passed with 2 integration tests.
- `npm run test:focused -- --test-name-pattern "knowledge extract command writes a reusable validation artifact|knowledge pack command writes an artifact manifest|knowledge artifact manifests" test/run-all.mjs`:
  passed with 3 focused tests across unit and integration shards.
- `npm run lint`: passed with 173 checked files.
- `npm run test:structure`: passed with 46 checked test files.
- `npm run test:unit`: passed with 303 tests.
- `npm run test:integration`: passed with 65 tests.
- `npm run verify`: passed. This covered lint, structure, unit,
  integration, contract, process-isolated shard execution, smoke, e2e,
  coverage, and package dry-run.
- Coverage remained above gates: 89.14% lines, 78.86% branches, and 96.17%
  functions.
- Package dry-run passed with 129 entries, including
  `src/knowledge/artifact-manifest.ts`.

Remaining validation before commit:

- `git diff --check`, cached diff review, and commit.

Remaining risks:

- Manifest validation checks the manifest contract and publication posture. It
  does not yet re-read the referenced artifact and compare `artifact.sha256`.
  That can be added before any actual remote backend writes are introduced.

## 2026-05-06 Enterprise Test Gate Hardening Slice

Status:

- Implemented. This slice continues the test-system work before resuming
  feature development.

Core files changed:

- `.github/workflows/verify.yml`
- `package.json`
- `scripts/check-test-structure.mjs`
- `docs/TESTING.md`
- `README.md`
- `AGENTS.md`
- `docs/HANDOFF.md`

What changed:

- Split GitHub Actions verification into separate static, unit, integration,
  contract, smoke/e2e, and coverage jobs so PR failures identify the broken
  layer directly.
- Added read-only workflow permissions, concurrency cancellation, and job
  timeouts.
- Added `npm run test:coverage` using Node's native coverage gate with minimum
  85% lines, 75% branches, and 90% functions over `src/**/*.ts`.
- Changed `npm run verify` to run unit, integration, and contract suites
  explicitly instead of hiding them behind `test:all`; it now also includes
  coverage and package dry-run checks.
- Added `npm run package:check` and made CI call that script rather than a raw
  package command.
- Tightened `test:structure`: `.test.mjs` shards now cap at 1,800 lines, and
  the guard rejects misplaced test-like files, committed `.only`/`.skip` tests,
  and missing package/CI gates. The workflow check now parses YAML instead of
  relying on substring matches.
- Split the largest near-limit test shards by behavior:
  `inspect-graph-impact.test.mjs` became workspace, Terraform plan, and Pulumi
  preview graph impact shards; `workspace-policy-targeting.test.mjs` became
  profile/targeting, edit-policy, and approval-policy shards; `cli-main.test.mjs`
  became core, knowledge, and report CLI shards.

Known validation:

- `npm run test:structure`: passed with 32 checked test files after the script,
  coverage, and workflow guard changes.
- `npm run test:coverage`: passed before shard splitting with 378 tests and
  aggregate coverage of 89.12% lines, 79.04% branches, and 96.18% functions.
- `npm run verify`: passed before shard splitting.
- `npm run test:structure`: passed with 38 checked test files after shard
  splitting and repo-level test-file placement checks.
- `npm run test:unit`: passed after shard splitting (302 tests).
- `npm run test:integration`: passed after shard splitting (64 tests).
- `npm run test:contract`: passed after shard splitting (12 tests).
- `npm run package:check`: passed after pinning npm cache to
  `/tmp/infra-agent-npm-cache` for sandbox-safe package dry-runs.
- `npm run verify`: passed after shard splitting and gate hardening. This
  covered lint (164 files), structure (38 files), unit (302 tests),
  integration (64 tests), contract (12 tests), smoke, e2e, coverage (378 tests,
  89.12% lines, 79.04% branches, 96.18% functions), and package dry-run
  (128 entries).
- `git diff --check`: passed.

Validation note:

- An earlier `npm run verify` attempt reached `npm run package:check` but
  returned non-zero because npm tried to write logs under `/home/heathen/.npm`
  in the sandbox. `package:check` now sets
  `npm_config_cache=/tmp/infra-agent-npm-cache`, and a clean rerun passed.
