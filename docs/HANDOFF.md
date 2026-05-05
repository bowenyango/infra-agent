# infra-agent Handoff Notes

This document captures current development state for future Codex sessions.

## 2026-05-05 Approval Query Flag Default Fallback Slice

Files added or updated:

- `src/cli/output.ts`
- `docs/HANDOFF.md`

Purpose:

- Use `DEFAULT_QUERY_LOOP_CONFIG` when compact result-card helpers receive a
  minimal test state without `config`.
- Preserve query-budget flags in approval continuation commands without making
  legacy helper tests construct full query-loop state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval-required posture|approval continuation flags" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Query Flag Exact Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten approval continuation query-budget validation from substring presence
  to exact flag/value checks.
- Reject missing, wrong, or duplicate query-budget flags in primary and
  additional approval continuation commands.
- Preserve the compact `harness.queryConfig` as the source of truth for resumed
  command budgets.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Handoff Documentation Refresh Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `approval.resume.pendingScope`.
- Document that approval continuation commands preserve query-loop budget
  flags.
- Document that suggested rerun/export commands preserve explicit
  `approval.grants` for the same task without broadening approval scope.
- Extend package metadata checks so the installable skill keeps exposing these
  handoff contracts.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Pending Scope Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `approval.resume.pendingScope` in compact parser input.
- Validate pending-scope count fields and cross-check them against
  `approval.signals`, `approval.resume.signalCount`,
  `approval.resume.additionalSignalCount`, and aggregate pending scope arrays.
- Update hand-authored compact fixtures for report-loader and contract tests.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|approval signals beyond|report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports" ./test/cli-smoke.test.mjs`
- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Pending Scope Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.pendingScope` to compact output.
- Summarize total, included, omitted, and additional approval signal counts.
- Summarize distinct pending write-risk, write-path, and tool-category counts
  so downstream agents can route without scanning every sampled signal first.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Pending Signal Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Reject compact approval signals that are already covered by
  `approval.grants`.
- Apply the same coverage semantics as runtime approval checks: write risk plus
  all/scoped path coverage, and exact tool-category grants.
- Keep pending approval metadata distinct from supplied approval scope.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|tool category approval continuation|explicit approval grants" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume Suggested Command Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require approval-required compact payloads to include
  `approval.resume.command` in root `suggestedCommands`.
- Allow readiness `doctorCommand` or other read-only suggestions to be present
  without displacing the approval continuation command.
- Prevent downstream agents from losing the active approval handoff when they
  route from suggested commands.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|planner handoff controls" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Suggested Command Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Preserve explicit approval grants in suggested `run` retry commands.
- Preserve explicit approval grants in suggested `agent --json` export/rerun
  commands.
- Keep suggested commands aligned with the approval grant audit data already
  present in compact output.

Known validation:

- `node --experimental-strip-types --test-name-pattern "explicit approval grants|preserves approval grants in rerun|review and export commands|compact JSON preserves explicit approval grants" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Continuation Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Preserve existing explicit approval grants in approval continuation commands.
- Combine supplied grants with the active pending approval signal without
  broadening approval beyond the granted and requested scopes.
- Keep `approval.resume`, compact/debug commands, and
  `handoffCheckpoint.continuation` aligned for resumed runs that still have a
  different approval blocker.

Known validation:

- `node --experimental-strip-types --test-name-pattern "explicit approval grants|preserves approval grants in continuation|approval continuation flags|tool category approval continuation" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume CLI Parse Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add CLI parser coverage for a write-approval resume command that includes
  query budget flags.
- Verify `--approve-write-risk`, `--approve-write-path`, `--max-turns`,
  `--max-repair-attempts`, `--context-packet-limit`,
  `--context-token-budget`, and `--json-full` survive entrypoint parsing.
- Keep command-generation contract backed by the same parser surface used by
  resumed operators and downstream agents.

Known validation:

- `node --experimental-strip-types --test-name-pattern "agent CLI args accept --max-turns|agent CLI args parse write approval resume scope" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume Query Budget Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate that approval continuation commands preserve compact
  `harness.queryConfig` flags.
- Apply the same query-budget check to per-signal
  `approval.resume.additionalCommands`.
- Prevent downstream agents from accepting approval-required handoffs that
  silently reset turn, repair, or retrieved-context budgets.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume Query Budget Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Preserve query-loop config flags in approval continuation commands:
  `--max-turns`, `--max-repair-attempts`, `--context-packet-limit`, and
  `--context-token-budget`.
- Route approval-required `suggestedCommands`, `approval.resume`, additional
  approval commands, and handoff continuation through the same command builder.
- Keep continuation commands scoped to approval; the query flags only preserve
  bounded harness behavior and do not grant additional permission.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Handoff Continuation JSON Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `handoffCheckpoint.continuation.compactCommand` and
  `handoffCheckpoint.continuation.debugCommand` in compact parser input.
- Enforce null JSON commands when no approval continuation is active and
  mode-specific strings when approval continuation is active.
- Cross-check handoff continuation commands against `approval.resume` so resumed
  agents can trust either recovery surface.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|tool category approval continuation|report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports" ./test/cli-smoke.test.mjs`
- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Handoff Continuation JSON Command Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Mirror the primary approval continuation command into
  `handoffCheckpoint.continuation`.
- Include compact and debug JSON variants beside the human-readable command so
  resumed agents can stay in machine-readable mode without reconstructing flags.
- Keep non-approval continuation checkpoints explicit with null command fields.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|agent CLI compact JSON includes work plan handoff" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Handoff Documentation Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document compact/debug continuation commands and per-signal additional
  approval commands.
- Document `approval.grants` as supplied-scope metadata, separate from pending
  approval requests.
- Extend package metadata tests so the installable skill keeps exposing the new
  approval handoff fields.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Additional Approval Command Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `approval.resume.additionalCommands` in compact parser input.
- Validate each additional command entry's signal shape, command strings, JSON
  mode variants, and signal-specific approval scope.
- Cross-check additional command count against included non-primary approval
  signals.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval signals beyond|report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports" ./test/cli-smoke.test.mjs`
- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Additional Approval Command Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.additionalCommands` for non-primary approval signals.
- Keep each additional command scoped to one signal instead of combining
  separate approval scopes by default.
- Include human, compact JSON, and debug JSON command variants for each
  additional signal.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval signals beyond|approval continuation flags|tool category approval continuation" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant CLI JSON Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add an entrypoint-level `agent --json` test for explicit approval grants.
- Verify CLI parsing, compact output generation, parser validation, result-card
  grant posture, and exit-code preservation through one path.
- Keep the scenario read-only by using a clarification-blocked task after
  approval flags are parsed.

Known validation:

- `node --experimental-strip-types --test-name-pattern "agent CLI compact JSON preserves explicit approval grants|agent CLI compact JSON includes work plan handoff" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval JSON Continuation Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate `approval.resume.compactCommand` and `approval.resume.debugCommand`
  as string-or-null fields.
- Require JSON continuation commands on approval-required runs and null values
  when approval continuation is not active.
- Cross-check JSON commands against the human continuation command plus the
  expected output-mode flag.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports" ./test/cli-smoke.test.mjs`
- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval JSON Continuation Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.compactCommand` for rerunning the approved continuation
  with compact `--json` output.
- Add `approval.resume.debugCommand` for rerunning the same continuation with
  `--json-full` debug output.
- Preserve the existing human `approval.resume.command` unchanged.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Result Card Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `docs/HANDOFF.md`

Purpose:

- Add an `Approval grants:` result-card line so human handoff can see explicit
  approval scope supplied to the current run.
- Document the split between pending approval requests in `approval.resume` and
  supplied approval scope in `approval.grants`.
- Keep approval grants audit-only and scoped to the current run.

Known validation:

- `node --experimental-strip-types --test-name-pattern "explicit approval grants|approval-required posture|package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `approval.grants` in parser input.
- Validate granted write risks, write paths, tool categories, write path scope,
  and explicit-approval posture.
- Align hand-authored compact fixtures with the new grant contract.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports" ./test/cli-smoke.test.mjs`
- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Grant Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add compact `approval.grants` output for explicit approval scope already
  supplied to the current run.
- Keep the data read-only and separate from `approval.resume`, which reports
  pending approval continuation scope.
- Cover empty default grants and scoped explicit grants in generated compact
  agent results.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|explicit approval grants" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Smoke Approval Fixture Alignment Slice

Files added or updated:

- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Align the smoke script's reusable identity-conflict compact agent-result
  fixture with the now-required `approval` contract.
- Keep smoke coverage exercising the same strict compact parser as
  identity-report tests.
- Preserve the fixture as a read-only validation-blocked report with no pending
  approval continuation.

Known validation:

- `npm run smoke`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Identity Report Approval Fixture Alignment Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Update hand-authored identity-report compact agent-result fixtures with the
  now-required `approval` section.
- Keep identity-report entrypoint and loader tests aligned with stricter compact
  approval contracts.
- Preserve the read-only identity-report behavior without loosening parser
  requirements.

Known validation:

- `node --experimental-strip-types --test-name-pattern "report CLI commands emit read-only JSON|identity-report loader renders compact conflict reports|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval And ToolTrace Docs Alignment Slice

Files added or updated:

- `README.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `approval.resume` primary signal and additional pending scope in the
  README and packaged skill reference.
- Document tool-trace tail-window boundary semantics in the README and skill
  reference.
- Extend package metadata tests so the shipped skill reference keeps mentioning
  these agent-facing contracts.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 ToolTrace Ordering And Category Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require included tool-trace entries to have ascending `turnIndex` values.
- Require `latestTurnIndex` to match the last included tail entry.
- Validate that aggregate permission category counts cover included entries and
  match exactly when no tool summaries are omitted.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|capped tool trace tail window" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 ToolTrace Required Field Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require tool-trace budget fields instead of accepting partial optional
  metadata.
- Require `harness.toolTrace.entries` and
  `harness.toolTrace.permissionCategoryCounts`.
- Add negative parser coverage for missing entries and category count objects.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|capped tool trace tail window" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Capped ToolTrace Generator Test Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add generated compact coverage for more tool summaries than the tool-trace
  window can include.
- Verify tail-window preservation, omitted count, first/last included turn
  indexes, and latest turn index.
- Parse the generated compact result so output and contract stay aligned.

Known validation:

- `node --experimental-strip-types --test-name-pattern "capped tool trace tail window|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Additional Scope Result Card Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `docs/HANDOFF.md`

Purpose:

- Add an `Approval resume:` result-card line with primary and additional
  approval scope posture.
- Cover an approval-required result with both a primary write signal and an
  additional tool-category signal.
- Update durable rules, Claude Code pattern notes, and the packaged infra skill
  to mention primary and additional approval scope metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval-required posture|package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Additional Scope Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate additional approval scope arrays for supported write risks, paths,
  and tool categories.
- Require additional scope arrays to cover included non-primary approval
  signals.
- Require exact additional scope arrays when no approval signals are omitted.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Additional Scope Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.additionalWriteRisks`,
  `approval.resume.additionalWritePaths`, and
  `approval.resume.additionalToolCategories`.
- Keep the primary continuation scope separate from remaining approval scope
  aggregates.
- Cover single-signal and multi-signal generated compact output.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Additional Signal Count Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `approval.resume.additionalSignalCount` in compact parser input.
- Validate that the count equals `signalCount` minus the primary signal when
  one is present.
- Add negative coverage for stale additional-signal accounting.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Additional Signal Count Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.additionalSignalCount` to compact agent results.
- Show how many approval signals remain beyond the primary continuation scope.
- Add generated compact coverage for a multi-signal approval handoff.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|approval signals beyond" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Primary Signal Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `approval.resume.primarySignal` to be null when no approval signals
  are present.
- Require approval continuations with signals to include a primary signal.
- Cross-check the primary signal against the first included approval signal.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Primary Signal Shape Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate `approval.resume.primarySignal` as either `null` or a compact
  approval signal.
- Reuse the same approval signal shape rules for `approval.signals` and
  `approval.resume.primarySignal`.
- Update the parser fixture and add negative coverage for malformed primary
  signal metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags|tool category approval continuation" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume Primary Signal Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `approval.resume.primarySignal` to generated compact agent results.
- Make the approval signal used for the continuation command explicit instead
  of requiring downstream agents to infer it from array order.
- Cover both write approval and tool-category approval generated output.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Section Required Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `approval` as a durable agent-result section.
- Require `approval.signals` and `approval.resume` so downstream agents do not
  route on a partial approval handoff.
- Add negative parser coverage for missing approval, malformed signals, and
  malformed resume metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 ToolTrace Window Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `harness.toolTrace` when `harness` is present.
- Validate `preservedWindow="tail"`, `lastIncludedTurnIndex`, empty-entry
  boundary nulls, and no-omission `latestTurnIndex` consistency.
- Document recent-tool tail windows in project rules, architecture notes, and
  the infra skill handoff checklist.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|maximum turn count|package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 ToolTrace Last Included Turn Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.toolTrace.lastIncludedTurnIndex` to compact agent results.
- Distinguish the last retained tool entry from the overall latest tool turn.
- Cover generated output and the parser fixture before enforcing the field.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 ToolTrace Preserved Window Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.toolTrace.preservedWindow: "tail"` to compact agent results.
- Make recent-tool trace truncation explicit for downstream handoff consumers.
- Update compact output and contract fixture coverage before parser tightening.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 WorkPlan Skipped Count Result Card Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `docs/HANDOFF.md`

Purpose:

- Surface `skippedStepCount` in human-readable result cards.
- Update rules, Claude Code architecture notes, and the infra skill so handoff
  consumers treat skipped work-plan steps as routing metadata.
- Keep compact JSON, result-card prose, and downstream skill guidance aligned.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|agent CLI compact JSON includes work plan|package metadata exposes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 WorkPlan Skipped Count Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `harness.workPlan.skippedStepCount` in compact result parsing.
- Validate skipped count consistency when the work plan window is complete.
- Add a negative parser test to prevent stale or forged skipped accounting.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|compact work plan maps terminal outcomes|maximum turn count" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 WorkPlan Skipped Count Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.workPlan.skippedStepCount` to compact agent results.
- Count skipped steps from the full derived work plan, not just the displayed
  included window.
