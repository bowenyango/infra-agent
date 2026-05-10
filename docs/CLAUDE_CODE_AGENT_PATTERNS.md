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

| Claude Code pattern | Infra-agent surface |
| --- | --- |
| Streamed compaction without raw tool output | Compact `agent --json` sections plus `handoffCheckpoint.exclusions`, `harness.turnTrace`, `harness.toolTrace`, `validation.commands`, `validation.issues`, `knowledgeContext`, and `knowledgeFacts` |
| Preserved current task and routing state | Root task/workspace metadata, `handoffCheckpoint.summary`, `handoffCheckpoint.continuation`, `harness.loopBudget`, `harness.repairBudget`, `harness.targeting`, `harness.workPlan`, `harness.plannerHandoff`, and CLI exit codes |
| Permission logging before tool execution | `harness.toolTrace.permissionCategoryCounts`, `harness.toolPermissionSummary`, approval signals, and `approval.resume` |
| Restoring durable context after compaction | `handoffCheckpoint.durableSections`, `handoffCheckpoint.budgets`, `readiness`, `readiness.plannerProviderCatalog`, `validation.selectedPlan`, `validation.issueSummary`, `validation.identityConflictSummary`, `knowledgeCache`, `knowledgeContext`, and `knowledgeFacts` |
| Skill base-directory references | Packaged `skills/infra-configuration/SKILL.md` with optional detailed references under `skills/infra-configuration/references/` |

- `runQueryLoop` is the current session-owned harness. Keep adding durable state
  there instead of spreading control-flow decisions through CLI output code.
- Compact `agent --json` output is the primary agent-to-agent handoff. Add
  small structured sections there before adding prose-only output.
- `handoffCheckpoint` is the compact routing checkpoint. It should remain
  read-only and derive from durable compact sections: `summary` gives outcome,
  blocker, next control action, readiness, validation, identity, approval, and
  changed-file counts; `budgets` gives included/omitted section counts;
  `continuation` gives the required next control action and approval command
  metadata; `exclusions` proves raw runtime, preflight, prompt, tool output,
  and knowledge excerpts are not included in ordinary compact handoff.
- Compact handoff sections need parser-enforced contracts before downstream
  agents route on them. Root task/workspace metadata, query/loop/repair
  budgets, lifecycle/tool traces, permission summaries, readiness, validation
  plan/command/issue/safety/identity surfaces, knowledge cache/context,
  approval resume, planner handoff routing, and `handoffCheckpoint`
  summary/budget/continuation consistency should reject malformed or
  inconsistent JSON instead of relying on prose interpretation.
- Team knowledge handoff contracts follow the same rule. Descriptor,
  publication-plan, index-entry, publication-readiness, and backend-readiness
  validators should stay in focused modules behind `knowledge validate`; these
  modules enforce compact/mutation-disallowed payloads and must not grow into
  backend clients, credential readers, live checks, upload command builders, or
  remote index mutators.
- Private team upload approval contracts extend the same permission pattern:
  `upload-approval-intent` can expose a deterministic scope fingerprint, and
  `upload-approval-continuation` can record that the operator supplied a
  matching fingerprint. `upload-adapter-preflight` can review a saved mock
  adapter resolution plan for future dependency injection, and
  `upload-mock-harness` can instantiate only the in-memory mock descriptor
  boundary from a saved preflight. `upload-execution-gate` can compare a saved
  continuation and saved harness for scope consistency, then report only the
  permission/audit state needed before a separate mutation design.
  `upload-mutation-plan` can consume that saved gate and emit a private
  approval-audit plan for a later human mutation review, without granting that
  approval or making the plan executable. `upload-mutation-approval-review`
  can consume that saved plan plus an explicit operator-supplied fingerprint
  and record only that the exact plan fingerprint was reviewed; it still does
  not grant mutation approval or unlock execution. All seven
  remain dry-run routing state with upload approval, upload execution, write
  token issuance, execution lease creation, adapter injection, client creation,
  credential reads, live checks, object/index writes, and remote writes
  disabled.
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
- `validation.safetyBlockers` is the compact validation safety surface. It
  should isolate unsafe validation commands and YAML syntax gates, retain
  mutation-prevented posture, and avoid requiring agents to infer safety state
  from sampled issue prose.
- `validation.issues` is a capped compatibility detail sample. It should stay
  tied to `validation.issueDetails` and `validation.issueSummary` counts so
  downstream agents know when more validation issue detail is omitted.
- Result cards should mirror validation blocker counts from
  `validation.issueSummary` so human handoff can see repairable and
  non-repairable blocker posture without parsing compact JSON first.
- `harness.turnTrace` is the compact turn-transition surface inspired by the
  Claude Code query lifecycle. It intentionally omits full decisions, full
  runtime snapshots, and raw tool output. `harness.turnTraceBudget` should make
  the preserved window and omitted turn count explicit; downstream parsers
  should reject unsupported preserved-window values and inconsistent budget
  totals.
