# infra-agent Handoff Notes

This document captures current development state for future Codex sessions.

Detailed legacy slice history was moved to
[`docs/handoff/legacy-slices-2026-05-05-to-2026-05-06.md`](handoff/legacy-slices-2026-05-05-to-2026-05-06.md)
to keep this handoff file focused on the active development context.

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

## 2026-05-07 Active Helm Chart Docs Fact Plan

Status:

- In progress. This session continues `infra-agent` development under the
  existing architecture and safety rules, with a minimum of 10 meaningful
  commits planned for this slice.
- The selected product slice is external Helm chart-doc markdown fact
  extraction: parse already-cached public `chart-docs` markdown, emit compact
  chart-value facts, and prove those facts flow through workspace extraction,
  bounded packs, CLI output, planner prompts, and compact `knowledgeFacts`.

Why this direction:

- The roadmap still lists external chart-doc extraction beyond local
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
11. Update durable roadmap, rules, README, and bundled skill guidance.
12. Run full verification and record the validation outcome in this handoff.

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