- Cover both blocked and completed compact result paths so skipped accounting is
  visible before parser tightening.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|compact work plan maps terminal outcomes" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Tool Category Approval Resume Command Scope Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate that a tool-category approval continuation command keeps
  `--approve-tool-category` tied to the active approval signal.
- Add focused smoke coverage for generated tool-category approval-required
  compact results.
- Keep write approval and tool approval resume contracts symmetric so future
  agents can safely resume blocked runs.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|tool category approval continuation|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Write Approval Resume Command Scope Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate that an approval continuation command for a write approval signal
  includes `--approve-write-risk`.
- Validate that the same command includes `--approve-write-path`.
- Reject continuation commands that drop the active write path scope while still
  advertising approval resume metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "approval continuation flags|compact agent result contract" ./test/cli-smoke.test.mjs`
- `npm run lint`
- `git diff --check`

## 2026-05-05 Approval Resume Exact Signal Set Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- When no approval signals are omitted, require
  `approval.resume.writeRisks` to match included write approval signals.
- Apply the same exact-set rule to `approval.resume.writePaths`.
- Apply the same exact-set rule to `approval.resume.toolCategories`.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Approval Resume Included Signal Coverage Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate that `approval.resume.writeRisks` covers included write approval
  signals.
- Validate that `approval.resume.writePaths` covers included write approval
  signals.
- Validate that `approval.resume.toolCategories` covers included tool-category
  approval signals.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Approval Resume Outcome Coherence Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `approval.resume.continuationRequired` to match root
  `outcome === "approval-required"`.
- Require approval continuations to align with
  `harness.plannerHandoff.activeBlocker.kind === "approval"` and
  `nextControlAction === "request-approval"`.
- Prevent compact handoff payloads from advertising an approval continuation on
  non-approval terminal outcomes.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract|approval continuation flags" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Generated Compact Parse Coverage Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Parse real `agent --json` CLI output with `parseCompactAgentRunResult`.
- Parse generated compact payloads for max-turn, skipped-execution, capped-turn
  trace, and approval-resume scenarios.
- Allow terminal lifecycle events to preserve an execution reason while still
  requiring the terminal event to be last and match the root outcome.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|agent CLI compact JSON|skipped turn|turn trace budget metadata|approval continuation flags" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Lifecycle Event Count Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check lifecycle `query-started`, `decision`, and `terminal` aggregate
  counts against root run metadata.
- Require exactly one query start, exactly one terminal lifecycle event, and one
  decision event per used turn.
- Validate that an included terminal lifecycle event is last and matches the
  root outcome.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Required Lifecycle Events Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `harness.lifecycleEvents` whenever the harness section is
  present.
- Require the lifecycle `events` sample array and `eventCounts` aggregate map.
- Keep query lifecycle recovery data available to continuation agents without
  asking for raw runtime snapshots.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Turn Trace Budget Count Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require legacy `harness.turnTraceLimit` and
  `harness.turnTraceOmittedCount` when a harness section is present.
- Cross-check `harness.turnTraceBudget.totalCount` against root
  `turnsUsed`.
- Cross-check the same turn trace total against
  `harness.loopBudget.turnsUsed`.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Required Turn Trace Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `harness.turnTrace` whenever the harness section is present.
- Require compact `harness.turnTraceBudget` whenever the harness section is
  present.
- Keep the Claude Code-inspired turn-transition window from becoming optional
  in agent-to-agent handoff payloads.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Retrieved Context Count Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.stateSummary.retrievedContextCount` against
  `knowledgeContext.totalPacketCount`.
- Align the runtime-state boundary with the compact retrieved-context budget
  and packet summary surface.
- Update the hand-built compact fixture so its state summary reflects both
  included and omitted retrieved context packets.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Approval Signal Count Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.stateSummary.approvalSignalCount` against
  `approval.resume.signalCount`.
- Keep approval-gate runtime facts aligned with the compact approval
  continuation surface.
- Prevent stale approval counts from making a blocked run look safer or more
  complete than the resume metadata indicates.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Validation Issue Count Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.stateSummary.validationIssueCount` against
  `validation.issueSummary.totalCount`.
- Keep validation blocker totals aligned between the compact runtime-state
  boundary and the validation issue aggregation surface.
- Reject handoff payloads that would route a continuation agent with mismatched
  blocker counts.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Validation Result Count Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.stateSummary.validationResultCount` against compact
  `validation.commands` included plus omitted counts.
- Preserve the distinction between sampled validation command entries and the
  total validation-result count captured by runtime state.
- Reject compact handoff payloads that would let a continuation agent undercount
  executed validation commands.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Tool Count Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.stateSummary.toolSummaryCount` against
  `harness.toolTrace.totalCount`.
- Cross-check the same state summary count against
  `harness.toolPermissionSummary.totalToolCount`.
- Prevent continuation agents from accepting mismatched compact tool activity
  and permission-provenance counts.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 State Summary Required Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `harness.stateSummary` whenever the compact harness section is
  present.
- Treat every state summary count as required contract data rather than optional
  best-effort metadata.
- Preserve the Claude Code compaction boundary by rejecting harness payloads
  that omit the runtime count surface needed for downstream handoff.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Compact Fixture Targeting Budget Slice

Files added or updated:

- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.budgets.targeting` to reusable compact result fixtures.
- Keep saved fixture payloads aligned with the compact parser after targeting
  budget validation.
- Preserve smoke and E2E report fixture compatibility without adding a harness
  section to this minimal identity-conflict fixture.

Known validation:

- `npm run smoke`: passed.
- `npm run lint`: passed.

## 2026-05-05 Approval Readiness Command Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `docs/HANDOFF.md`

Purpose:

- Include the read-only readiness `doctorCommand` in approval-required
  `suggestedCommands` when readiness is warn or fail.
- Preserve the scoped approval continuation command in suggested commands and
  keep `approval.resume.command` focused on approval continuation only.
- Clarify skill reference guidance so doctor output never replaces approval
  metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps|package metadata" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Completed Work Plan Consistency Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Ensure completed compact runs do not keep an active in-progress work-plan
  step.
- Mark unneeded completed-run edit or validation steps as `skipped` and leave
  `currentStepIndex` as `null`.
- Reject completed compact payloads whose work plan still contains pending,
  in-progress, blocked, or current-step routing state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps|compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Terminal Outcome Compact Parse Coverage Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Parse generated compact results for approval-required, validation-blocked,
  repair-budget-exhausted, completed, and no-safe-action outcomes.
- Catch generator/parser drift across terminal outcomes before downstream
  report commands or continuation agents consume saved payloads.
- Keep this as a focused test guard with no production behavior changes.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Planner Handoff Blocker Metadata Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Keep `harness.plannerHandoff.activeBlocker.validationIssueKind` populated
  only for active validation blockers.
- Keep approval signal metadata populated only for active approval blockers.
- Preserve repair-budget issue detail through `harness.workPlan` validation
  step metadata and `validation.issues`, while allowing generated compact
  repair-budget payloads to pass the parser.
- Normalize compact validation issue samples so in-memory builder output uses
  `guidance: null` and `metadata: {}` instead of parser-hostile `undefined`
  values.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Targeting Documentation Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `harness.targeting` as the derived compact target-selection surface.
- Instruct downstream agents to use selected target, candidate budget, score
  posture, ambiguity flags, and recommended targeting action before requesting
  raw preflight data.
- Keep the packaged skill and durable Claude Code pattern notes aligned with
  the new compact contract section.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Result Card Targeting Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Mirror compact targeting posture in result cards for human operators.
- Show selected target, included/total candidate count, ambiguity kinds, and
  next targeting action without exposing raw preflight state.
- Keep human-readable output aligned with the machine-readable
  `harness.targeting` section.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Compact Targeting Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check compact targeting with root `primaryTarget` and requested-domain
  routing.
- Reject targeting drift between candidate kind and domain, selected candidate
  and selected target, score gap and included candidate scores, ambiguity flags
  and ambiguity kinds, and recommended action and ambiguity posture.
- Keep continuation agents from re-deriving target ambiguity from raw preflight
  state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Compact Targeting Contract Shape Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.targeting` when a harness section is present.
- Enforce targeting schema version, source, read-only posture, candidate
  budgets, selected target shape, candidate ranks, domain/kind enums,
  ambiguity enums, recommended action enums, and string-array samples.
- Cross-check `handoffCheckpoint.budgets.targeting` against the compact
  targeting sample budget.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Targeting Handoff Budget Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Mirror compact `harness.targeting` inclusion and omission counts in
  `handoffCheckpoint.budgets.targeting`.
- Keep targeting aligned with the existing budgeted handoff pattern used by
  work-plan, turn-trace, lifecycle, tool, validation, approval, and knowledge
  sections.
- Prepare the targeting surface for parser-enforced budget consistency checks.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Compact Targeting Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.targeting` to compact `infra-agent.agent-result` output as a
  derived, read-only target-selection surface.
- Preserve selected target, candidate count, score gap, ambiguity flags,
  recommended targeting action, and a bounded candidate sample without exposing
  raw preflight state.
- Keep target handoff aligned with the existing compact harness pattern before
  adding parser-enforced contract checks.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.

## 2026-05-05 Compact Fixture Work Plan Budget Slice

Files added or updated:

- `scripts/compact-fixtures.mjs`
- `docs/HANDOFF.md`

Purpose:

- Update compact agent-result fixtures used by smoke and E2E scripts with the
  current root contract metadata.
- Add `handoffCheckpoint.budgets.workPlan` to fixture handoff data so report
  loaders pass the compact parser after work-plan budget validation.
- Keep reusable script fixtures aligned with the same contract enforced in
  unit tests.

Known validation:

- `npm run smoke`: passed.
- `git diff --check`: passed.

## 2026-05-05 Work Plan Synthetic Runtime Robustness Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Make work-plan collection tolerate synthetic test runtimes that omit optional
  `toolSummaries`.
- Keep the CLI work-plan JSON smoke stable under Node's test runner by parsing
  the JSON payload from captured stdout even when reporter output is present.
- Restore full-suite compatibility for existing result-card and compact-output
  tests.

Known validation:

- `node --experimental-strip-types --test-name-pattern "agent CLI compact JSON includes work plan|skipped turn execution|summarizeResultCard includes" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Work Plan No-Safe-Action Status Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Make `harness.workPlan.status` prefer terminal outcome and active blocker
  posture before falling back to no-progress `not-started`.
- Cover a no-safe-action run with no tool progress so compact output remains
  consistent with parser-enforced blocker semantics.
- Keep `not-started` reserved for runs with no progress and no active blocker.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Agent CLI Work Plan JSON Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cover the real `agent --json` CLI path for compact `harness.workPlan`.
- Verify argument parsing, bounded query loop execution, compact serialization,
  checkpoint work-plan budget mirroring, result-card work-plan summary, and
  no-safe-action exit code behavior together.
- Keep work-plan coverage connected to the user-facing command contract, not
  only internal output builders.

Known validation:

- `node --experimental-strip-types --test-name-pattern "agent CLI compact JSON includes work plan" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Work Plan Documentation Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `harness.workPlan` as a derived compact progress surface for
  continuation agents.
- Clarify that work-plan data is read-only routing metadata, not a writable
  todo store or execution driver.
- Update the packaged infra-configuration skill and reference checklist so
  downstream agents read work-plan posture before asking for raw logs.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Result Card Work Plan Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Mirror compact `harness.workPlan` posture in result cards for human
  operators.
- Show the current step, completed-step count, blocked-step count, and next
  control action without exposing raw runtime state.
- Keep terminal output aligned with the machine-readable compact handoff.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Handoff Work Plan Budget Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.budgets.workPlan` so continuation agents can see
  work-plan inclusion and omission counts from the compact checkpoint.
- Cross-check the checkpoint work-plan budget against `harness.workPlan`.
- Preserve the existing checkpoint pattern where budgeted compact sections
  expose included and omitted counts before downstream agents inspect details.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count|compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Compact Work Plan Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `harness.workPlan.blockerKind` and `nextControlAction` against
  `harness.plannerHandoff`.
- Reject work-plan status drift from terminal outcome and active blocker state.
- Validate included step status counts, current-step routing, and approval or
  validation blocker metadata placement.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Compact Work Plan Contract Shape Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate `harness.workPlan` when compact agent-result payloads include a
  harness section.
- Enforce the work-plan schema version, source, compact/read-only posture,
  supported status and step enums, count arithmetic, and ascending unique step
  indexes.
- Keep this slice focused on local shape validation; cross-section routing
  consistency is handled separately.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Compact Work Plan Blocker Coverage Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cover `harness.workPlan` mappings for approval-required,
  validation-blocked, repair-budget-exhausted, and completed outcomes.
- Assert that active approval signals land on the bounded-edit step and
  validation issues land on the validation step.
- Keep the derived work-plan surface tied to `plannerHandoff` blocker and
  next-control semantics.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact work plan maps" ./test/cli-smoke.test.mjs`: passed.
- `git diff --check`: passed.

## 2026-05-05 Compact Work Plan Output Shape Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.workPlan` to compact `infra-agent.agent-result` output as a
  derived, read-only progress surface.
- Summarize readiness, targeting, inspection, bounded edit, validation, and
  handoff steps without exposing raw runtime state, prompts, tool output, or
  file content.
- Keep the work plan aligned with existing `plannerHandoff` next-control
  routing while avoiding a new writable todo system.

Known validation:

- `node --experimental-strip-types --test-name-pattern "maximum turn count" ./test/cli-smoke.test.mjs`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-05 Doctor Package Surface Guard Slice

Files added or updated:

- `src/cli/doctor.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Keep `doctor [workspace] --json` as the read-only package and
  agent-facing surface guard.
- Fail the `agent-surface` doctor check when `package.json.files` accidentally
  includes non-surface paths such as fixtures, tests, scripts, or handoff
  history.
- Preserve the canonical installed surface: CLI runtime, `AGENTS.md`, the
  infra-configuration skill, README, and durable docs.

Known validation:

- `node --experimental-strip-types --test-name-pattern "doctor|package metadata" ./test/cli-smoke.test.mjs`: passed.
- `npm run test:unit`: passed.
- `node --experimental-strip-types src/cli/main.ts doctor fixtures/sample-workspace --json`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## Current Branch State

- Branch: `agent-1`
- Recent completed commits:
  - `410b0d8` Add root agent development standards
  - `14f9ff4` Add compact agent readiness summary
  - `faf0506` Report LLM planner readiness in doctor
  - `73326cf` Add CLI doctor readiness report
  - `0e1bb25` Add installable CLI version check
  - `bd69518` Narrow installable package surface
  - `57cff10` Add agent outcome exit codes
  - `1c103c0` Gate tool categories with approval policy
  - `5d44d1e` Summarize tool permission categories
  - `b59add1` Expose context budget query config
  - `5d112ca` Budget retrieved context handoff
  - `0a56d76` Add compact harness tool trace
  - `33f0679` Add Claude Code inspired harness trace
  - `e3b4b8a` Test LLM planner mode config
  - `40cc136` Test LLM planner transport contract
  - `05cc8d6` Feed identity conflicts into planner prompts
  - `f67f470` Categorize identity conflict reports
  - `d720fc7` Add smoke and e2e verification layers
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

## 2026-05-04 Compact Selected Plan Command Coherence Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten `parseCompactAgentRunResult` validation for compact
  `validation.selectedPlan` and `validation.commands.entries` coherence when
  command entries are complete (`validation.commands.omittedCount=0`).
- Reject target-validation command entries that do not belong to a selected
  plan command and reject commands owned by multiple selected plan entries.
- Require each selected plan entry's `executedCommandCount` and
  `failedCommandCount` to match complete target-validation command entries,
  while excluding `yaml-guard` entries from selected-plan execution counts.
- Preserve existing `validation.targetCommandCount` and
  `validation.yamlGuardCount` complete-entry checks.

Known validation:

- `source /Users/ybw/.nvm/nvm.sh && nvm use --silent default && node --experimental-strip-types --test-name-pattern "selectedPlan|validation.commands|compact agent result contract" test/cli-smoke.test.mjs`: passed with 3 tests.
- `git diff --check`: passed.

Residual risk:

- Full repository verification was not run for this subagent slice; coverage is
  limited to the requested focused compact contract smoke pattern.

## 2026-05-04 Compact Safety Blocker Metadata Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten `parseCompactAgentRunResult` validation for compact
  `validation.safetyBlockers.entries` metadata coherence.
- Require `unsafe-validation-command` blockers to include non-empty
  `unsafeCommand`, `unsafeRuleId`, and `unsafeReason`, with YAML metadata
  fields set to `null`.
- Require `yaml-syntax-failure` blockers to include non-empty `yamlPath` and
  `yamlParser`, with unsafe-command metadata fields set to `null`.
- Preserve common safety blocker requirements, including string-or-null
  `guidance` and `mutationPrevented=true`.

Known validation:

- `source /Users/ybw/.nvm/nvm.sh && nvm use --silent default && node --experimental-strip-types --test-name-pattern "validation.safetyBlockers|compact agent result contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

Residual risk:

- Full repository verification was not run for this subagent slice; coverage is
  limited to the requested focused compact contract smoke pattern.

## 2026-05-04 Compact Agent Root Required Fields Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten `parseCompactAgentRunResult` root validation so compact
  `modelName`, `profileId`, `turnsUsed`, `requestedDomains`, `changedFiles`,
  `resultCard`, `nextSteps`, and `suggestedCommands` are required.
- Preserve existing root shape checks while requiring non-negative integer
  turns and supported requested domain labels.
- Add focused compact contract coverage that deletes each required root field
  from the valid fixture and expects a root-field validation error.

Known validation:

- `source /Users/ybw/.nvm/nvm.sh && nvm use --silent default && node --experimental-strip-types --test-name-pattern "compact agent result contract|root" test/cli-smoke.test.mjs`: passed with 276 tests on Node v24.15.0.
- `git diff --check`: passed.

## 2026-05-04 Compact Handoff Durable Sections Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten `parseCompactAgentRunResult` validation for
  `handoffCheckpoint.durableSections`.
- Require compact handoff recovery section names to include `root`, `harness`,
  `validation`, `approval`, `knowledge`, `readiness`, and `result-card`.
- Preserve supported-section validation while rejecting duplicate durable
  section entries and missing required recovery sections.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "handoffCheckpoint.durableSections|compact agent result contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Compact Validation Commands Metadata Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Tighten `parseCompactAgentRunResult` validation for compact
  `validation.commands` metadata.
- Require command entries to carry string `unsafeRuleId` and `unsafeReason`
  when `unsafeBlocked=true`, and require both fields to be `null` when
  `unsafeBlocked=false`.
- Require `validation.targetCommandCount` and `validation.yamlGuardCount` to
  match included `validation.commands.entries` by command kind when
  `validation.commands.omittedCount=0`, while preserving non-negative shape
  checks without exact matching when command entries are omitted.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "validation.commands|unsafeRuleId" test/cli-smoke.test.mjs`: passed with 3 tests.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Impact Report Contract Consistency Slice

Files added or updated:

- `src/cli/infra-graph-report.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Harden `parseInfraGraphImpactReport` so secondary graph impact reports reject
  malformed handoff data before downstream agents route on it.
- Validate supported root impact posture enums, non-negative integer count
  fields, source provenance labels/count arithmetic/unique entries/aggregate
  source flags, review target budget consistency, and deep review target field
  shapes.
- Keep impact reports read-only by requiring root and per-target
  `mutationAllowed=false`.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "impact report contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Impact Report Budget Slice

Files added or updated:

- `src/cli/infra-graph-report.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `reviewTargetBudget` to `infra-agent.infra-graph-impact-report` JSON.
- Mirror `summary.impact.reviewTargetBudget` when present and derive a compact
  legacy budget from included and omitted review target counts when absent.
- Validate impact-report budget fields as non-negative integers and require
  included/omitted arithmetic plus included-count consistency with
  `reviewTargetCount` and `reviewTargets.length`.
- Print the compact review-target budget in the human text report.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "impact report" test/cli-smoke.test.mjs`: passed with 2 tests.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Review Target Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Deeply validate `summary.impact.reviewTargets` when present in
  `infra-agent.infra-graph` inputs.
- Require each target to carry supported review-target kind, source,
  confidence, recommended action, and risk category values; string edge/from/to
  fields; string-only review steps; optional string-only reason/identity fields;
  and `mutationAllowed=false`.
- Require priorities to be non-negative integers that are contiguous from 1 in
  array order.
- Require each target `edgeId` to reference an existing graph edge with a
  review-target kind and matching kind/from/to/source/confidence fields.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "review target|infra graph contract" test/cli-smoke.test.mjs`: passed with 3 tests.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Impact Summary Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `summary.impact` to be an object when present and validate supported
  risk posture enums for `riskLevel`, `primaryConcern`, and
  `recommendedAction`.
- Require `summary.impact.reviewSteps` to be an array of strings.
- Require `summary.impact.reviewTargetBudget` with non-negative integer
  `maxTargets`, `totalTargets`, `includedTargets`, and `omittedTargets`, plus
  arithmetic consistency with omitted and included review target counts.
- Keep deeper per-review-target field validation deferred to the next slice,
  while preserving the existing `mutationAllowed=false` target check.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "infra graph contract|review target" test/cli-smoke.test.mjs`: passed with 3 tests.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Source Provenance Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate optional `summary.sourceProvenance` in `infra-agent.infra-graph`
  inputs when present.
- Require provenance source entries to use supported source labels, non-negative
  integer node/edge/total counts, and `totalCount = nodeCount + edgeCount`.
- Require provenance source counts and boolean source-presence flags to match
  the actual node and edge `source` totals.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "sourceProvenance|infra graph contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Kind Count Map Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `summary.nodesByKind` and `summary.edgesByKind` in
  `infra-agent.infra-graph` inputs to be objects.
- Reject unsupported graph kind labels and values that are not non-negative
  integers in both summary maps.
- Require summary kind counts to match actual node and edge kind totals,
  including missing present-kind counts and nonzero absent-kind counts.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "infra graph contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Entry Shape Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require every `infra-agent.infra-graph` node entry to be an object with string
  `id`/`label`, a supported node kind, `path` as string or null, supported
  domain, supported confidence, and supported source.
- Require every edge entry to be an object with string `id`/`from`/`to`, a
  supported edge kind, supported confidence, supported source, and string
  `label` when present.
- Keep metadata validation deferred for a later graph contract slice.

Known validation:

- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "infra graph contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Count Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require `infra-agent.infra-graph` inputs to include a string `workspaceRoot`.
- Reject graph handoff JSON when `summary.nodeCount` does not match
  `nodes.length` or `summary.edgeCount` does not match `edges.length`.
- Cover the new rejection cases in the existing infra graph contract smoke
  test.

Known validation:

- `node --experimental-strip-types --test-name-pattern "infra graph contract" test/cli-smoke.test.mjs`: blocked under the default shell Node `v18.18.2` because that Node version does not recognize `--experimental-strip-types`.
- `/Users/ybw/.nvm/versions/node/v22.15.0/bin/node --experimental-strip-types --test-name-pattern "infra graph contract" test/cli-smoke.test.mjs`: passed with 1 test.
- `git diff --check`: passed.

## 2026-05-04 Compact Handoff Checkpoint Base Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a root `handoffCheckpoint` object to compact `infra-agent.agent-result`
  output.
- Record that the primary downstream artifact is compact `agent --json`, full
  runtime output is only `agent --json-full` debug data, and the checkpoint does
  not allow mutation.
- Cover the new checkpoint shape in compact output unit coverage.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Checkpoint Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact result inputs to include a valid `handoffCheckpoint` object.
- Validate checkpoint schema version, supported source/artifact identifiers,
  compact posture, and `mutationAllowed=false`.
- Update read-only report fixtures so `identity-report` only accepts current
  compact agent-result handoff payloads.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Durable Sections Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.durableSections` to name compact sections that may be
  used for post-compaction recovery.
- Include root metadata, harness, validation, approval, knowledge, readiness,
  and result-card sections as the current durable handoff surface.
- Reject missing, empty, or unsupported durable section names in compact result
  inputs.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Raw-State Exclusions Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.exclusions` so downstream agents know the compact
  checkpoint excludes raw runtime state, preflight state, tool output, prompts,
  and knowledge excerpts.
- Require every raw-state inclusion flag to remain `false` in compact result
  inputs.
- Keep existing `runtime` and `preflight` omissions explicit for post-compaction
  routing.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

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

## 2026-04-30 Identity Conflict Risk Category Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `riskCategory` to compact `validation.identityConflicts` and
  `infra-agent.identity-conflict-report` incidents so downstream agents can
  route exclusive-identity blockers without parsing prose.
- Group known families into review queues such as
  `create-before-delete-ordering`, `dns-or-domain-ownership`,
  `physical-name-ownership`, `kubernetes-object-ownership`, and
  `exclusive-identity-review`.
- Keep the category review-only. It explains the kind of risk but does not
  authorize moved blocks, aliases, imports, state moves, deletions, stack
  mutations, or sequencing changes.
- Preserve compatibility for older compact JSON files by deriving
  `riskCategory` from `conflictFamily` when the field is absent.

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

## 2026-04-30 LLM Planner Identity Context Slice

Files added or updated:

- `src/agent/identity-conflicts.ts`
- `src/cli/output.ts`
- `src/model/prompt.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Move runtime exclusive-identity summarization into a shared agent module so
  compact output, incident reports, and planner prompts use the same risk
  categories, identity fields, locators, and review steps.
- Add `runtimeIdentityConflicts` to LLM planner prompts as compact blocker
  context. The planner can now see `riskCategory`, resource locator fields,
  parsed provider identity, suggested review action, and first review steps
  without treating long provider stderr as primary context.
- Keep the prompt contract review-only. Identity conflicts should drive
  `validation-blocked` stops unless a separately approved bounded edit plan
  already exists; they must not authorize state moves, imports, aliases, DNS
  changes, Kubernetes ownership changes, deletions, or stack mutation.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 236/236 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 LLM Planner Transport Contract Slice

Files added or updated:

- `src/model/LLMModelClient.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`

Purpose:

- Add an injectable fetch transport to `LLMModelClient` so planner request and
  response contracts can be tested without live network or provider access.
- Add a no-network regression test that verifies the LLM planner request uses
  the configured base URL, model, bearer token, JSON response format, system
  prompt, and compact user prompt with `runtimeIdentityConflicts`.
- Verify that the mocked LLM response still passes through the bounded decision
  parser and returns a supported `validation-blocked` stop action.
- Persist the rule that LLM planner tests must use injected transports or
  mocked fetchers, not live LLM providers.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 237/237 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 LLM Planner Mode Config Slice

Files added or updated:

- `src/model/config.ts`
- `src/model/create-model-client.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`

Purpose:

- Make LLM config resolution accept an explicit environment map while preserving
  `process.env` as the default runtime source.
- Make planner client selection accept the same explicit environment map, so
  `auto`, `llm`, and `rule-based` mode behavior can be tested without mutating
  global process state.
- Add regression tests for `INFRA_AGENT_*` precedence over generic `OPENAI_*`,
  default base URL/model selection, `auto` fallback to rule-based mode, explicit
  LLM selection, and the missing-key error for `--planner llm`.
- Persist the rule that LLM environment selection tests should use explicit env
  maps instead of process-wide mutation.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 239/239 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Claude Code Harness Pattern Slice

Files added or updated:

- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `src/agent/run-single-step.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Study local `learning-claude-code` harness design and persist reusable
  patterns without copying implementation.
- Add compact `harness.turnTrace` to `infra-agent.agent-result` so downstream
  agents can understand per-turn action flow without loading full turns or
  runtime snapshots.
- Carry max-turn config into `AgentRunState` and compact handoff.
- Keep the trace bounded and low-noise: action kind/family, confidence,
  terminal flag, execution status, tool count, changed-file count, validation
  issue count, approval signal count, stop signal, and clarification signal.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 239/239 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Compact Harness Tool Trace Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Extend compact `infra-agent.agent-result` harness output with
  `harness.toolTrace`.