- `harness.toolTrace` is the compact recent-tool surface. It preserves a tail
  window, so `preservedWindow`, `firstIncludedTurnIndex`,
  `lastIncludedTurnIndex`, and `latestTurnIndex` should make truncation
  explicit before another agent asks for full debug state.
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
- `harness.targeting` is the compact target-selection surface. It should expose
  selected target metadata, candidate score posture, ambiguity flags, bounded
  candidate samples, and a recommended targeting action without including raw
  preflight state or becoming a second target-selection engine. Contract parsers
  should validate budget counts, candidate kind/domain coherence, selected
  target consistency with root `primaryTarget`, score-gap arithmetic, and
  ambiguity flag/recommended-action consistency.
- `harness.workPlan` is the derived compact progress surface. It borrows the
  TodoWrite/compaction idea of preserving current progress and next control
  point, but it is not a writable todo store and does not drive execution. It
  should expose bounded readiness, targeting, inspection, edit, validation, and
  handoff steps with status counts including `skippedStepCount`,
  current-step routing, blocker metadata, and `mutationAllowed=false`.
  Contract parsers should validate count arithmetic,
  planner-handoff consistency, outcome/blocker status coherence, and blocker
  metadata placement before another agent routes on it.
- `harness.plannerHandoff` is the compact routing surface. It should derive
  last action, active blocker, and next control action from existing state
  without exposing rationale, raw decision payloads, prompts, or observations.
  Contract parsers should validate last-action enums, active-blocker metadata,
  and outcome-to-control-action consistency before another agent uses it for
  routing.
- `harness.lifecycleEvents` is the budgeted query lifecycle surface. It should
  expose query start, decisions, tool execution, approval gates, and terminal
  outcome plus total/included/omitted and event-kind counts without timestamps,
  full prompts, raw decisions, or raw tool output. Parsers should reject
  unknown event names, non-numeric event counts, and inconsistent included or
  omitted totals so agent-to-agent handoff remains deterministic.
- `harness.toolTrace` is the budgeted tool-summary surface. It carries recent
  deterministic tool summaries plus total/included/omitted and permission
  category counts, not full tool outputs. Contract parsers should validate
  entry shapes, supported permission categories, mutation/approval booleans,
  and budget/category-count consistency.
- `harness.toolPermissionSummary` is the aggregate permission posture. It
  should match `harness.toolTrace.permissionCategoryCounts` and keep workspace
  mutation, external command, external state mutation, and approval-required
  counts explicit.
- Tool summaries should carry explicit permission categories such as workspace
  reads/writes, native CLI validation, native CLI writes, and stack config
  mutation-risk tools. Downstream agents should reason from these categories
  before asking for raw command output.
- Tool-category approval is a harness gate. Keep it explicit in workspace
  policy and run approval scope, and resume with `--approve-tool-category`
  instead of treating native operations as ordinary file writes.
- Pulumi validation/config boundaries follow the same gate. Validation plans
  may run preview-only commands, but they must not bootstrap local backends,
  initialize stacks, log in, refresh/import, or mutate state. Bounded
  `pulumi_config_set` execution is a native stack config mutation, requires
  `native-stack-config-write` approval by default, and must operate inside the
  session-owned `runQueryLoop` harness rather than a second Pulumi runner.
- `approval.resume` is the compact approval-continuation surface. It may report
  the exact scoped command, primary signal, additional pending scope, write
  risks, write paths, tool categories, `pendingScope` counts, per-signal
  additional commands, and signal count, but it must not be interpreted as
  approval by itself. Continuation commands preserve the query-loop budget flags
  so resuming keeps the same bounded harness posture.
- `approval.grants` is the compact supplied-approval surface. It records the
  explicit approval scope passed into the current run for audit and handoff
  explanations, but it must not authorize broader writes or native operations.
  Suggested rerun and export commands preserve those grants so downstream
  agents do not accidentally drop approved scope while repeating the same task.
- `knowledgeCache`, compact `knowledgeContext`, and compact `knowledgeFacts`
  summaries are the context-compaction boundary for official docs, schemas,
  examples, and extracted provider/chart facts. They should report resolved
  cache source, packet/token/fact budgets, source counts, stale counts, and
  omissions without exposing raw cached documents in ordinary handoff payloads.
- `infra-agent knowledge sources/prefetch/extract/validate/pack` is the
  cache-first learning workflow for reusable infrastructure facts. Treat packs
  as bounded advisory planner context; validate them before reuse and do not
  replace provider schemas, plan/preview output, or native validators with pack
  claims.
- Planner prompts and compact output must consume `knowledgeFacts` summaries,
  not raw `KnowledgePack` payloads. `knowledgeFacts.omittedFactCount` and
  `knowledgeFacts.staleSourceCount` are routing signals for asking for a larger
  budget or a deliberate cache refresh.
