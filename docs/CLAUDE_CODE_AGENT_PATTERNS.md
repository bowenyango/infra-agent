# Claude Code Agent Patterns

This note records reusable design patterns studied from the local
`learning-claude-code` repository. It is not a source-code dependency; it is a
durable design reference for infra-agent development.

## Patterns To Reuse

- **Session-owned query engine:** Keep one harness object responsible for the
  conversation lifecycle, mutable runtime state, usage accounting, abort
  control, and per-turn transitions. Infra-agent currently uses `runQueryLoop`
  for this role.
- **Structured turn trace:** Preserve a compact per-turn trace with action kind,
  action family, confidence, terminal status, execution status, tool count,
  changed-file count, validation issue count, and approval signal count. This
  gives downstream agents the control-flow shape without exposing the full
  runtime snapshots.
- **Tool result budgets:** Treat tool output as a budgeted resource. Prefer
  small summaries, previews, or persisted artifacts over injecting full command
  output into model context.
- **Static tool prompts plus delta context:** Avoid making tool descriptions
  depend on highly dynamic state when that would break prompt caching. Put
  dynamic listings or discovered context into compact attachments or prompt
  packets instead.
- **Permission gates before mutation:** Classify write, shell, state, and
  external actions before execution. Permission decisions must be represented as
  structured state so the planner can stop, ask, or proceed deterministically.
- **Specialized read-only explorers:** Exploratory work should be explicitly
  read-only, fast, and report-oriented. Search results should be summarized for
  the main harness instead of pulling broad tool noise into the main context.
- **Subagent isolation:** Subagents or forks need explicit scope, lifecycle,
  output files or summaries, permission mode, and ownership rules. They should
  not be allowed to recursively spawn workers unless the harness deliberately
  supports that topology.
- **Context compaction boundaries:** Compaction should preserve durable facts,
  decisions, tool summaries, validation state, and user-visible blockers while
  discarding low-value raw output.

## Infra-Agent Mapping

- `runQueryLoop` is the current session-owned harness. Keep adding durable state
  there instead of spreading control-flow decisions through CLI output code.
- Compact `agent --json` output is the primary agent-to-agent handoff. Add
  small structured sections there before adding prose-only output.
- CLI exit codes are part of the harness contract for automation. Keep
  completed, validation-blocked, approval-required, clarification-required,
  no-safe-action, and repair-budget-exhausted outcomes distinguishable without
  requiring downstream agents to parse prose.
- `validation.selectedPlan` is the compact intended-validation surface. It
  should mirror the domain-focused validation plan, not every validator
  discovered in the workspace, and should stay separate from executed
  validation command output.
- `validation.commands` is the compact executed-validation surface. It should
  keep command status, short previews, and unsafe-command rule metadata under a
  fixed budget instead of passing raw native CLI logs through ordinary handoff
  payloads.
- `validation.issueSummary` is the compact blocker-shape surface. It should
  expose grouped kind/repairability counts, omitted issue/group counts, and
  coarse blocker flags before downstream agents inspect sampled issue messages.
- `validation.issueDetails` is the sampled issue-detail budget surface. It
  should expose max entries and omitted count while `validation.issues` remains
  a capped compatibility detail array.
- Result cards should mirror validation blocker counts from
  `validation.issueSummary` so human handoff can see repairable and
  non-repairable blocker posture without parsing compact JSON first.
- `harness.turnTrace` is the compact turn-transition surface inspired by the
  Claude Code query lifecycle. It intentionally omits full decisions, full
  runtime snapshots, and raw tool output.
- `harness.repairBudget` is the compact bounded-repair surface. It should
  report attempts used, max attempts, remaining attempts, and exhaustion
  without requiring downstream agents to parse result-card prose.
- Execution must keep an approval gate immediately before workspace mutation
  tools. A planner decision that asks to apply an edit while approval is active
  or required must skip execution and return an approval-required handoff rather
  than relying only on planner prompt compliance.
- `harness.stateSummary` is the compact runtime-state boundary. It may expose
  counts for observations, tool summaries, writes, validation, approvals,
  retrieved context, and semantic facts, but it must not expose raw runtime
  arrays or file contents.
- `harness.plannerHandoff` is the compact routing surface. It should derive
  last action, active blocker, and next control action from existing state
  without exposing rationale, raw decision payloads, prompts, or observations.
- `harness.toolTrace` is the budgeted tool-summary surface. It carries recent
  deterministic tool summaries and an omitted count, not full tool outputs.
- Tool summaries should carry explicit permission categories such as workspace
  reads/writes, native CLI validation, native CLI writes, and stack config
  mutation-risk tools. Downstream agents should reason from these categories
  before asking for raw command output.
- Tool-category approval is a harness gate. Keep it explicit in workspace
  policy and run approval scope, and resume with `--approve-tool-category`
  instead of treating native operations as ordinary file writes.
- `approval.resume` is the compact approval-continuation surface. It may report
  the exact scoped command, write risks, write paths, tool categories, and
  signal count, but it must not be interpreted as approval by itself.
- `retrievedContextBudget` and compact `knowledgeContext` summaries are the
  context-compaction boundary for official docs, schemas, and examples. They
  should report packet/token budgets and omissions without exposing raw cached
  documents in ordinary handoff payloads.
- Result cards should mirror the retrieved context budget posture with packet,
  token, and omission counts so human handoff does not require `--json-full`.
- Query config owns context budget knobs. Keep packet/token overrides explicit
  in the harness and CLI instead of adding per-prompt one-off limits.
- `validation.identityConflicts`, `runtimeIdentityConflicts`, and
  `identity-report` are blocker-specific handoff surfaces. They must remain
  review-only until a separate remediation planner and approval model exists.
- LLM and official-doc features must remain testable with injected transports,
  explicit env maps, and cache-first retrieval. Unit/smoke/E2E tests must not
  depend on live provider access.

## Current Non-Goals

- Do not copy Claude Code's general-purpose subagent system into infra-agent
  yet. Infra-agent should first make infrastructure-specific planning,
  validation, and impact analysis reliable.
- Do not build recursive or background worker orchestration until task ownership,
  output summarization, permission propagation, and workspace isolation are
  explicit.
- Do not use compaction to hide missing validators or unresolved infrastructure
  ownership. Validation and approval blockers must survive every handoff.