- Keep tool handoff budgeted to the latest deterministic tool summaries instead
  of exposing raw tool payloads or complete runtime observations.
- Include `maxEntries`, `omittedCount`, and compact per-tool fields:
  turn index, action kind, tool name, safety, and summary.
- Document that downstream agents should inspect `harness.toolTrace` before
  asking for raw logs.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 239/239 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Retrieved Context Budget Slice

Files added or updated:

- `src/knowledge/context-budget.ts`
- `src/model/prompt.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a shared context budget helper for retrieved official docs, schemas, and
  examples before planner handoff.
- Clip excerpts, cap included packets, cap estimated prompt tokens, and report
  omitted packets by packet-limit or token-budget reason.
- Add `retrievedContextBudget` to planner user prompts so LLM decisions can see
  context omissions without receiving raw cached documents.
- Add compact `knowledgeContext` metadata to `infra-agent.agent-result` for
  downstream agents.
- Persist the rule that planner prompts must not inject full cached docs or
  unbounded excerpts.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 240/240 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Explicit Context Budget Config Slice

Files added or updated:

- `src/query-config.ts`
- `src/types/agent.ts`
- `src/query.ts`
- `src/agent/run-single-step.ts`
- `src/model/prompt.ts`
- `src/cli/output.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Promote retrieved context packet/token budgets into explicit
  `QueryLoopConfig` alongside `maxTurns`.
- Store the resolved retrieved context budget on runtime state so prompt
  compaction and compact JSON handoff use the same harness config.
- Add CLI overrides `--context-packet-limit <n>` and
  `--context-token-budget <n>` for LLM planner experiments and downstream
  agent control.
- Keep defaults unchanged unless a caller explicitly overrides the budget.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 240/240 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Tool Permission Summary Slice

Files added or updated:

- `src/agent/tool-permissions.ts`
- `src/types/agent.ts`
- `src/query.ts`
- `src/model/prompt.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add explicit permission categories for tool results: workspace read/write,
  local validation, native CLI read/validation/write, native stack config
  write, and approval-required.
- Attach `permission` metadata to deterministic `ToolExecutionSummary` records.
- Add `toolPermissionSummary` to planner prompts so LLM decisions can see
  workspace mutation, native command, and stack/state mutation-risk counts.
- Extend compact `harness.toolTrace` entries with permission fields and add
  `harness.toolPermissionSummary` for downstream agents.
- Keep this as a structured observation layer; it does not yet change execution
  gates or approval policy behavior.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 240/240 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 Tool Category Approval Gate Slice

Files added or updated:

- `src/types/repository.ts`
- `src/types/agent.ts`
- `src/domain/workspace-policy.ts`
- `src/agent/collect-approval-signals.ts`
- `src/agent/build-run-preflight.ts`
- `src/agent/rule-based-planner.ts`
- `src/model/prompt.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add workspace approval policy support for required tool permission
  categories, for example `native-stack-config-write`.
- Add run approval scope support for `approvedToolCategories`.
- Add CLI support for `--approve-tool-category <category>`.
- Emit `tool-category-approval-required` signals when an edit plan includes a
  configured approval-required native operation category.
- Keep defaults compatible: no tool category requires approval unless workspace
  config requests it.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 242/242 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-04-30 CLI Outcome Exit Codes Slice

Files added or updated:

- `src/cli/exit-codes.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `scripts/smoke.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a stable CLI exit-code contract for downstream agents and shell
  automation.
- Keep `0` for successful commands and `1` for fatal CLI/runtime failures.
- Return agent-specific nonzero codes for validation blockers, approval pauses,
  clarification pauses, no-safe-action exits, and repair-budget exhaustion.
- Return a preflight-blocked code for `run` when blockers are detected.
- Keep structured JSON output available even when the process exits with a
  business-state nonzero code.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 243/243 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.
- Manual CLI check: `node --experimental-strip-types src/cli/main.ts run "add ingress to payments-api dev chart" --workspace fixtures/restricted-workspace --json` returned exit code `7` and still emitted JSON.

## 2026-04-30 Installable Package Surface Slice

Files added or updated:

- `package.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `test/cli-smoke.test.mjs`

Purpose:

- Update the package description to cover Terraform, Pulumi, and Helm.
- Add a narrow `package.json.files` allowlist for installable CLI packaging.
- Include `bin/`, `src/`, `skills/`, README, and selected durable docs.
- Exclude fixtures, tests, smoke scripts, and handoff history from packed
  installs.
- Document local `npm link` usage and package dry-run verification.
- Add unit coverage for package metadata and file-surface constraints.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 244/244 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed; packed surface includes 100 entries and excludes fixtures, tests, smoke scripts, and handoff history.
- `git diff --check`: passed.

## 2026-04-30 Installable CLI Version Slice

Files added or updated:

- `bin/infra-agent.js`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Purpose:

- Add `infra-agent --version`, `infra-agent -v`, and `infra-agent version`
  parsing as a cheap installation self-check.
- Read the CLI version from package metadata relative to the installed source,
  not from the caller workspace.
- Fix the installed bin wrapper to preserve the caller working directory so
  default workspace resolution targets the user's repo instead of package root.
- Cover package version reading and bin cwd preservation in unit tests.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 245/245 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed.
- Manual CLI check: `node --experimental-strip-types src/cli/main.ts --version` returned `infra-agent 0.1.0`.
- Manual installed-bin cwd check: `node /home/heathen/github/infra-agent/bin/infra-agent.js --version` from `/tmp` returned `infra-agent 0.1.0`.

## 2026-04-30 Doctor Readiness Command Slice

Files added or updated:

- `src/cli/doctor.ts`
- `src/cli/package-metadata.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `src/validators/preflight.ts`
- `scripts/smoke.mjs`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `infra-agent doctor [workspace] [--json]` as a read-only readiness report
  for package metadata, Node engine, LLM planner configuration, workspace
  inspection, validation plan, and Helm/Pulumi/Terraform executable
  availability.
- Return a compact structured payload with kind `infra-agent.doctor` and
  `schemaVersion=1` for downstream agents.
- Treat missing external IaC CLIs as warnings, not fatal errors, because the
  workspace may not need every domain.
- Treat missing LLM planner configuration as a warning because auto mode can use
  the rule-based fallback. Do not expose API keys in doctor output.
- Move package metadata reading into a small shared CLI module so `--version`
  and `doctor` use the same source.
- Reuse validator availability checks from validation preflight.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed.
- Manual CLI check: `node --experimental-strip-types src/cli/main.ts doctor fixtures/sample-workspace --json` returned `infra-agent.doctor` schema version `1` with the planner fallback warning and no failed checks.

## 2026-04-30 Compact Agent Readiness Slice

Files added or updated:

- `src/agent/select-validation-commands.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add a compact `readiness` block to `infra-agent.agent-result` JSON so
  downstream agents can see planner mode, workspace blocker status, selected
  validation plan status, and task-relevant validator availability without
  running a separate command or loading raw preflight state.
- Keep the readiness block targeted by reusing the same selected validation
  plan logic as `selectValidationCommands`. For a Helm-only task in a mixed
  workspace, readiness includes Helm validator status and omits unrelated
  Pulumi/Terraform validator noise.
- Include a `doctorCommand` in compact readiness for cases where another agent
  needs the fuller read-only package, Node, planner, workspace, and external
  tool report.
- Keep planner readiness secret-safe. It reports the active planner mode/model
  label but never API keys or request headers.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed.
- Manual CLI check: `node --experimental-strip-types src/cli/main.ts agent "add ingress to payments-api dev chart" --workspace fixtures/sample-workspace --planner rule-based --max-turns 1 --json` returned the expected no-safe-action exit code `5` and compact readiness with `planner`, `workspace`, `validation-plan`, and `validator:helm` checks only.

## 2026-04-30 Root Agent Development Standards Slice

Files added or updated:

- `AGENTS.md`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add repository-root `AGENTS.md` as the mandatory entrypoint for future agents
  working on `infra-agent`.
- Define strict project standards for required reading order, product
  boundaries, safety rules, standard workflow, engineering quality, context
  discipline, infrastructure-domain behavior, validation, testing, CLI
  contracts, documentation, Git discipline, dependency policy, and definition
  of done.
- Keep detailed domain-specific rules in `docs/AGENT_RULES.md`, with
  `AGENTS.md` delegating to existing durable docs instead of duplicating every
  project rule.
- Document that future agents and contributors must read `AGENTS.md` before
  changing files.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed.

## 2026-04-30 Readiness Action Surface Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Surface compact readiness posture in result cards so human operators and
  downstream agents can see whether planner, workspace, selected validation
  plan, and selected validators are pass/warn/fail without digging into raw
  compact JSON.
- Prepend the read-only `doctorCommand` to suggested commands when readiness is
  warn or fail, while preserving approval-continuation commands as the active
  approval gate path.
- Keep the action surface targeted and secret-safe. Fallback planner warnings
  identify only the planner mode and do not expose API keys or request headers.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed.

## 2026-04-30 Installable Agent Standards Surface Slice

Files added or updated:

- `package.json`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`

Purpose:

- Include root `AGENTS.md` in `package.json.files` so installed packages carry
  the same future-agent development entrypoint as the source repository.
- Keep the package surface narrow and continue excluding fixtures, tests, smoke
  scripts, and handoff history from packed installs.
- Update package metadata tests and package-surface docs so `AGENTS.md`
  inclusion is explicit and regression-tested.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 247/247 passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`:
  passed and included `AGENTS.md`.
- `git diff --check`: passed.

## 2026-04-30 Doctor Agent Surface Check Slice

Files added or updated:

- `src/cli/doctor.ts`
- `src/cli/package-metadata.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`

Purpose:

- Add a read-only `agent-surface` check to `infra-agent doctor` so installed
  packages verify the key future-agent entrypoints, including the bin wrapper,
  CLI runtime source, `skills/infra-configuration/SKILL.md`, `AGENTS.md`,
  README, and durable docs.
- Extend package metadata reading to expose the package root and package
  `files` allowlist for installation readiness checks without exposing secrets.
- Keep doctor JSON compact and agent-facing: the new check is a normal
  pass/warn/fail `checks[]` entry and does not add a new command or mutate the
  workspace.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `node --experimental-strip-types src/cli/main.ts doctor fixtures/sample-workspace --json`:
  passed and emitted `agent-surface` as `pass`.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`:
  passed.
- `git diff --check`: passed.

## 2026-04-30 Doctor Skill Reference Surface Slice

Files added or updated:

- `src/cli/doctor.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Extend the read-only doctor `agent-surface` check to verify
  `skills/infra-configuration/references/context-validation-and-impact.md`, not
  only the top-level skill file.
- Keep the installed skill surface self-contained for downstream agents that
  load the deeper context, validation, replacement-impact, and graph guidance
  referenced by `skills/infra-configuration/SKILL.md`.
- Regression-test the exact reference path in the doctor report so package or
  install changes cannot silently drop the skill's durable reference material.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `node --experimental-strip-types src/cli/main.ts doctor fixtures/sample-workspace --json`:
  passed and emitted the skill reference path in `agent-surface.detail`.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`:
  passed and included the skill reference file.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Risk Summary Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add machine-readable `summary.impact.riskLevel` and
  `summary.impact.primaryConcern` to graph output so downstream agents can
  route high-risk impact cases without reimplementing graph heuristics.
- Keep the posture conservative: create-before-delete conflicts are high risk,
  replacement cascades and replacements are medium risk, ordinary planned
  changes or dependency-only impact are low risk, and empty impact is none.
- Surface the same posture in the human `Impact` text summary while preserving
  existing edge details for possible renames, cascades, and ordering conflicts.
- Update the stable cross-domain graph snapshot because this is an intentional
  graph contract change.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 247/247 passed.
- `git diff --check`: passed.

## 2026-04-30 Legacy Graph Impact Text Compatibility Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Keep human `Impact` text output compatible with older graph JSON payloads
  that have `summary.impact` counters but do not yet include `riskLevel` or
  `primaryConcern`.
- Normalize partial impact summaries at print time and infer missing posture
  from existing counts plus `changesByAction`, preventing `undefined` from
  leaking into operator or downstream-agent output.
- Add a focused regression test using a legacy-style impact payload with a
  replacement action.

Known validation:

- `npm run verify`: passed.
- `npm run lint`: passed.
- `npm run test:unit`: 248/248 passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Recommended Action Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `summary.impact.recommendedAction` as a compact review-only routing hint
  for downstream agents.
- Map high-risk create-before-delete conflicts to
  `review-create-before-delete-conflicts`, cascades to
  `review-replacement-cascades`, replacements to `review-replacements`,
  possible renames to `review-possible-renames`, ordinary changes to
  `review-planned-changes`, and empty impact to `none`.
- Include the recommended action in text `Impact` output and legacy impact
  summary normalization.
- Update the graph snapshot and docs because this is an intentional graph
  contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 248/248 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Shared Graph Impact Posture Slice

Files added or updated:

- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `docs/HANDOFF.md`

Purpose:

- Centralize graph impact posture inference so graph construction and legacy
  text-output normalization use the same `riskLevel`, `primaryConcern`, and
  `recommendedAction` mapping.
- Centralize enum guards for legacy or partial graph summaries before printing
  human `Impact` output.
- Remove duplicate create-before-delete, cascade, replacement, possible-rename,
  and planned-change posture logic from the CLI output layer.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 248/248 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Review Steps Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add compact `summary.impact.reviewSteps` to graph JSON so downstream agents
  get a review-only checklist alongside `riskLevel`, `primaryConcern`, and
  `recommendedAction`.
- Keep review steps posture-specific: create-before-delete conflicts emphasize
  logical rename vs true replacement triage, IaC-native rename mappings,
  aliases/imports, state repair review, and explicit sequencing only after
  approval.
- Preserve legacy graph compatibility by inferring missing review steps during
  text output normalization.
- Surface the review steps in the human `Impact` section without authorizing
  Terraform state moves, Pulumi stack mutation, imports, aliases, DNS changes,
  deletion, or apply/update operations.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 248/248 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Mutation Guard Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `summary.impact.mutationAllowed=false` to graph JSON as an explicit
  machine-readable safety guard for downstream agents.