- Result cards should mirror the retrieved context budget posture with packet,
  token, fact, stale-source, and omission counts so human handoff does not
  require `--json-full`.
- Query config owns context budget knobs. Keep packet/token overrides explicit
  in the harness and CLI instead of adding per-prompt one-off limits.
- `validation.identityConflicts`, `runtimeIdentityConflicts`, and
  `identity-report` are blocker-specific handoff surfaces. They must remain
  review-only until a separate remediation planner and approval model exists.
- `validation.identityConflictSummary` and planner
  `runtimeIdentityConflictSummary` should carry total/included/omitted and
  grouped counts because detail arrays are budgeted handoff samples, not
  exhaustive incident inventories.
- Compact identity conflict parsers should enforce engine/issue-kind alignment,
  supported risk categories, string-valued identity fields, string-only review
  steps, and reporting-only mutation posture before secondary reports trust
  sampled incidents.
- `identity-report` should mirror compact identity conflict summary metadata
  instead of recomputing only from included incidents; otherwise capped details
  look exhaustive after handoff.
- `identity-report` should also validate its generated
  `infra-agent.identity-conflict-report` shape before handoff so read-only
  posture and capped incident counts survive secondary transformations.
- Report commands should have at least one real CLI entrypoint test for JSON
  output so argument parsing, file loading, contract parsing, and serialization
  remain covered as one handoff path.
- `impact-report` should carry source provenance for graph summaries so
  downstream agents can separate workspace-inspection facts from attached
  Terraform plan or Pulumi preview impact data without rerunning native tools.
- `summary.sourceProvenance` should be the graph-level source boundary; derived
  reports may mirror it, but should not recompute conflicting provenance unless
  consuming legacy graphs.
- LLM and official-doc features must remain testable with injected transports,
  explicit env maps, and cache-first retrieval. Unit/smoke/E2E tests must not
  depend on live provider access.
- Planner client selection should be snapshotted once at query entry. Compact
  `harness.plannerConfig` records requested/effective mode plus non-secret LLM
  provider/model/base URL metadata, and approval continuation commands preserve
  CLI-selected planner flags so handoff agents do not silently switch models.
- Provider adapter selection follows the same snapshot-once pattern. Capability
  negotiation is deterministic and visible in `harness.plannerConfig.llm`
  rather than inferred from prompts or raw environment. The adapter boundary is
  only a planner request/response client: it is not Claude Code-style
  subagent orchestration, not recursive delegation, and not a general provider
  marketplace.
- `planner-providers` is a read-only discovery/reporting surface for this
  adapter metadata. It can help downstream routing, but it must not become a
  live reachability probe or a provider marketplace. Doctor JSON and compact
  `readiness.plannerProviderCatalog` may expose only the catalog command,
  static/read-only/live-check posture, counts, and supported provider ids so a
  downstream agent can discover the full catalog without bloating handoff
  payloads.
- Team backend adapter selection follows the same compact-capability pattern.
  The adapter descriptor may expose only safe capability metadata and injected
  object-store/index dependencies; it must not carry provider clients,
  credential values, endpoints, buckets, signed URLs, upload commands, or live
  reachability results. Real backend adapters should be added behind the
  existing contract tests and explicit mutation gates instead of changing the
  public team artifact JSON shapes.
- S3-compatible backend work is currently contract-first private parsing only.
  Resolution plans may state that a future real backend family is recognized,
  but they must fail closed until an explicit adapter implementation, credential
  boundary, and mutation approval model exists. This mirrors Claude Code-style
  handoffs: compact structured state is useful for routing, but it is not proof
  of live provider reachability or permission to mutate infrastructure.
- S3-compatible reference registries are offline routing contracts only. They
  may validate safe storage/auth refs and required environment variable names,
  but they must not read environment values, carry backend endpoints or bucket
  values, or turn a fail-closed resolution plan into a real adapter.
- S3-compatible reference-readiness CLI output should stay in the same compact
  handoff category: useful for local operator review and downstream routing,
  but not evidence that credentials exist, a backend is reachable, or mutation
  has been approved.
- Upload approval intent output is private permission-boundary state. It can
  request explicit human approval after dry-run publication and backend
  reference preconditions are satisfied, but it is not approval itself and must
  not contain provider clients, credential values, credential presence checks,
  upload commands, or remote write permission.

## Current Non-Goals

- Do not copy Claude Code's general-purpose subagent system into infra-agent
  yet. Infra-agent should first make infrastructure-specific planning,
  validation, and impact analysis reliable.
- Do not build recursive or background worker orchestration until task ownership,
  output summarization, permission propagation, and workspace isolation are
  explicit.
- Do not use compaction to hide missing validators or unresolved infrastructure
  ownership. Validation and approval blockers must survive every handoff.
