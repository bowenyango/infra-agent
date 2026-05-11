# AGENTS.md

This file is the mandatory operating standard for every agent that develops
`infra-agent`. It applies to the entire repository unless a more specific
`AGENTS.md` is added in a subdirectory.

`infra-agent` is a specialist infrastructure-configuration CLI and harness for
Helm, Pulumi, and Terraform. It is not a general coding assistant. Treat every
change as work on a safety-sensitive developer tool that other agents and human
operators will rely on.

## Required Reading Order

Before changing files, read enough local context to understand the current
state. Start with:

1. `AGENTS.md`
2. `docs/HANDOFF.md`
3. `docs/ROADMAP.md`
4. `docs/AGENT_RULES.md`
5. `docs/CLAUDE_CODE_AGENT_PATTERNS.md` when touching harness, planning,
   compact output, tool execution, or approval flow
6. `skills/infra-configuration/SKILL.md` when touching agent-facing behavior
   or documentation

Do not rely on stale conversation context when the repository already contains
durable project state.

## Mission And Product Boundaries

- Build an installable CLI and agent-facing skill package for infrastructure
  configuration work.
- Keep the product focused on Helm, Pulumi, Terraform, repository inspection,
  context retrieval, validation, semantic constraints, impact analysis, and
  safe handoff.
- Do not expand into a general-purpose coding agent, deployment system, daemon,
  chat UI, or autonomous apply/update runner.
- Do not add broad shell or filesystem capabilities unless they are tightly
  scoped to the infrastructure workflow and approval model.
- The web topology viewer is lower priority than reliable graph JSON, impact
  analysis, validation, and compact machine-readable handoff.

## Core Knowledge Direction

Infrastructure RAG is a core product differentiator for `infra-agent`, not a
generic vector-search add-on. Future development must optimize for accurate,
token-efficient infrastructure changes by extracting, validating, storing, and
retrieving compact knowledge units.

The long-term retrieval contract is `infra-agent.knowledge-unit` with five unit
types:

- `fact`: machine-readable constraints, defaults, enum-like values, identity
  fields, replacement-sensitive fields, and dependency relationships.
- `guidance`: short JSON-carried explanations with applicability, risk, and
  avoid conditions.
- `example`: bounded code or configuration samples, included only when concrete
  edit shape is needed.
- `diagnostic`: validation, plan, preview, provider, or runtime failure
  signatures with likely causes and review-only remediation guidance.
- `recipe`: safe infrastructure workflows such as Terraform moved blocks,
  Pulumi aliases, stack config changes, Helm values migration, and import/state
  repair review.

Do not make Vector DB retrieval a required v0 path. Prefer deterministic
metadata retrieval and ranking by domain, provider/package/chart, version,
resource/module/component, field, target path, validation issue, planned
action, risk type, freshness, and privacy scope. Public-reference provider,
chart, Helm metadata, and official-doc units may be shared through a registry or
team cache; internal module, component, chart, policy, incident, and example
units must remain local, repo-curated, or explicitly opted into private team
storage according to privacy scope.

## Non-Negotiable Safety Rules

- Never run destructive commands such as `git reset --hard`, broad `rm`, state
  mutation, deployment, `terraform apply`, `pulumi up`, `helm upgrade`, or
  Kubernetes mutation unless the user explicitly requests and approves that
  exact operation.
- Version `v0` must not execute deploy or apply commands from the agent loop.
- Treat Terraform state moves, Pulumi stack imports, Pulumi aliases that affect
  replacement behavior, DNS ownership changes, and Kubernetes ownership changes
  as review-only guidance unless explicitly approved by the user.
- Keep Pulumi validation preview-only. Do not hide local backend bootstrap,
  `pulumi stack init`, login, refresh/import, or state operations inside
  validation commands.
- Require explicit `native-stack-config-write` approval before bounded native
  Pulumi stack config writes, and do not silently initialize stacks inside that
  write path.
- Never commit secrets, credentials, tokens, kubeconfigs, cloud credentials, or
  secret Pulumi `secure` values.
- Do not expose API keys or request headers in `doctor`, compact JSON, logs,
  tests, result cards, or handoff docs.
- Preserve user changes. If the worktree is dirty, inspect the change and work
  with it. Do not revert changes you did not make.

## Standard Development Workflow

Every implementation slice must follow this sequence:

1. Inspect the current branch and worktree with `git status --short --branch`.
2. Read the relevant durable docs listed above.
3. Define a small complete slice with a clear behavior contract.
4. Inspect existing code paths before designing new abstractions.
5. Implement using existing patterns and narrow edits.
6. Add or update focused tests for the behavior contract.
7. Run the smallest useful verification first, then the full required checks.
8. Update persistent progress in `docs/HANDOFF.md` before committing.
9. Commit the completed slice with an intentional message.
10. Leave the worktree clean or clearly explain any remaining uncommitted work.

Large refactors must be split into independently testable commits. Do not mix
format-only churn, unrelated cleanup, and behavior changes in one commit.

## Engineering Standards

- Prefer simple, typed TypeScript over clever abstractions.
- Reuse existing domain types, helpers, CLI output shapes, and test fixtures.
- Keep functions deterministic where possible, especially in planner, parser,
  validation, compact-output, and impact-analysis code.
- Use structured parsers and structured data instead of fragile string parsing
  when a reasonable parser or schema exists.
- Treat CLI JSON schemas as agent-facing contracts. Add fields intentionally and
  keep them compact, documented, and tested.
- Keep text output useful for humans, but keep JSON output stable for agents.
- Avoid broad dependencies. Add a dependency only when it is widely used,
  maintained, security-appropriate, and materially better than local code.
- Do not introduce placeholders, TODO-driven behavior, fake validators, or
  speculative code paths.

## Context Discipline

- Minimize context sent to planners and downstream agents.
- Prefer compact summaries, selected source packets, schema facts, and validator
  output over whole documents or raw logs.
- Prefer repository-local evidence first: actual files, examples, schemas,
  lockfiles, provider schema exports, and native validation output.
- Official documentation should be version-aware and cache-first. Do not bundle
  full official docs into the package.
- Fetching official docs belongs in deliberate prefetch/retrieval paths, not in
  uncontrolled agent loops.
- Knowledge source, pack, and artifact-manifest outputs must preserve
  storage/publication posture: public reference facts may be staged for an
  explicit team cache, while workspace-private repo facts require opt-in before
  shared use. Manifests are plan-only and must not contain backend URLs,
  credentials, or upload commands.
- If context is stale or inferred, mark confidence appropriately and do not
  treat it as validator-grade authority.

## Infrastructure Domain Rules

- For Helm, prefer `values.yaml`, `values.schema.json`, rendered manifests, and
  chart examples before generic assumptions. Do not raw-parse templates as YAML.
- For Terraform, prefer variable declarations, validation blocks, `.tfvars`,
  `.terraform.lock.hcl`, provider schema exports, and plan JSON when available.
- For Pulumi, prefer stack config files, project config namespaces, preview
  events, and language/tooling conventions already present in the project.
- Model module and chart semantics explicitly: required fields, defaults,
  enums, mutually exclusive groups, exactly-one groups, implied fields,
  invalid mode combinations, identity fields, replacement-sensitive fields, and
  dependency edges.
- Treat create-before-delete conflicts as common and high-risk. Explain logical
  rename versus true replacement, but do not mutate state automatically.
- Possible rename, replacement cascade, and create-before-delete graph edges are
  advisory review signals, not permission to change state.

## Validation Policy

Use deterministic tools as the source of truth. The LLM may propose repairs,
but validators decide acceptability.

Required project checks before committing most code changes:

```sh
npm run lint
npm run test:unit
npm run smoke
npm run e2e
git diff --check
```

Use the aggregate command when the slice is ready:

```sh
npm run verify
```

For package-surface or installability changes, also run:

```sh
npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json
```

For YAML-writing behavior, include tests that prove invalid YAML is blocked
before mutation and ordinary YAML is parsed after mutation. Helm templates must
be validated through Helm rendering, not plain YAML parsing.

For Terraform, Pulumi, or Helm behavior, add tests that prove domain selection
stays focused and unrelated validators or context do not pollute compact output.

## Testing Standards

- Unit tests must not depend on external network, live LLM providers, live cloud
  accounts, or mutable user-global state.
- Keep tests split by responsibility. Use `test/unit/` for domain and planner
  helpers, `test/integration/` for CLI/runtime flows, `test/contract/` for
  JSON/report contracts, and `test/support/` only for narrow shared fixtures or
  harness helpers. Support files must not become production-code barrels.
- Keep test files reviewable. `npm run test:structure` fails any
  `.test.mjs` shard above 1,000 lines or support helper above 1,000 lines;
  split larger files by behavior or fixture family before adding more cases.
  The same guard blocks misplaced test-like files, committed `.only`/`.skip`
  tests, and checks that package/CI gates remain wired.