- Force graph impact text normalization to emit `mutation allowed=false`, even
  when a legacy or external graph payload contains a different value.
- Keep graph output aligned with the read-only impact-analysis contract: it can
  explain renames, replacements, cascades, and create-before-delete conflicts,
  but it does not authorize Terraform state moves, Pulumi stack mutation,
  imports, aliases, DNS changes, deletion, apply, or update operations.
- Update the stable graph snapshot and docs because this is an intentional
  graph contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 248/248 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Review Targets Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add compact `summary.impact.reviewTargets` so downstream agents can see the
  highest-priority review edges without loading complete graph `nodes` and
  `edges`.
- Prioritize at most five targets in this order: create-before-delete
  conflicts, replacement cascades, and possible renames.
- Preserve compact evidence for each target: edge id, kind, from/to, confidence,
  source, reason, exclusive identity, matching identity keys, and replacement
  reason snippets when available.
- Include the review-target count in human `Impact` text output while keeping
  graph output read-only and `mutationAllowed=false`.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 248/248 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Omitted Review Targets Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add `summary.impact.omittedReviewTargets` so downstream agents can tell when
  compact `reviewTargets` were capped and more review edges exist.
- Keep the cap at five targets, but expose the omitted count in graph JSON and
  human `Impact` text output.
- Preserve valid omitted counts from legacy or compact payloads when full graph
  edges are unavailable.
- Add a focused regression test with seven review-target candidate edges,
  proving five are surfaced and two are reported as omitted.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 249/249 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Review Target Actions Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add per-target `recommendedAction` to each compact
  `summary.impact.reviewTargets[]` item.
- Keep the action derived centrally from the review target kind, so downstream
  agents can route create-before-delete conflicts, replacement cascades, and
  possible renames without duplicating kind-to-action mappings.
- Preserve legacy graph compatibility by inferring the per-target action during
  review target normalization.
- Update the stable graph snapshot and durable agent guidance because this is
  an intentional graph JSON contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 249/249 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Review Target Steps Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add per-target `reviewSteps` to compact
  `summary.impact.reviewTargets[]` entries.
- Keep the checklist derived centrally from the target kind so each compact
  review target can guide create-before-delete, replacement-cascade, or
  possible-rename triage without requiring full edge-list context.
- Preserve legacy graph compatibility by inferring missing per-target
  `recommendedAction` and `reviewSteps` during review target normalization.
- Update the stable graph snapshot and durable agent guidance because this is
  an intentional graph JSON contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 250/250 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-04-30 Graph Impact Review Target Risk Categories Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add per-target `riskCategory` to compact
  `summary.impact.reviewTargets[]` entries.
- Categorize create-before-delete targets into review queues using
  exclusive-identity metadata when available: DNS/domain ownership,
  Kubernetes object ownership, physical-name ownership, generic ordering, or
  exclusive-identity review.
- Categorize non-exclusive target kinds as `replacement-cascade-review` or
  `possible-rename-review` so downstream agents can route compact graph
  targets without duplicating kind/family heuristics.
- Preserve legacy graph compatibility by inferring missing `riskCategory`
  during review target normalization.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 250/250 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-01 Graph Impact Review Target Mutation Guard Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add per-target `mutationAllowed=false` to compact
  `summary.impact.reviewTargets[]` entries.
- Keep every compact review target self-contained as review-only context, so a
  downstream agent that extracts a single target cannot treat
  `recommendedAction`, `riskCategory`, or `reviewSteps` as mutation approval.
- Force legacy review target normalization to emit `mutationAllowed=false`,
  even if an external or older payload contains a different value.
- Update the stable graph snapshot and durable agent guidance because this is
  an intentional graph JSON contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 250/250 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## 2026-05-01 Graph Impact Review Target Priority Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`

Purpose:

- Add per-target 1-based `priority` to compact
  `summary.impact.reviewTargets[]` entries.
- Preserve the existing ordering contract explicitly, so downstream agents can
  filter, group, or hand off individual targets without losing the original
  triage order.
- Recompute priorities after capping and during legacy review target
  normalization, so compact targets remain contiguous even when invalid legacy
  entries are dropped or old payloads contain stale priority values.
- Update the stable graph snapshot and durable agent guidance because this is
  an intentional graph JSON contract change.

Known validation:

- `npm run verify`: passed.
- `npm run test:unit`: 250/250 passed.
- `npm run lint`: passed.
- `git diff --check`: passed.

## Current Verification Commands

Use these before handing off or committing:

```sh
npm run test
npm run lint
npm run smoke
npm run e2e
git diff --check
```

## 2026-05-03 Compact Harness Query Config Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.queryConfig` to compact `infra-agent.agent-result` output so
  downstream agents can read the immutable query-loop turn and retrieved-context
  budgets directly from the handoff payload.
- Keep the existing `harness.maxTurns` field for compatibility while exposing
  the full retrieved-context budget under the harness contract.
- Document the compact output contract in the README because this is an
  intentional agent-facing JSON addition inspired by Claude Code query config
  snapshotting.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Graph Impact Report Contract Slice

Files added or updated:

- `src/cli/infra-graph-report.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add `parseInfraGraphImpactReport` so downstream agents can validate saved
  `infra-agent.infra-graph-impact-report` payloads before consuming them as
  handoff context.
- Enforce schema version 1, source graph schema metadata, finite count fields,
  source provenance shape, summary arrays, and read-only `mutationAllowed=false`
  posture on the report and each review target.
- Document that impact report JSON is still only a read-only triage artifact and
  does not authorize native mutation or state operations.

Known validation:

- `npm run test:unit` passed with 272 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Identity Conflict Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `validation.identityConflictSummary` with total, included,
  omitted, max-entry, engine, and risk-category counts for runtime
  exclusive-identity blockers.
- Keep `validation.identityConflicts` as the capped detail sample while giving
  downstream agents an authoritative count surface before identity triage.
- Keep the summary explicitly read-only with `mutationAllowed=false` and add
  optional contract validation when parsing compact result JSON.

Known validation:

- `npm run test:unit` passed with 273 tests.
- `git diff --check` passed.

## 2026-05-04 Identity Incident Report Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add top-level `mutationAllowed=false`, `incidentSummary`, and
  `omittedIncidentCount` to `infra-agent.identity-conflict-report`.
- Preserve compact identity conflict total/included/omitted and grouped counts
  in derived reports so capped incident details are not mistaken for complete
  blocker inventories.
- Render the same sample and grouped count metadata in human `identity-report`
  output.

Known validation:

- `npm run test:unit` passed with 273 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Lifecycle Events Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add budgeted `harness.lifecycleEvents` to compact `infra-agent.agent-result`
  output with query-started, decision, tool-execution, approval-gate, and
  terminal events derived from existing turns and runtime state.
- Preserve event budget metadata while avoiding timestamps, raw decisions,
  prompts, full runtime snapshots, or raw tool output.
- Extend the compact result contract parser to validate the lifecycle event
  array shape when present.

Known validation:

- `npm run test:unit` passed with 273 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Tool Trace Budget Metadata Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Extend compact `harness.toolTrace` with total, included, omitted, first
  included turn, latest turn, and permission-category count metadata.
- Keep recent tool entries capped while giving downstream agents enough budget
  metadata to avoid recomputing permissions from truncated entries.
- Extend the compact result contract parser to validate tool trace count fields
  when present.

Known validation:

- `npm run test:unit` passed with 273 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Turn Trace Budget Metadata Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `harness.turnTraceBudget` with total, included, omitted, first
  included turn, last included turn, max-entry, and preserved-window metadata.
- Keep legacy `turnTraceLimit` and `turnTraceOmittedCount` for compatibility
  while giving downstream agents a structured trace budget surface.
- Extend the compact result contract parser to validate turn trace budget count
  fields when present.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Graph Review Target Budget Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-impact-summary.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/output.ts`
- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add `summary.impact.reviewTargetBudget` with max, total, included, and
  omitted review-target counts.
- Preserve legacy `omittedReviewTargets` while making the review-target sample
  budget explicit for graph handoffs and `Impact` text.
- Extend the graph contract parser to validate review-target budget count fields
  when present.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Graph Root Read-Only Posture Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/workspace-graph.ts`
- `src/cli/infra-graph-contract.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add top-level `mutationAllowed=false` to `infra-agent.infra-graph` so all
  graph handoffs are explicitly read-only, including graphs with no impact
  block.
- Require root `mutationAllowed=false` in the graph contract parser.
- Render the root read-only posture in human graph output and update stable
  snapshot coverage.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Graph Source Provenance Summary Slice

Files added or updated:

- `src/types/infra-graph.ts`
- `src/impact/graph-source-provenance.ts`
- `src/impact/workspace-graph.ts`
- `src/impact/graph-snapshot.ts`
- `src/cli/infra-graph-report.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `fixtures/graph-snapshots/cross-domain-impact.snapshot.json`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add graph-level `summary.sourceProvenance` with source node/edge counts and
  workspace/Terraform/Pulumi source flags.
- Reuse the same provenance collector for `impact-report` so derived reports
  mirror graph-level provenance when available.
- Render source provenance in human graph output and protect it in the stable
  graph snapshot.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Lifecycle Event Budget Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Extend compact `harness.lifecycleEvents` with total, included, omitted, and
  event-kind counts.
- Keep lifecycle event entries capped while allowing downstream agents to detect
  truncated lifecycle data without recomputing from the included sample.
- Extend the compact result contract parser to validate lifecycle count fields
  when present.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Strict Lifecycle Contract Parser Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Harden compact `infra-agent.agent-result` parsing for lifecycle handoff data.
- Reject unsupported `harness.lifecycleEvents.events[].event` values,
  unsupported `harness.lifecycleEvents.eventCounts` keys, non-numeric event
  counts, and lifecycle total/included/omitted inconsistencies.
- Reject unsupported `harness.turnTraceBudget.preservedWindow` values and
  inconsistent turn-trace budget counts before downstream reports trust the
  compact payload.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Runtime Identity Conflict Prompt Summary Slice

Files added or updated:

- `src/agent/identity-conflicts.ts`
- `src/model/prompt.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add a shared runtime identity-conflict aggregate helper for total, included,
  omitted, engine, and risk-category counts.
- Include `runtimeIdentityConflictSummary` in planner prompts beside the
  existing sampled `runtimeIdentityConflicts` list so the planner can detect
  capped detail arrays.
- Reuse the shared aggregate helper for compact
  `validation.identityConflictSummary` to keep prompt and result count semantics
  aligned.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Strict Identity Conflict Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Harden compact `validation.identityConflictSummary` parsing with numeric
  engine/risk maps, total/included/omitted consistency, and included <= max
  invariants.
- Harden compact `validation.identityConflicts` samples with engine/issue-kind
  alignment, supported `riskCategory`, string-valued `identity`, required
  `sourceCommand`, string-only `reviewSteps`, and reporting-only
  `mutationAllowed=false` when present.
- Update identity-report fixture input to include the risk category now enforced
  by the compact parser.

Known validation:

- `npm run test:unit` passed with 274 tests.
- `git diff --check` passed.

## 2026-05-04 Identity Report Contract Parser Slice

Files added or updated:

- `src/cli/identity-report.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add `parseIdentityConflictIncidentReport` for generated
  `infra-agent.identity-conflict-report` payloads.
- Validate report kind/schema, compact source schema, supported outcome,
  root and incident `mutationAllowed=false`, incident count consistency,
  summary total/included/omitted invariants, engine/risk grouped counts, and
  string-only incident identity/review-step fields.
- Run the loader's generated report through the parser before returning it so
  downstream handoff gets a verified read-only report.

Known validation:

- `npm run test:unit` passed with 275 tests.
- `git diff --check` passed.

## 2026-05-04 Report CLI Execution Coverage Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add a unit smoke test that invokes the exported CLI `main` entrypoint with
  report command arguments and captured stdout.
- Cover `identity-report <agent-result.json> --json` from compact input file to
  read-only `infra-agent.identity-conflict-report` JSON output.
- Cover `impact-report <graph.json> --json` from infra graph input file to
  read-only `infra-agent.infra-graph-impact-report` JSON output.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Infra Skill Handoff Contract Alignment Slice

Files added or updated:

- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Align the bundled infra-configuration skill with the latest compact
  handoff contract surfaces.
- Document `harness.turnTraceBudget`, `harness.lifecycleEvents`,
  `validation.identityConflictSummary`, planner
  `runtimeIdentityConflictSummary`, identity-report contract validation,
  graph `summary.sourceProvenance`, and graph impact `reviewTargetBudget`.
- Extend the package-surface smoke test so skill content must keep mentioning
  these handoff fields.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Smoke Fixture Identity Risk Category Slice

Files added or updated:

- `scripts/smoke.mjs`
- `scripts/e2e.mjs`
- `docs/HANDOFF.md`

Purpose:

- Align smoke and e2e compact identity-conflict fixtures with the strict compact
  result parser.
- Add required `riskCategory` to fixture identity conflicts so
  `identity-report` contract validation exercises current schema expectations.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `npm run smoke` passed.
- `npm run e2e` passed.
- `git diff --check` passed.

## 2026-05-04 Compact Root Metadata Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `infra-agent.agent-result` inputs to include root `task` and
  `workspaceRoot` strings before downstream reports reuse them.
- Validate optional root metadata fields such as `modelName`, `profileId`,
  `turnsUsed`, requested environment/service, string-array handoff fields, and
  `primaryTarget` shape when present.
- Keep this as contract parsing only; no runtime output shape changes.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Harness Budget Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.maxTurns`, `harness.queryConfig`, and retrieved
  context budget fields as integer contract data instead of loose metadata.
- Validate compact `harness.loopBudget` turns used, max turns, remaining turns,
  and exhausted-state consistency against root `turnsUsed` and query max-turns.
- Keep this as contract parsing only; no runtime output shape changes.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Repair Budget Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.repairBudget` attempts used, max attempts,
  remaining attempts, and exhausted-state consistency.
- Validate that `harness.repairBudget.maxAttempts` matches
  `harness.queryConfig.maxRepairAttempts` so downstream agents can distinguish
  retryable validation from manual-repair handoff.
- Keep this as contract parsing only; no runtime output shape changes.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Turn Trace Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.turnTrace` entry objects with supported
  action/family/status/stop/clarification enums, string summaries, boolean
  terminal flags, and non-negative count fields.
- Validate stop-reason and clarification-kind coherence for turn trace entries.
- Validate turn-trace budget links: included count matches entry count,
  first/last included indexes match entries, and legacy
  `turnTraceLimit`/`turnTraceOmittedCount` match `turnTraceBudget`.
- Keep this as contract parsing only; no runtime output shape changes.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Tool Trace Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.toolTrace` entry objects with supported action
  kinds, tool safety values, permission categories, non-empty tool names,
  string summaries, and boolean mutation/approval flags.
- Validate tool trace budget counts, included-entry length, first included turn
  index, and permission-category count totals.
- Keep this as contract parsing only; no runtime output shape changes.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Readiness Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `readiness` status, pass/warn/fail summary counts,
  `doctorCommand`, and check entry shapes.
- Validate that readiness counts match checks by status and that summary status
  is derived from fail/warn/pass check counts.
- Keep readiness as read-only posture data; no resume or mutation semantics are
  introduced.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Validation Command Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `validation.commands` budget fields and command entry
  shapes, including command strings, exit codes, status/kind enums, previews,
  unsafe-blocked flags, and unsafe rule metadata.
- Validate `validation.targetCommandCount` and `validation.yamlGuardCount` as
  non-negative integer summary fields.
- Keep unsafe validation command data reporting-only; no mutation or approval
  semantics are introduced.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Approval Resume Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact approval signal kinds, write-risk values, tool-category
  values, and signal field coherence for write approval versus tool-category
  approval.
- Validate compact `approval.resume` command/null consistency, resume array
  shapes, signal count coverage, and continuation-required boolean semantics.
- Preserve approval metadata as handoff-only data; it does not authorize writes
  or native operations.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Planner Handoff Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.plannerHandoff.lastAction` kind, family,
  stop-reason, clarification-kind, and execution-status values.
- Validate active blocker issue/signal metadata and require it to match blocker
  kind.
- Validate outcome-to-active-blocker and outcome-to-next-control-action
  consistency so downstream agents can route handoff without raw planner state.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Contract Skill Alignment Slice

Files added or updated:

- `skills/infra-configuration/SKILL.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Align the infra-configuration skill with the hardened compact
  `infra-agent.agent-result` contract so downstream agents treat compact JSON as
  parser-validated handoff data.
- Update the Claude Code pattern reference to call out contract enforcement for
  root metadata, budgets, traces, readiness, validation commands, approval
  resume, and planner handoff routing.

Known validation:

- `npm run lint`: passed.
- `npm run test:unit`: passed with 276 tests.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-05-04 Compact Lifecycle Event Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.lifecycleEvents` max/count fields as non-negative
  integers and require included count to match the emitted event sample.
- Validate lifecycle event entry fields including turn index, action kind,
  action family, execution status, reason, tool/approval/validation counts, and
  optional outcome.
- Validate lifecycle `eventCounts` keys and totals so downstream agents can
  trust query lifecycle routing without raw runtime state.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Tool Permission Summary Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `harness.stateSummary` runtime counts as non-negative
  integers.
- Validate `harness.toolPermissionSummary` aggregate counts, ensuring mutation
  and approval counts do not exceed `totalToolCount`.
- Validate permission summary category keys and totals, and require them to
  match `harness.toolTrace.permissionCategoryCounts` when both summaries are
  present.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Selected Plan Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `validation.selectedPlan` to be an array before downstream
  agents use intended validator metadata.
- Validate selected-plan entry kind, target path, command strings, command
  count consistency, executed/failed count bounds, and validator availability.
- Keep intended validation plan contract separate from executed
  `validation.commands` summaries.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Issue Summary Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `validation.issueSummary` and `validation.issueDetails`
  objects before downstream agents derive blocker reports.
- Validate issue summary count arithmetic, bounded group entries, supported
  issue kinds, positive group/source-command counts, and boolean flag
  consistency.
- Validate issue-details budget fields and require omitted issue counts to
  match the summary surface.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Safety Blocker Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `validation.safetyBlockers` before downstream agents treat
  validation blocker posture as mutation-safe.
- Validate safety-blocker budget fields, entry limits, supported unsafe/YAML
  blocker kinds, source command/message strings, and string-or-null unsafe/YAML
  metadata.
- Require every safety blocker to carry boolean repairability and
  `mutationPrevented=true`.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Sampled Issue Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `validation.issues` as the capped validation issue detail
  sample.
- Validate sampled issue entry kind, repairability, message, optional guidance,
  and string-valued metadata.
- Validate issue sample length, omitted-count arithmetic, and full-sample
  agreement with `validation.issueSummary` when no issues are omitted.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Knowledge Context Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `knowledgeContext` as the retrieved docs/schema budget
  summary for downstream handoff.
- Validate context budget limits, packet/omission count arithmetic, packet
  summary shape, confidence values, omitted-reason coherence, and derived token
  totals.
- Reject raw context fields such as excerpts, facts, or source payloads in
  compact packet summaries.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Knowledge Cache Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `knowledgeCache` as handoff metadata alongside
  `knowledgeContext`.
- Validate non-empty cache root strings and supported source labels for
  environment override, workspace config, and default user cache.
- Keep path-safety policy in the cache-root resolver rather than re-deriving it
  from compact result parsing.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Identity Aggregate Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Require compact `validation.identityConflictSummary` as the authoritative
  count surface for capped identity conflict samples.
- Validate non-negative integer summary counts, included/omitted arithmetic,
  included sample length, and engine/risk-category map totals.
- Validate included conflicts are covered by summary engine and risk-category
  counts, while preserving the existing conflict detail shape checks.

Known validation:

- `npm run test:unit` passed with 276 tests.
- `git diff --check` passed.

## 2026-05-04 Compact Contract Docs Alignment Slice

Files added or updated:

- `docs/ARCHITECTURE.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `scripts/compact-fixtures.mjs`
- `scripts/smoke.mjs`
- `scripts/e2e.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Align the architecture, Claude Code pattern mapping, packaged skill, and
  detailed skill reference with the hardened compact `agent --json` handoff
  contract.
- Make `knowledgeCache`, `knowledgeContext`, tool permission summaries,
  readiness doctor routing, validation issue samples, safety blockers, and
  identity aggregate counts explicit in agent-facing documentation.
- Extend package-surface tests so the installed skill continues to mention the
  compact contract fields and detailed reference path.
- Add a shared compact identity-conflict fixture for smoke and e2e report
  checks so script coverage follows the current `identity-report` input
  contract.

Known validation:

- `npm run lint`: passed.
- `npm run test:unit`: passed with 276 tests.
- `npm run smoke`: passed.
- `npm run e2e`: passed.
- `git diff --check`: passed.

## 2026-05-04 Graph Impact Source Provenance Slice

Files added or updated:

- `src/cli/infra-graph-report.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add `sourceProvenance` to `infra-agent.infra-graph-impact-report` so
  downstream agents can distinguish workspace-inspection facts from Terraform
  plan and Pulumi preview impact data.
- Include source node/edge counts plus booleans for workspace inspection,
  Terraform plan, and Pulumi preview provenance.
- Render provenance in the human graph impact report output.

Known validation:

- `npm run test:unit` passed with 271 tests.
- `git diff --check` passed.

## 2026-05-04 Graph Impact Report CLI Slice

Files added or updated:

- `src/cli/main.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add `infra-agent impact-report <graph.json> [--json]` as a focused read-only
  reporting command for existing graph JSON.
- Render graph impact report text and JSON without rerunning native validators
  or mutating workspace, Terraform state, Pulumi stacks, Helm releases, or
  Kubernetes resources.
- Document the command as the graph equivalent of `identity-report` for
  downstream agent handoff.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Impact Report Loader Slice

Files added or updated:

- `src/cli/infra-graph-report.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add a read-only graph impact report builder and loader for saved
  `infra-agent.infra-graph` JSON.
- Reuse the graph contract parser before reporting impact, preserve
  `mutationAllowed=false`, and surface compact counts, review target counts,
  omitted review target counts, and existing graph impact summaries.
- Record that graph impact reports summarize existing graph JSON only; they do
  not rerun native tools or authorize remediation.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Infra Graph Contract Parser Slice

Files added or updated:

- `src/cli/infra-graph-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add a shallow `infra-agent.infra-graph` contract parser for saved graph JSON
  handoffs.
- Validate graph kind, schema version, node/edge arrays, summary counts, impact
  review target shape, and `mutationAllowed=false` posture before downstream
  report consumers trust graph impact data.
- Add focused unit coverage for rejecting malformed graph JSON and graph impact
  payloads that imply mutation authority.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Compact Validation Safety Blockers Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `validation.safetyBlockers` for unsafe validation command and
  YAML syntax blockers.
- Preserve explicit `mutationPrevented` posture, unsafe command rule/reason
  metadata, and YAML path/parser hints without requiring agents to inspect
  sampled issue prose.
- Extend the compact result contract parser to shallow-validate
  `validation.safetyBlockers.entries` when present.
- Update the packaged infra skill so downstream agents know to check safety
  blockers before raw logs.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Unsafe Validation Command Metadata Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Extend compact `validation.commands.entries` with `unsafeRuleId` and
  `unsafeReason` fields alongside the existing `unsafeBlocked` boolean.
- Derive metadata from the same command-safety classifier used by
  `validate_targets`, with a stderr fallback for older blocked command output.
- Keep downstream agents from scraping native stderr to identify why a validation
  command was rejected as unsafe.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Execution Approval Gate Slice

Files added or updated:

- `src/query.ts`
- `test/cli-smoke.test.mjs`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add an execution-time approval gate before workspace mutation actions can
  reach `executeDecision`.
- Block `apply-edit-plan` when existing approval signals are active or the
  decision payload itself contains writes/native stack config operations that
  require approval.
- Return an approval-required run with a skipped execution record and no tool
  executions when a planner attempts to apply an unapproved high-risk edit.
- Avoid counting skipped mutation attempts as successful repair attempts.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Planner Handoff Outcome Matrix Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add matrix coverage for compact `harness.plannerHandoff` control routing by
  final agent outcome.
- Verify completed, approval-required, clarification-required,
  validation-blocked, repair-budget-exhausted, no-safe-action, and
  turn-budget cases map to stable active blocker and next-control-action values.
- Assert validation and approval blocker details remain nullable and scoped to
  the relevant blocker type.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Infra Skill Compact Handoff Alignment Slice

Files added or updated:

- `skills/infra-configuration/SKILL.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Align the packaged infra configuration skill with the current compact
  `infra-agent.agent-result` handoff surface.
- Tell downstream agents to read `harness.plannerHandoff`,
  `harness.repairBudget`, `validation.selectedPlan`, `validation.commands`,
  `validation.issueSummary`, `validation.issueDetails`, `approval.resume`, and
  `knowledgeContext` before asking for raw logs or full runtime state.
- Add package-surface coverage so the shipped skill continues to mention the
  compact handoff fields other agents need.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Compact Validation Issue Details Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `validation.issueDetails` budget metadata beside the existing
  capped `validation.issues` detail array.
- Report the maximum included issue-detail entries and omitted issue-detail
  count so downstream agents can tell when the sampled issue list is incomplete
  without recomputing the cap.
- Keep detailed validation issue messages sampled; aggregate blocker posture
  remains in `validation.issueSummary`.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Shared Agent Outcome Constants Slice

Files added or updated:

- `src/types/agent.ts`
- `src/cli/agent-result-contract.ts`
- `docs/HANDOFF.md`

Purpose:

- Add shared `AGENT_RUN_OUTCOMES` constants in the agent type module and derive
  `AgentRunOutcome` from that tuple.
- Update the compact agent-result contract parser to validate outcomes from
  the shared tuple instead of maintaining a duplicate local list.
- Reduce drift between runtime outcome typing and agent-facing compact result
  validation.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Compact Repair Budget Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `harness.repairBudget` to `infra-agent.agent-result` output.
- Report repair attempts used, max attempts, remaining attempts, and exhaustion
  as structured JSON instead of requiring downstream agents to parse result-card
  text.
- Preserve existing repair behavior; this is an agent-facing reporting change
  only.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Compact Contract Hardening Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Harden shallow compact `infra-agent.agent-result` validation for newer
  handoff blocks.
- Validate `harness.stateSummary` count values, `validation.commands.entries`,
  `validation.issueSummary.groups`, and `approval.resume.continuationRequired`
  when those compact blocks are present.
- Keep the parser dependency-free and shallow, preserving compact result
  validation without introducing JSON Schema.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Result Card Validation Blocker Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add a result-card `Validation blockers` line that mirrors
  `validation.issueSummary`.
- Report total validation issue count, repairable/non-repairable split, top
  issue group, and omitted issue/group counts for human and downstream-agent
  handoff.
- Keep raw validator stdout/stderr out of the result card; detailed evidence
  remains budgeted under compact validation command and issue fields.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Turn Trace Budget Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.turnTraceLimit` and `harness.turnTraceOmittedCount` to compact
  `infra-agent.agent-result` output while preserving the existing
  `harness.turnTrace` array.
- Make the compact turn-trace budget explicit so downstream agents can tell
  whether the handoff trace is complete or capped.
- Document the fields alongside the compact turn-trace contract.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Unsafe Validation Command Guard Slice

Files added or updated:

- `src/validators/command-safety.ts`
- `src/tools/ValidateTargetsTool/ValidateTargetsTool.ts`
- `src/types/agent.ts`
- `src/agent/classify-validation-issues.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Add a validation command safety guard that blocks deploy/apply, Terraform
  state/import mutation, Pulumi update/import/refresh/state mutation, Helm
  release mutation, and Kubernetes mutation commands before spawning a shell.
- Surface blocked commands as structured `unsafe-validation-command` issues
  with the original command and reason metadata.
- Preserve the existing safe validation command surface, including Terraform
  `fmt -check`/`validate`, Helm `lint`/`template`, and Pulumi `preview` with
  the local stack initialization wrapper.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 LLM Validation Command Clamp Slice

Files added or updated:

- `src/model/decision-parser.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Clamp parsed LLM `validate-targets` payloads to commands already present in
  the selected validation plan.