- Add new shard files directly under the matching category directory. The
  category runners discover direct `.test.mjs` shards through
  `test/run-category.mjs`; do not create nested shard directories.
- Use `npm run test:unit`, `npm run test:integration`,
  `npm run test:contract`, or `npm run test:all` for layered regression.
  Use `npm run test:isolated` after runner, global-state, CLI, or shared
  fixture changes to prove shards also pass as independent processes.
  `npm test` runs the structure guard plus the complete regression suite.
  Use `npm run test:focused -- --test-name-pattern "<pattern>" <runner-or-shard>`
  for focused checks.
- Use `npm run test:coverage` when changing shared runtime paths or reviewing
  CI coverage posture. It uses Node's native coverage gate with minimum 85%
  lines, 75% branches, and 90% functions over `src/**/*.ts`.
- `npm run verify` is the full local gate and includes lint, structure, unit,
  integration, contract, smoke, e2e, coverage, and package dry-run checks.
- Do not restore a monolithic `cli-smoke` unit file or broad
  `test/support/cli-smoke-harness.mjs`; `npm run test:structure` enforces the
  test layout.
- Mock or inject transports for LLM and official-doc fetch tests.
- Smoke and E2E tests must exercise expected behavior through realistic CLI or
  harness flows, not only internal helpers.
- Tests for compact JSON must assert the schema-relevant fields, omission of
  irrelevant context, and absence of secrets.
- Tests for impact analysis must cover dependency edges, possible renames,
  replacement reasons, and exclusive-identity conflicts with stable fixtures.
- Keep fixtures small, realistic, and domain-specific.

## CLI And Agent-Facing Contracts

- `infra-agent --version` must stay a cheap install/routing check.
- `infra-agent doctor [workspace] --json` must stay read-only and secret-safe.
- `agent --json` must stay compact and machine-readable. Use `--json-full` only
  for debugging full runtime state.
- Compact readiness must include only targeted planner, workspace, selected
  validation-plan, and selected-validator status, plus a fuller `doctorCommand`.
- CLI exit codes are part of the contract:
  - `0`: success
  - `1`: fatal CLI/runtime failure
  - `2`: validation blocked
  - `3`: approval required
  - `4`: clarification required
  - `5`: no safe action
  - `6`: repair budget exhausted
  - `7`: run preflight blockers
- Keep `identity-report` read-only. It must consume compact agent results and
  must not rerun validators or mutate infrastructure.
- Keep graph output read-only. `graph --terraform-plan` and
  `graph --pulumi-preview` attach existing plan/preview JSON and must not run
  Terraform or Pulumi.

## Documentation And Comments

- All repository docs, comments, test names, CLI messages, and commit messages
  must be in English.
- User-facing chat replies may use the user's language.
- Keep comments sparse and useful. Explain non-obvious intent, invariants, or
  safety constraints. Do not narrate obvious code.
- Update `docs/HANDOFF.md` for every completed slice with files changed,
  purpose, validation, and any remaining risks.
- Update `docs/ROADMAP.md`, `docs/AGENT_RULES.md`, skills, or README only when
  behavior or future-agent guidance actually changes.

## Git Discipline

- Commit every completed slice on the working branch.
- Do not amend or rewrite previous commits unless explicitly asked.
- Do not run destructive git operations without explicit user approval.
- Stage only files that belong to the completed slice.
- Before committing, run `git diff --cached --check` and inspect the cached
  diff or stat.
- Commit messages should be imperative and scoped, for example
  `Add compact agent readiness summary`.

## Dependency And Network Policy

- Prefer existing dependencies and Node standard library APIs.
- Ask before installing unusual, high-risk, abandoned, or broad dependencies.
- Network access must not be required for unit, smoke, or E2E tests.
- Dynamic official-doc retrieval must be explicit, bounded, cache-aware, and
  version-aware.
- Do not add telemetry, background network calls, or hidden update checks.

## Definition Of Done

A slice is done only when:

- The behavior is implemented end to end.
- Relevant docs and skills are updated.
- Focused tests cover the new or changed behavior.
- Required validation commands pass, or any skipped command is documented with a
  concrete reason.
- `docs/HANDOFF.md` records progress for future agents.
- The work is committed.
- The final response reports the commit hash, validation run, and any residual
  risk.