- Drop invented commands such as `terraform apply`, unrelated Helm/Pulumi
  commands, or other non-selected commands before execution.
- Fall back to the selected validation commands when every model-provided
  command is invalid for the current runtime.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 LLM Target Path Clamp Slice

Files added or updated:

- `src/model/decision-parser.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Clamp parsed LLM `inspect-target-files.targetPaths` to paths already present
  in `runtime.preflight.targetCandidates`.
- Fall back to the existing top target-candidate paths when every
  model-provided inspection path is invalid.
- Clamp parsed LLM `repair-terraform-formatting.rootPath` to known Terraform
  root candidates, falling back to the top Terraform root on invalid input.

Known validation:

- `npm run test:unit`: passed.
- `npm run lint`: passed by Worker C during implementation.
- `git diff --check`: passed.

## 2026-05-03 Configurable Repair Budget Slice

Files added or updated:

- `src/query-config.ts`
- `src/types/agent.ts`
- `src/query.ts`
- `src/agent/rule-based-planner.ts`
- `src/cli/main.ts`
- `src/cli/output.ts`
- `src/model/prompt.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Move the bounded repair budget from hard-coded planner checks into
  `QueryLoopConfig.maxRepairAttempts`.
- Add `agent --max-repair-attempts <n>` for explicit bounded-loop experiments.
- Preserve the default repair budget of `2`, while allowing `0` to disable
  automatic repair attempts and produce `repair-budget-exhausted` when a
  repairable validation failure is encountered.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Repair Budget Output Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`

Purpose:

- Include `maxRepairAttempts` in compact `harness.queryConfig` so the compact
  handoff payload carries the same immutable repair budget as full run state.
- Report repair attempts as `used/max` in result cards, agent snapshots, and
  human CLI output.
- Preserve the existing compact output fallback behavior for synthetic tests
  or legacy callers that do not attach a full `config` object to run state.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 LLM Action Family Metadata Slice

Files added or updated:

- `src/model/decision-parser.ts`
- `src/model/prompt.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Normalize parsed LLM `payload.actionFamily` as trace metadata rather than
  execution authority.
- Preserve supported action-family values when the model provides them, and
  derive deterministic fallback values from the parsed action kind, requested
  domain, clarification kind, stop reason, or edit-plan kind when missing or
  unsupported.
- Document the optional action-family metadata values in the planner system
  prompt so downstream LLM planner output can align with compact turn traces.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Turn Execution Reason Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`

Purpose:

- Add `executionReason` to compact `harness.turnTrace` entries so downstream
  agents can see why a turn skipped execution without loading full turn state.
- Preserve `null` for completed turns or legacy turns without an execution
  reason.
- Keep the new field reporting-only; it does not affect planner decisions,
  tool execution, validation commands, or write behavior.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Loop Budget Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `harness.loopBudget` with turns used, max turns, remaining turns,
  and an exhausted flag.
- Surface the same turn-budget status in result cards so humans and downstream
  agents can distinguish terminal stops from max-turn exhaustion.
- Keep this as a reporting-only contract change; it does not alter the query
  loop, planner decisions, validation commands, repair behavior, or tool
  execution.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Shared Action Family Constants Slice

Files added or updated:

- `src/types/agent.ts`
- `src/model/decision-parser.ts`
- `src/model/prompt.ts`
- `docs/HANDOFF.md`

Purpose:

- Move allowed `AgentActionFamily` values into the shared agent type module so
  the parser and planner prompt use the same source of truth.
- Preserve the existing `AgentActionFamily` union by deriving it from the
  exported constant tuple.
- Avoid drift between LLM action-family metadata validation and the system
  prompt's allowed metadata list.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Agent Result Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `src/cli/identity-report.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/HANDOFF.md`

Purpose:

- Extract shallow compact `infra-agent.agent-result` parsing into a reusable
  CLI contract module instead of keeping it private to `identity-report`.
- Validate `kind`, `schemaVersion`, known outcome, compact trace array shapes,
  readiness check shape, and `validation.identityConflicts` before deriving
  downstream reports.
- Keep the parser dependency-free and defensive rather than introducing a broad
  JSON Schema dependency.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Selected Validation Plan Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `validation.selectedPlan` entries to `infra-agent.agent-result`
  output so downstream agents can see the intended domain-focused validators.
- Include target kind, target path, command list, command count, executed count,
  failed count, and selected validator availability.
- Keep intended validation separate from executed validation output and avoid
  listing unrelated workspace validators.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Validation Command Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add budgeted `validation.commands` entries to compact agent results so
  downstream agents can see recent validation execution status without
  requesting `--json-full`.
- Include command, exit code, pass/fail status, YAML-guard vs target-validation
  kind, short stdout/stderr previews, and unsafe-command blocker flags.
- Cap validation command summaries at eight entries and trim output previews to
  300 characters plus an omission marker.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Runtime State Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add `harness.stateSummary` to compact agent results with counts for
  observations, tool summaries, applied writes, validation results/issues,
  approval signals, retrieved context packets, and semantic facts.
- Give downstream agents enough lifecycle shape to triage a run without loading
  full runtime arrays or raw file contents.
- Preserve compact output omissions of full `runtime`, `turns`, and `preflight`
  state.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Structured Approval Resume Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `approval.resume` to `infra-agent.agent-result` output for
  approval-required runs.
- Report whether continuation is required, the scoped continuation command,
  active write risks, write paths, tool categories, and approval signal count.
- Keep the structure reporting-only so downstream agents preserve the explicit
  user approval requirement before writes or native operations.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Validation Issue Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `validation.issueSummary` to `infra-agent.agent-result` output so
  downstream agents can understand validation blocker shape before reading
  sampled issue details.
- Group active validation issues by kind and repairability with issue counts,
  distinct source-command counts, blocking flags, and omitted group counts.
- Keep raw native validation output out of the summary; detailed messages remain
  capped in the existing sampled `validation.issues` array.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Planner Handoff Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add compact `harness.plannerHandoff` to `infra-agent.agent-result` output so
  downstream agents can route completed, blocked, approval, clarification,
  repair-budget, and turn-budget runs without loading raw runtime state.
- Report only derived last-action metadata, active blocker kind, top validation
  issue kind, top approval signal kind, and next control action.
- Extend the compact result contract parser to reject unknown planner handoff
  active-blocker and next-control-action values when the block is present.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Compact Validation Issue Flags Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Extend compact `validation.issueSummary` with `omittedIssueCount` so
  downstream agents can tell when the sampled `validation.issues` array is not
  complete.
- Add coarse blocker flags for repairable issues, non-repairable issues,
  unsafe validation commands, YAML syntax failures, and identity-conflict
  issue kinds.
- Keep the summary aggregate-only; raw validation output remains capped under
  `validation.commands` and sampled issue messages remain capped under
  `validation.issues`.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-03 Result Card Knowledge Context Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/HANDOFF.md`

Purpose:

- Add a result-card `Knowledge context` line that mirrors the compact
  retrieved-context budget summary.
- Report included packet count, total packet count, token estimate use, omitted
  packet count, and omission reasons such as packet limit or token budget.
- Keep raw retrieved excerpts out of human output; detailed context remains
  budgeted in compact `knowledgeContext`.

Known validation:

- `npm run test:unit`: passed.
- `git diff --check`: passed.

## 2026-05-04 Handoff Routing Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.summary` with the derived outcome, active blocker,
  next control action, readiness status, validation status, validation issue
  count, identity conflict count, approval-continuation flag, and changed file
  count.
- Validate the summary shape and supported routing enums in the compact result
  parser.
- Keep the summary derived from existing compact result sections; cross-field
  consistency is intentionally handled in a later slice.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Summary Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `handoffCheckpoint.summary` against the root outcome and changed
  file list.
- Cross-check summary routing against `harness.plannerHandoff`, readiness
  status against `readiness.status`, validation status/counts against
  `validation.status`, `validation.issueSummary`, and
  `validation.identityConflictSummary`.
- Cross-check approval continuation against `approval.resume` so compact
  handoffs cannot claim an approval continuation that the durable approval
  section does not support.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Budget Summary Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.budgets` with included/omitted counts for compact
  turn trace, lifecycle events, tool trace, validation commands, validation
  issues, validation issue groups, validation safety blockers, identity
  conflicts, approval signals, and retrieved knowledge packets.
- Include knowledge packet token estimates in the checkpoint budget summary so
  continuation agents can distinguish packet omission from token-budget
  pressure without loading raw excerpts.
- Validate the budget shape and non-negative count fields in the compact result
  parser.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Budget Consistency Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Cross-check `handoffCheckpoint.budgets` against `harness.turnTraceBudget`,
  `harness.lifecycleEvents`, `harness.toolTrace`, validation command samples,
  validation issue samples, validation issue groups, validation safety
  blockers, identity conflict summaries, approval resume counts, and knowledge
  context packet counts.
- Cross-check knowledge packet token estimates against `knowledgeContext` so a
  continuation agent can trust the checkpoint budget without inspecting packet
  details.
- Add parser regression coverage for budget count drift across harness,
  validation, and knowledge sections.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Continuation Slice

Files added or updated:

- `src/cli/output.ts`
- `src/cli/agent-result-contract.ts`
- `scripts/compact-fixtures.mjs`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `handoffCheckpoint.continuation` with required/optional continuation
  state, reason, next control action, approval requirement, optional approval
  resume command, and `mutationAllowed: false`.
- Validate continuation shape and cross-check reason/action/approval posture
  against `handoffCheckpoint.summary`.
- Cross-check continuation approval command against `approval.resume.command`
  when the durable approval section is present.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-04 Handoff Checkpoint Documentation Slice

Files added or updated:

- `README.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `handoffCheckpoint` as the first compact routing checkpoint for
  downstream continuation agents.
- Align the packaged infra-configuration skill and context reference with the
  new summary, budget, continuation, raw-exclusion, durable-section, and
  `mutationAllowed=false` contract.
- Extend package surface assertions so the shipped skill keeps checkpoint and
  continuation guidance.

Known validation:

- `npm run test:unit`: passed with 276 tests.
- `git diff --check`: passed.

## 2026-05-05 LLM Config Source Metadata Slice

Files added or updated:

- `src/model/config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Extend LLM planner config resolution with explicit provider, model, base URL,
  and source metadata for future CLI-level model selection.
- Keep API keys env-only while recording only non-secret source labels for
  handoff and doctor output.
- Preserve the current OpenAI-compatible provider boundary and reject
  unsupported provider labels before model client construction.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM planner config" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- CLI flags are not wired yet; this slice only adds the config contract that
  later stages will consume.

## 2026-05-05 Planner Client Selection Metadata Slice

Files added or updated:

- `src/model/create-model-client.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a `createModelClientSelection` factory that returns both the planner
  client and a non-secret runtime planner configuration snapshot.
- Preserve the existing `createModelClient` helper for callers that only need
  the client.
- Record requested planner mode, effective mode, fallback reason, client name,
  and LLM provider/model/base URL source metadata without exposing API keys.

Known validation:

- `node --experimental-strip-types --test-name-pattern "createModelClient" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Agent run state does not yet persist this metadata; later slices must carry
  the snapshot into compact handoff and suggested commands.

## 2026-05-05 Agent Run Planner Snapshot Slice

Files added or updated:

- `src/agent/run-single-step.ts`
- `src/model/create-model-client.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Persist the selected planner configuration on `AgentRunState` so downstream
  output and handoff builders read a query-entry snapshot instead of
  re-resolving process environment.
- Support injected custom planning models in tests without treating them as
  LLM planner clients.
- Keep planner selection metadata non-secret and separate from raw runtime
  state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "runSingleStep respects the configured maximum turn count" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Compact output and CLI flags do not yet expose or consume this snapshot.

## 2026-05-05 Agent LLM CLI Option Parsing Slice

Files added or updated:

- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add agent-only CLI parsing for `--model`/`--llm-model`,
  `--openai-base-url`/`--llm-base-url`, and
  `--llm-provider openai-compatible`.
- Keep API keys out of CLI arguments; model credentials remain env-only.
- Preserve the current single-provider boundary while creating a clear future
  extension point for additional model adapters.

Known validation:

- `node --experimental-strip-types --test-name-pattern "agent CLI args" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Parsed LLM options are not yet passed into planner construction.

## 2026-05-05 Agent LLM Option Wiring Slice

Files added or updated:

- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Convert parsed agent LLM flags into `LLMClientConfigOverrides` through a
  small pure helper.
- Pass the overrides into `runSingleStep` so planner construction can honor
  user-selected model and OpenAI-compatible base URL values.
- Keep testing deterministic by validating the pure conversion path instead of
  calling a live LLM provider.

Known validation:

- `node --experimental-strip-types --test-name-pattern "explicit LLM option aliases" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Continuation and suggested commands do not yet preserve model selection
  flags across approval handoff or exported compact JSON reruns.

## 2026-05-05 Compact Planner Config Handoff Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add compact `harness.plannerConfig` so downstream agents can see requested
  planner mode, effective mode, client name, fallback reason, and non-secret
  LLM provider/model/base URL metadata.
- Preserve API-key secrecy by reporting only `apiKeyConfigured=true` and the
  source label when an LLM planner is active.
- Keep compatibility for hand-authored test states that only carry
  `modelName`.

Known validation:

- `node --experimental-strip-types --test-name-pattern "runSingleStep respects the configured maximum turn count" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The compact parser does not yet validate `harness.plannerConfig`.

## 2026-05-05 Compact Planner Config Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require compact `harness.plannerConfig` to be structurally valid before
  downstream agents trust model/provider handoff data.
- Validate requested/effective planner modes, supported OpenAI-compatible
  provider labels, non-secret source labels, and client-name consistency with
  root `modelName`.
- Keep non-LLM planner runs from carrying stale LLM metadata.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Approval continuation and suggested export commands still need to preserve
  user-selected planner flags.

## 2026-05-05 Approval Continuation Planner Flags Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Preserve explicit planner mode, model, provider, and OpenAI-compatible base
  URL flags in approval continuation commands.
- Preserve user-selected planner flags in compact `agent --json` export
  commands used by identity-report follow-up flows.
- Emit only CLI-selected non-secret values; API keys remain environment-only.

Known validation:

- `node --experimental-strip-types --test-name-pattern "tool category approval continuation scope" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The compact parser does not yet require planner flags to be present in
  approval continuation commands when `harness.plannerConfig` says they came
  from CLI.

## 2026-05-05 Approval Planner Flag Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require approval continuation commands to preserve requested planner mode and
  CLI-sourced LLM provider/model/base URL flags exactly.
- Apply the same check to per-signal `approval.resume.additionalCommands` so
  non-primary approval handoffs do not drop model selection.
- Keep env/default model values out of commands; only CLI-selected values are
  required in command text.

Known validation:

- `node --experimental-strip-types --test-name-pattern "tool category approval continuation scope" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Doctor does not yet accept the same model/base URL overrides for read-only
  readiness checks.

## 2026-05-05 Doctor LLM Override Slice

Files added or updated:

- `src/cli/doctor.ts`
- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Allow read-only `doctor` checks to receive the same model, provider, and
  OpenAI-compatible base URL overrides as `agent`.
- Keep API keys env-only and verify doctor output does not expose secret
  values.
- Let users validate intended LLM planner configuration before running the
  bounded agent loop.

Known validation:

- `node --experimental-strip-types --test-name-pattern "doctor command" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- README, rules, and packaged skill docs still need to describe the new CLI
  model override path.

## 2026-05-05 LLM Planner Override Documentation Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document agent and doctor model/base URL/provider override flags and the
  env-only API key boundary.
- Record `harness.plannerConfig` as the compact non-secret planner handoff
  surface.
- Update packaged skill assertions so installable guidance includes
  model-selection and continuation-command behavior.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Full repository verification and package dry-run still need to run after the
  complete development round.

## 2026-05-05 LLM Base URL Safety Slice

Files added or updated:

- `src/model/config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Reject LLM planner base URLs that are not absolute HTTP(S) URLs.
- Reject credentials, query strings, and fragments in model gateway base URLs
  so secrets do not enter config metadata, doctor output, compact JSON, or
  command handoff.
- Preserve trailing-slash normalization for valid OpenAI-compatible base URLs.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM planner config" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Provider-specific compatibility beyond OpenAI-compatible chat completions is
  still intentionally out of scope.

## 2026-05-05 Roadmap LLM Planner Override Status Slice

Files added or updated:

- `docs/ROADMAP.md`
- `docs/HANDOFF.md`

Purpose:

- Record Phase 10 progress in the active roadmap: agent and doctor now accept
  non-secret OpenAI-compatible planner overrides.
- Capture env-only API key posture, compact `harness.plannerConfig`, and
  planner-flag-preserving approval continuation commands as durable project
  status.

Known validation:

- `git diff --check`: passed before commit.

Remaining risks:

- Additional provider adapters remain future work and should be added behind
  the same parser, doctor, and compact handoff contracts.

## 2026-05-05 LLM Provider Capability Registry Slice

Files added or updated:

- `src/model/providers.ts`
- `src/model/config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a narrow provider capability registry for the existing
  OpenAI-compatible planner adapter.
- Describe the current transport as chat completions, JSON-object response
  format, non-streaming planner calls, and `/chat/completions` endpoint path.
- Keep this as metadata only; runtime behavior is unchanged in this slice.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM provider capabilities" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Capabilities are not yet attached to resolved LLM config or compact handoff.

## 2026-05-05 LLM Config Capability Resolution Slice

Files added or updated:

- `src/model/config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Attach provider capabilities to the resolved LLM client config at the same
  point provider/model/base URL and source metadata are snapshotted.
- Keep provider capabilities deterministic and derived from the supported
  provider id instead of hard-coding them in downstream output code.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM planner config resolves" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The model client still constructs the endpoint path directly instead of using
  provider capabilities.

## 2026-05-05 LLM Client Capability Request Slice

Files added or updated:

- `src/model/LLMModelClient.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Route the LLM planner request endpoint and response format through provider
  capabilities instead of hard-coded strings in the client.
- Keep the OpenAI-compatible adapter non-streaming for planner calls and assert
  `stream: false` in the injected-transport test.
- Preserve the existing `/chat/completions` JSON-object request behavior.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLMModelClient" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Planner runtime metadata still does not expose provider capabilities for
  doctor or compact handoff.

## 2026-05-05 Planner Runtime Capability Snapshot Slice

Files added or updated:

- `src/model/create-model-client.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add provider capability metadata to the non-secret `PlannerRuntimeConfig`
  returned by model client selection.
- Keep the snapshot tied to the selected provider at query entry, following the
  immutable query config pattern from the local Claude Code references.

Known validation:

- `node --experimental-strip-types --test-name-pattern "createModelClientSelection" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Compact output and doctor reports still need to expose/validate these
  capabilities for downstream agents.

## 2026-05-05 Compact Planner Capability Metadata Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Expose provider capability metadata under compact
  `harness.plannerConfig.llm.capabilities`.
- Keep capability metadata small: transport, endpoint path, response format,
  JSON-object support, and streaming posture.
- Preserve compatibility for hand-authored test states by falling back to the
  current OpenAI-compatible capability values when old states omit them.

Known validation:

- `node --experimental-strip-types --test-name-pattern "tool category approval continuation scope" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Compact parser validation for the new capability object is still pending.

## 2026-05-05 Compact Planner Capability Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Require LLM compact handoffs to include
  `harness.plannerConfig.llm.capabilities`.
- Validate transport, endpoint path, response format, JSON-object support, and
  non-streaming planner posture against the supported OpenAI-compatible
  capability contract.
- Reject compact payloads that claim streaming LLM planner behavior, which is
  not part of the current bounded planner adapter.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Doctor output still reports only model/base URL, not provider capabilities.

## 2026-05-05 Doctor Planner Capability Detail Slice

Files added or updated:

- `src/cli/doctor.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Extend the read-only doctor planner check with non-secret provider capability
  detail: provider id, transport, response format, and streaming posture.
- Keep doctor output secret-safe; tests continue to assert API key values are
  absent from serialized reports.

Known validation:

- `node --experimental-strip-types --test-name-pattern "doctor command" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Compact readiness `doctorCommand` still does not preserve CLI-selected
  planner flags.

## 2026-05-05 Readiness Doctor Planner Flag Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Preserve CLI-selected LLM provider/model/base URL flags in compact
  `readiness.doctorCommand`.
- Keep `--planner` out of doctor commands because doctor is a read-only
  readiness check, not an agent planning mode selector.
- Share the same LLM flag builder between doctor and agent continuation command
  surfaces.

Known validation:

- `node --experimental-strip-types --test-name-pattern "tool category approval continuation scope" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Compact parser validation for planner flags in `readiness.doctorCommand` is
  still pending.

## 2026-05-05 Readiness Doctor Planner Flag Contract Slice

Files added or updated:

- `src/cli/agent-result-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Validate compact `readiness.doctorCommand` against CLI-sourced LLM
  provider/model/base URL metadata in `harness.plannerConfig`.
- Reject planner mode flags in doctor commands because doctor does not execute
  planner turns.
- Keep read-only readiness handoff aligned with approval continuation command
  validation.

Known validation:

- `node --experimental-strip-types --test-name-pattern "compact agent result contract" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Human result-card output does not yet summarize provider capability posture.

## 2026-05-05 Result Card Planner Capability Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a result-card planner configuration line for human handoff.
- Summarize LLM provider/model, transport, response format, and streaming
  posture without exposing credentials or request headers.
- Keep rule-based runs summarized by effective planner mode and client name.

Known validation:

- `node --experimental-strip-types --test-name-pattern "tool category approval continuation scope" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Durable docs and packaged skill guidance still need capability wording.

## 2026-05-05 Provider Adapter Boundary Slice

Files added or updated:

- `src/model/provider-adapter.ts`
- `src/model/LLMModelClient.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Move OpenAI-compatible transport details out of `LLMModelClient`.
- Keep `LLMModelClient` responsible for planner prompt construction and
  bounded decision parsing only.
- Add a provider adapter boundary that owns endpoint selection, non-streaming
  JSON request bodies, bearer auth headers, and response content extraction.
- Keep the provider registry scoped to the single supported
  `openai-compatible` planner provider.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLMModelClient|provider adapter|LLM provider capabilities" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Durable docs and package-surface tests still need to describe provider
  capabilities as planner-only contract metadata.

## 2026-05-05 Provider Capability Docs Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document provider capabilities as a narrow planner-client contract.
- Clarify that capability metadata is non-secret, parser-validated handoff data
  and not proof of live provider reachability.
- Preserve the current scope: one `openai-compatible` adapter, no general
  provider platform, no multi-agent runtime, and no live provider tests.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata exposes" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Full verification still needs to run after docs and tests settle.

## 2026-05-05 Provider Capability Verification Slice

Files added or updated:

- `docs/HANDOFF.md`

Purpose:

- Record the completed provider capability development round after code,
  contract, doctor, result-card, docs, and skill slices landed.
- Preserve the final validation status for continuation agents.

Known validation:

- `npm run verify`: passed.
- `npm_config_cache=/tmp/infra-agent-npm-cache npm pack --dry-run --json`: passed.
- `git diff --check`: passed before final verification-record update.

Remaining risks:

- Only `openai-compatible` is supported. Other GPT-compatible gateways are
  usable when they implement the same chat-completions JSON-object contract,
  but no provider-specific adapters exist yet.
- Capability metadata is declarative readiness/handoff data; it does not make a
  live network call to prove model availability.

## 2026-05-05 Provider Default Constants Slice

Files added or updated:

- `src/model/providers.ts`
- `src/model/config.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Move the default LLM model and OpenAI-compatible base URL into the provider
  registry module before adding a public planner provider catalog.
- Keep runtime config and future catalog output sourced from the same constants
  instead of duplicating defaults in CLI/report code.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM planner config resolves" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The catalog command itself is not implemented yet.

## 2026-05-05 Provider Catalog Registry Slice

Files added or updated:

- `src/model/providers.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a deterministic provider catalog builder for the current LLM planner
  adapter registry.
- Keep the catalog scoped to `openai-compatible` and limited to non-secret
  adapter metadata, capabilities, and defaults.
- Return cloned catalog entries so tests and consumers cannot mutate shared
  registry state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "LLM provider catalog" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- CLI/report surfaces for this catalog are still pending.

## 2026-05-05 Planner Provider Catalog Report Slice

Files added or updated:

- `src/cli/planner-provider-catalog.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a read-only `infra-agent.planner-provider-catalog` report builder for
  downstream agent discovery.
- Declare the catalog scope as planner-only, `mutationAllowed=false`, and
  `liveProviderCheck=false`.
- Include CLI/env configuration hints without including env values,
  credentials, bearer headers, or live reachability state.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner provider catalog report" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The report is not yet wired to a CLI command or contract parser.

## 2026-05-05 Planner Provider Catalog Contract Slice

Files added or updated:

- `src/cli/planner-provider-catalog-contract.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add a fail-closed parser for the agent-facing planner provider catalog JSON
  report.
- Validate read-only posture, live-check posture, provider/count consistency,
  supported capability literals, and supported CLI/env hint strings.
- Keep downstream agents from trusting malformed catalog payloads.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner provider catalog contract" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- CLI dispatch and human text output are still pending.

## 2026-05-05 Planner Provider Catalog Text Slice

Files added or updated:

- `src/cli/output.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add concise human text output for the planner provider catalog report.
- Show planner-only/read-only posture, provider capability details, supported
  commands, defaults, flags, and env variable names.
- Avoid credentials, bearer headers, live reachability claims, or workspace
  inspection output.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner provider catalog text" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- CLI dispatch is still pending.

## 2026-05-05 Planner Provider Catalog Parse Slice

Files added or updated:

- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add `infra-agent planner-providers [--json]` to CLI parsing and usage text.
- Keep the command read-only and argument-free except for the existing JSON
  flag.
- Reserve runtime dispatch for a separate slice.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner-providers CLI args" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- The command is parsed but not yet executable from `main()`.

## 2026-05-05 Planner Provider Catalog Dispatch Slice

Files added or updated:

- `src/cli/main.ts`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Wire `infra-agent planner-providers` through the CLI entrypoint.
- Emit text output by default and contract-checked JSON with `--json`.
- Keep the command independent of workspace inspection, environment config
  resolution, LLM clients, and network calls.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner-providers command emits" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Durable docs and skill guidance are still pending.

## 2026-05-05 Planner Provider Catalog Docs Slice

Files added or updated:

- `README.md`
- `docs/AGENT_RULES.md`
- `docs/CLAUDE_CODE_AGENT_PATTERNS.md`
- `docs/ROADMAP.md`
- `skills/infra-configuration/SKILL.md`
- `skills/infra-configuration/references/context-validation-and-impact.md`
- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Document `planner-providers [--json]` as the static, read-only LLM planner
  adapter catalog surface.
- Distinguish catalog metadata from selected planner config, doctor readiness,
  credentials, and live provider reachability.
- Keep package-facing skill guidance aligned with the new command.

Known validation:

- `node --experimental-strip-types --test-name-pattern "package metadata exposes" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Full verification still needs to run after docs settle.

## 2026-05-05 Planner Provider Catalog Secret-Safety Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Prove `planner-providers --json` remains a static catalog even when LLM
  environment variables are configured with secret-looking values.
- Confirm the command does not expose API key values, secret-looking base URL
  tokens, or live provider check posture.

Known validation:

- `node --experimental-strip-types --test-name-pattern "planner-providers command does not expose" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Full verification still needs to run.

## 2026-05-05 Planner Provider Catalog Help Slice

Files added or updated:

- `test/cli-smoke.test.mjs`
- `docs/HANDOFF.md`

Purpose:

- Add CLI help coverage for the new read-only `planner-providers` command.
- Ensure the command remains discoverable through the standard `--help`
  surface before durable docs are updated.

Known validation:

- `node --experimental-strip-types --test-name-pattern "help output includes planner provider" ./test/cli-smoke.test.mjs`: passed.

Remaining risks:

- Durable docs and skill guidance are still pending.
