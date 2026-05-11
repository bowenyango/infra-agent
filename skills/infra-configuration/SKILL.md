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
`AGENTS.md`, README, and durable docs. Use `infra-agent --version` as a cheap
installation check before running repository-specific commands. Use
`infra-agent planner-providers --json` when another agent needs the static,
read-only LLM planner adapter catalog before choosing model or gateway flags.
When a compact agent result is already available, read
`readiness.plannerProviderCatalog` first and run the catalog command only if
the full catalog is needed or the compact pointer is absent.
Use `infra-agent doctor <workspace> --json` when another agent needs a
structured, read-only readiness report before planning edits. Doctor output verifies the
installed agent-facing surface and may report whether the LLM planner provider
adapter is configured, including non-secret capability metadata, but it must
not expose API keys. If a caller wants to verify a specific OpenAI-compatible
model or gateway before running the agent, pass `--model <name>`,
`--openai-base-url <url>`, and `--llm-provider openai-compatible` to `doctor`;
credentials must still come from environment variables.

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

   To select an OpenAI-compatible planner model for one run, add
   `--model <name>` or `--llm-model <name>` plus
   `--openai-base-url <url>` when using a gateway. Do not pass API keys as CLI
   arguments; use `INFRA_AGENT_OPENAI_API_KEY` or `OPENAI_API_KEY`.
   Use `--context-packet-limit <n>` or `--context-token-budget <n>` when the
   caller needs a stricter retrieved-doc context budget.
   If the result pauses on a tool-category approval, rerun with
   `--approve-tool-category <category>` only after the user approves that native
   operation category.

4. Prefer `--json` when another agent will consume the result. This returns the
   compact `infra-agent.agent-result` payload; reserve `--json-full` for
   debugging the whole runtime state. Treat compact JSON as contract-checked
   handoff data: root task/workspace metadata, `handoffCheckpoint`, query/loop/
   repair budgets, lifecycle/turn/tool trace entries, tool permission summaries,
   readiness checks, validation plan/command/issue/safety/identity summaries,
   knowledge cache/context/fact summaries, approval resume metadata, and planner
   handoff routing must be structurally valid before another agent acts on
   them. Read `handoffCheckpoint` first for compact/read-only posture, raw
   content exclusions, routing summary, section budgets, continuation reason,
   approval command metadata, durable section names, and `mutationAllowed=false`.
   Then read
   `harness.stateSummary` for runtime counts, `harness.targeting` for selected
   target, candidate score posture, ambiguity flags, and recommended targeting
   action, `harness.workPlan` for derived progress steps, skipped-step count,
   current step, and next control action, and `harness.turnTrace` for the bounded action flow. Read
   `harness.plannerConfig` for requested/effective planner mode, non-secret
   provider/model/base URL source metadata, and
   `harness.plannerConfig.llm.capabilities` before assuming JSON response
   support, structured output support, or streaming behavior. Read
   `readiness.plannerProviderCatalog` when present to discover the static,
   read-only catalog command, or run `infra-agent planner-providers --json`
   when no agent result exists yet and you only need the static adapter
   catalog.
   `harness.plannerHandoff` for the
   active blocker and next control action,
   `harness.turnTraceBudget` and
   `harness.lifecycleEvents` for capped lifecycle window/count metadata, and
   `harness.toolTrace` for budgeted tail-window recent tool summaries, first
   and last included turn indexes, and latest tool turn before asking for raw
   logs. Read `harness.repairBudget`
   before starting another repair attempt. Read `harness.toolPermissionSummary`
   to separate workspace writes, native CLI calls, and stack/state mutation-risk
   tools. Read
   `readiness` for planner mode, workspace blocker status, selected validation
   plan status, and validator availability required by that selected plan before
   asking for a full doctor report. If readiness is warn or fail, run the
   suggested read-only `doctorCommand` before asking for more raw logs. Treat
   `readiness.plannerProviderCatalog` as static discovery metadata only: it is
   not a credential report, live provider check, or permission to change
   planner configuration. Read
   `knowledgeCache` for the resolved cache root/source, `knowledgeContext`
   to see which retrieved docs or schemas were included or omitted by context
   budget, and `knowledgeFacts` for bounded extracted facts, omitted fact
   counts, source counts, stale source counts, and unchecked source counts. The
   human result card mirrors packet, token, fact, stale-source,
   unchecked-source, and omission posture without exposing raw excerpts or cache
   payloads. Use `infra-agent knowledge
   sources/prefetch/extract/validate/pack/publish-plan/publish-readiness/backend-readiness/backend-reference-readiness/upload-approval-intent/upload-approval-continuation/upload-adapter-preflight/upload-mock-harness/upload-execution-gate/upload-mutation-plan/upload-mutation-approval-review/upload-execution-prerequisite-plan/upload-write-token-boundary/upload-execution-lease-boundary/upload-rollback-plan-boundary/upload-audit-record-boundary/upload-artifact-bytes-boundary/upload-adapter-injection-boundary/upload-client-creation-boundary/upload-credential-read-boundary/upload-credential-presence-boundary/upload-live-check-boundary/upload-command-boundary` when
   you need reusable provider, resource, chart, module, or Pulumi component
   facts; validate extracted data before planner use and use
   `knowledge validate --workspace <workspace>` before reusing saved
   repo-derived facts after local files may have changed.
   Read the validation report's freshness summary for stale or unchecked local
   source posture before treating saved facts as current.
   Use `knowledge sources` before `knowledge prefetch` to inspect public
   official-doc cache posture without fetching: `fresh` means a cached entry is
   available, `stale` or `missing` means deliberate bounded prefetch may be
   useful, and `local` means no official-doc refresh applies. Prefetch result
   sources include previous cache posture so you can distinguish already-fresh
   cache hits from explicit refreshes or stale-cache fallbacks. Explicit
   official-doc fetches can normalize HTML into compact Markdown cache entries
   for extraction, but raw docs and cache payloads are still excluded from
   planner prompts and compact handoff.
   Treat team artifact storage as an internal abstraction until a real
   backend is explicitly added: local filesystem remains the default, the
   S3-compatible store is currently mocked/injected, and compact
   `infra-agent.knowledge-team-artifact-descriptor` payloads must stay
   backend-neutral and secret-safe. The current backend adapter resolver is
   mock-only; it must not read credentials, perform live checks, expose
   endpoints or buckets, emit upload commands, or mutate remote objects/indexes.
   S3-compatible backend config support is contract-first private parsing only:
   safe structural references can prepare a future adapter design, but they do
   not create a client, read credential values, probe a backend, or approve
   upload.
   The S3-compatible reference registry is also private and offline-only: it
   may match storage/auth refs and validate required environment variable
   names, but it must not read `process.env` values, carry bucket/endpoint
   values, expose credentials, create clients, or approve upload.
   Do not infer that a descriptor approves real remote publication. Use
   `knowledge publish-plan` only as a dry-run review artifact; it does not
   upload, call a store write, or approve future publication. Use
   `knowledge publish-readiness` only to compare a saved plan with an optional
   compact index entry; it does not read or write a real metadata index or
   approve future upload.
   Use `knowledge backend-readiness` only as a dry-run review of a local
   private backend config for future explicit-upload design; it does not
   perform live backend checks, read credential values, write remote objects,
   mutate a metadata index, emit an upload command, or approve upload.
   Use `knowledge backend-reference-readiness` only as a dry-run review of a
   private S3-compatible backend config against a private reference registry;
   it may report required environment variable names, but it does not read
   their values, validate credential presence, probe backend reachability, or
   approve upload.
   Use `knowledge upload-approval-intent` only as a dry-run approval-boundary
   review from saved publication readiness and backend-reference readiness. It
   may report that explicit human upload approval is required, but it does not
   grant approval, read credential values, check credential presence, create
   clients, generate upload commands, or write remote objects/indexes.
   Use `knowledge upload-approval-continuation` only as a dry-run private
   continuation review from a saved upload approval intent plus an explicit
   approval fingerprint. A matching continuation is not upload permission; it
   must keep upload approval, upload execution, client creation, credential
   reads, live checks, and remote writes disabled.
   Use `knowledge upload-adapter-preflight` only as a dry-run private adapter
   dependency review from a saved upload approval continuation plus a saved
   adapter resolution plan. A `preflight-ready` result means a future test
   harness may inject a safe mock adapter dependency; it is not upload
   permission, does not inject an adapter, does not create a client, and does
   not allow credential reads, live checks, upload commands, or remote writes.
   Use `knowledge upload-mock-harness` only as a dry-run private in-memory mock
   harness review from a saved upload adapter preflight. A `harness-ready`
   result may instantiate only the mock descriptor boundary; it is not upload
   permission, does not inject an adapter into upload execution, does not create
   a client, and does not allow credential reads, live checks, upload commands,
   object writes, index writes, or remote writes.
   Use `knowledge upload-execution-gate` only as a dry-run private
   permission/audit review from a saved upload approval continuation plus a
   saved upload mock harness. A `gate-ready` result means the artifact scope
   matches and a later mutation design can request separate approval; it is not
   upload permission, does not allow execution, does not issue write tokens,
   does not create execution leases, does not inject adapters, does not provide
   artifact bytes, and does not allow credential reads, live checks, upload
   commands, object writes, index writes, or remote writes.
   Use `knowledge upload-mutation-plan` only as a dry-run private
   approval-audit plan from a saved upload execution gate. A `plan-ready`
   result means a later human mutation review can be requested; it is not
   mutation approval, does not allow execution, does not issue write tokens,
   does not create leases or rollback plans, does not provide artifact bytes,
   and does not allow adapter injection, client creation, credential reads,
   live checks, upload commands, object writes, index writes, or remote writes.
   Use `knowledge upload-mutation-approval-review` only as a dry-run private
   human fingerprint review record from a saved upload mutation plan plus an
   explicit approval fingerprint. A `review-ready` result records only that the
   exact plan fingerprint was reviewed; it is not mutation approval, does not
   allow execution, does not issue write tokens, does not create leases or
   rollback plans, does not provide artifact bytes, and does not allow adapter
   injection, client creation, credential reads, live checks, upload commands,
   object writes, index writes, or remote writes.
   Use `knowledge upload-execution-prerequisite-plan` only as a dry-run private
   prerequisite boundary plan from a saved upload mutation approval review. A
   `prerequisite-plan-ready` result means required future boundaries were
   modeled, not satisfied: artifact bytes, adapter injection, write token,
   execution lease, rollback plan, and audit record still need separate design.
   It is not mutation approval, does not allow execution, does not issue write
   tokens, does not create leases or rollback plans, does not provide artifact
   bytes, and does not allow adapter injection, client creation, credential
   reads, live checks, upload commands, object writes, index writes, or remote
   writes.
   Use `knowledge upload-write-token-boundary` only as a dry-run private
   write-token boundary plan from a saved upload execution prerequisite plan. A
   `write-token-boundary-ready` result means token requirements were modeled,
   not satisfied: token before execution, artifact scope binding, single-use
   issuance, expiry, audit binding, execution lease precondition, and rollback
   precondition still need separate design. It does not issue or bind a token,
   does not allow execution, does not create leases or rollback plans, does not
   provide artifact bytes, and does not allow adapter injection, client
   creation, credential reads, live checks, upload commands, object writes,
   index writes, or remote writes.
   Use `knowledge upload-execution-lease-boundary` only as a dry-run private
   execution lease boundary plan from a saved upload write-token boundary. A
   `execution-lease-boundary-ready` result means lease requirements were
   modeled, not satisfied: lease before execution, artifact scope binding,
   single-use lease creation, expiry, write-token precondition, audit binding,
   and rollback precondition still need separate design. It does not create a
   lease, issue or bind a token, allow execution, create rollback plans,
   provide artifact bytes, and does not allow adapter injection, client
   creation, credential reads, live checks, upload commands, object writes,
   index writes, or remote writes.
   Use `knowledge upload-rollback-plan-boundary` only as a dry-run private
   rollback plan boundary from a saved upload execution lease boundary. A
   `rollback-plan-boundary-ready` result means rollback requirements were
   modeled, not satisfied: rollback plan before execution, artifact scope
   binding, rollback review, write-token and execution-lease preconditions,
   artifact bytes, audit binding, and audit record precondition still need
   separate design. It does not create a rollback plan, create a lease, issue
   or bind a token, allow execution, provide artifact bytes, and does not
   allow adapter injection, client creation, credential reads, live checks,
   upload commands, object writes, index writes, or remote writes.
   Use `knowledge upload-audit-record-boundary` only as a dry-run private
   audit record boundary from a saved upload rollback plan boundary. An
   `audit-record-boundary-ready` result means audit requirements were modeled,
   not satisfied: audit record before execution, artifact scope binding, audit
   review, write-token, execution-lease, rollback-plan, and artifact-byte
   preconditions still need separate design. It does not create an audit
   record, create a rollback plan, create a lease, issue or bind a token, allow
   execution, provide artifact bytes, and does not allow adapter injection,
   client creation, credential reads, live checks, upload commands, object
   writes, index writes, or remote writes.
   Use `knowledge upload-artifact-bytes-boundary` only as a dry-run private
   artifact-byte boundary from a saved upload audit record boundary. An
   `artifact-bytes-boundary-ready` result means artifact-byte staging
   requirements were modeled, not satisfied: bytes before adapter/execution,
   digest verification, artifact scope binding, and audit, rollback, lease,
   token, and adapter preconditions still need separate design. It does not
   read, hash, stage, or provide bytes, create audit records, create rollback
   plans, create leases, issue or bind tokens, allow execution, inject adapters,
   create clients, read credentials, perform live checks, generate commands, or
   write object/index entries.
   Use `knowledge upload-adapter-injection-boundary` only as a dry-run private
   adapter injection boundary from a saved upload artifact bytes boundary. An
   `adapter-injection-boundary-ready` result means adapter dependency
   requirements were modeled, not satisfied: adapter injection after bytes,
   adapter injection before execution, dependency-injection-only posture, mock
   adapter descriptor, object-store and metadata-index dependencies,
   content-addressed keys, idempotent writes, explicit approval, and client
   creation still need separate design. It does not instantiate or inject
   adapters, bind stores or indexes, create clients, read/hash/stage bytes,
   read credentials, perform live checks, generate commands, or write
   object/index entries.
   Use `knowledge upload-client-creation-boundary` only as a dry-run private
   client creation boundary from a saved upload adapter injection boundary. A
   `client-creation-boundary-ready` result means client creation requirements
   were modeled, not satisfied: client factory descriptor, credential-read
   boundary, credential-presence boundary, live-check boundary, upload-command
   boundary, object-store and metadata-index dependencies, content-addressed
   keys, idempotent writes, and explicit approval still need separate design.
   It does not instantiate SDK clients, inject adapters, bind stores or
   indexes, read/hash/stage bytes, read credentials, check credential
   presence, perform live checks, generate commands, or write object/index
   entries.
   Use `knowledge upload-credential-read-boundary` only as a dry-run private
   credential read boundary from a saved upload client creation boundary. A
   `credential-read-boundary-ready` result means credential read requirements
   were modeled, not satisfied: credential source descriptor,
   credential-reference-only posture, credential value redaction,
   credential-presence boundary, live-check boundary, upload-command boundary,
   client creation boundary, object-store and metadata-index dependencies,
   content-addressed keys, idempotent writes, and explicit approval still need
   separate design. It does not read credential values, check credential
   presence, instantiate SDK clients, inject adapters, bind stores or indexes,
   read/hash/stage bytes, perform live checks, generate commands, or write
   object/index entries.
   Use `knowledge upload-credential-presence-boundary` only as a dry-run
   private credential presence boundary from a saved upload credential read
   boundary. A `credential-presence-boundary-ready` result means credential
   presence requirements were modeled, not satisfied: credential presence
   signal, credential presence result redaction, credential-reference-only
   posture, credential value redaction, live-check boundary, upload-command
   boundary, object-store and metadata-index dependencies, content-addressed
   keys, idempotent writes, and explicit approval still need separate design.
   It does not read credential values, check credential presence, expose
   credential presence results, instantiate SDK clients, inject adapters, bind
   stores or indexes, read/hash/stage bytes, perform live checks, generate
   commands, or write object/index entries.
   Use `knowledge upload-live-check-boundary` only as a dry-run private
   live-check boundary from a saved upload credential presence boundary. A
   `live-check-boundary-ready` result means live-check requirements were
   modeled, not satisfied: read-only live-check policy, credential-presence
   boundary, credential-read boundary, live-check result redaction,
   upload-command boundary, object-store and metadata-index dependencies,
   content-addressed keys, idempotent writes, and explicit approval still need
   separate design or execution approval. It does not probe backend
   reachability, read credential values, check credential presence, expose
   credential presence or live-check results, instantiate SDK clients, inject
   adapters, bind stores or indexes, read/hash/stage bytes, generate commands,
   or write object/index entries.
   Use `knowledge upload-command-boundary` only as a dry-run private upload
   command boundary from a saved upload live check boundary. A
   `upload-command-boundary-ready` result means upload-command requirements
   were modeled, not satisfied: command descriptor, post-live-check command
   generation boundary, command payload/material redaction, command execution
   approval, object-store and metadata-index dependencies, content-addressed
   keys, idempotent writes, and explicit approval still need separate design or
   execution approval. It does not generate or materialize command payloads,
   expose command material, become executable, expose target object keys,
   probe backend reachability, read credential values, check credential
   presence, expose live-check results, instantiate SDK clients, inject
   adapters, bind stores or indexes, read/hash/stage bytes, or write
   object/index entries.
   Use `knowledge upload-object-index-binding-boundary` only as a dry-run
   private object/index binding boundary from a saved upload command boundary.
   An `object-index-binding-boundary-ready` result means object-store and
   metadata-index binding requirements were modeled, not satisfied:
   descriptors, object-key and index-entry redaction, content-addressed keys,
   idempotent writes, execution-boundary requirements, and explicit approval
   still need separate design or execution approval. It does not bind concrete
   stores or indexes, expose handles, generate or materialize command payloads,
   become executable, expose target object keys, read credential values, check
   credential presence, expose live-check results, instantiate SDK clients,
   inject adapters, read/hash/stage bytes, or write object/index entries.
   Treat descriptor, publication-plan, index-entry, and readiness JSON as
   contract-gated handoff payloads: validate them before reuse and do not add
   raw facts, raw source arrays, workspace/cache paths, backend details, or
   upload commands.
   Prefer bounded `knowledgeFacts`/packs over raw docs. Read
   `validation.selectedPlan` for intended domain validators,
   `validation.commands` for executed validation command summaries,
   `validation.issueSummary` for grouped blocker posture, and
   `approval.resume` for the primary approval signal, additional pending
   approval scopes, `pendingScope` counts, scoped continuation command,
   compact/debug JSON continuation commands, query-budget-preserving flags,
   CLI-selected planner flags, and per-signal `additionalCommands`; this
   metadata is not approval by itself.
   Read `approval.grants` separately to see explicit approval scope already
   supplied to the current run; supplied grants do not approve any future
   broader operation, but suggested rerun/export commands preserve them for the
   same task. Read `validation.issueDetails` before assuming the
   sampled `validation.issues` array is complete; the sample plus omitted count
   must match the issue summary. Read `validation.safetyBlockers` first when unsafe validation
   commands or YAML syntax gates are present. For replacement or
   duplicate-provider failures,
   read `validation.identityConflictSummary` and
   `validation.identityConflicts` before raw stderr or long guidance strings.
   The summary is the authoritative total/included/omitted count surface; the
   conflict array is a capped sample with Terraform `resourceAddress` and Pulumi
   `resourceName` locators, `riskCategory` triage grouping, and `reviewSteps`
   for rename vs replacement triage.
   Use `infra-agent identity-report <agent-result.json>` when you need a
   focused read-only incident report from an existing compact result; do not
   pass graph JSON, full debug state, native plan/preview JSON, or raw logs.
   The input must be compact `infra-agent.agent-result` schema version 1.
   The generated `infra-agent.identity-conflict-report` is also contract-checked
   for count consistency and `mutationAllowed=false`. LLM planner prompts may
   include the same blockers as `runtimeIdentityConflictSummary` and
   `runtimeIdentityConflicts`; treat those fields as read-only triage context.
   If `suggestedCommands` includes an `agent --json > agent-result.json` export
   followed by `identity-report agent-result.json --json`, use it as a
   read-only reporting path.
   Use `infra-agent impact-report <graph.json> --json` for a read-only graph
   impact handoff. Prefer `summary.sourceProvenance`,
   `summary.impact.reviewTargetBudget`, omitted review target counts, and
   `mutationAllowed=false` over raw graph traversal when deciding what another
   agent should inspect next.
   Also treat the process exit code as control-flow metadata: `0` succeeded,
   `2` validation-blocked, `3` approval-required, `4` clarification-required,
   `5` no-safe-action, `6` repair-budget-exhausted, and `7` `run` preflight
   blockers. `1` remains fatal CLI/runtime failure.
5. If the result asks for approval, do not work around it. Ask the user or rerun
   with the requested approval flags from `approval.resume` only when the user
   has approved that scope.
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
  Inspect `knowledge sources` cache posture before refreshing public docs, and
  keep refreshes explicit through `knowledge prefetch`/`prefetch` with bounded
  domain, target, and source limits. HTML normalization is a cache-boundary
  helper for explicit fetches; do not introduce agent-loop live refreshes or
  pass raw normalized docs to the planner.
- Treat `knowledgeFacts` as a ranked compact summary: local schemas and required
  fields should appear before examples under small budgets, but facts remain
  advisory and do not replace native validation, plan, preview, or provider
  schema context. Source freshness and fingerprint digest fields are handoff
  signals; stale or unchecked source facts should be revalidated or
  re-extracted and should not be used as high-confidence guidance.
- Treat team artifact descriptors as compact validation artifacts only. They
  may summarize a fresh public-reference pack staged through the mocked store,
  but they must not include buckets, endpoints, credentials, signed URLs,
  absolute workspace paths, raw docs, or raw repo file content.
- Treat team publication plans as non-mutating dry-run review artifacts. A
  blocked plan is useful handoff context, not a failure to work around, and an
  allowed plan is not approval to publish to a real backend.
- Treat team publication readiness reports as compact routing artifacts only.
  `already-published`, `upload-required`, `blocked`, and `conflict` are planning
  states, not permission to execute a remote upload or mutate a metadata index.
- Treat team backend readiness reports as compact routing artifacts only.
  `ready-for-explicit-upload` means the config shape is ready for a future
  explicit upload design; it is not permission to execute a remote upload or
  proof that a remote backend was checked.
- Treat team backend adapter descriptors as internal capability metadata only.
  The current adapter resolver is mock-only and must keep remote writes, live
  checks, credential exposure, and upload commands disabled.
- Treat team artifact contract failures as hard blockers for downstream agents.
  Rebuild or revalidate the compact artifact instead of asking for raw pack
  content or backend details.
- For Terraform local modules, prefer `terraform-module` knowledge facts over
  raw module file reads when the module source is literal and workspace-local.
  These facts describe inputs and outputs only; remote, registry, git, dynamic,
  absolute, and out-of-workspace module sources are outside this local fact path.
- For Pulumi projects, prefer `pulumi-config` knowledge facts over raw
  `Pulumi.yaml` or stack file dumps when choosing config keys, known types,
  defaults, and existing safe values. These facts intentionally omit secure
  stack entries and secret-like keys, and they do not replace `pulumi preview`.
- Keep Pulumi validation preview-only. Do not bootstrap local Pulumi backends,
  initialize stacks, log in, refresh/import, or mutate state during validation.
  Bounded native stack config writes require `native-stack-config-write`
  approval and must not silently initialize stacks.
- For Pulumi Node.js/TypeScript projects, conservative
  `pulumi.ComponentResource` or imported `ComponentResource` class evidence may
  provide local `pulumi-component-input`, `pulumi-component-child-resource`, and
  `pulumi-component-output` facts for constructor args interfaces/types,
  conservative child resource constructors inside detected class bodies, and
  public output properties. Treat these as workspace-private component facts
  with recheckable fingerprints; they skip generated/test/declaration files,
  root-level resources, constructor argument objects, and secret-like fields,
  do not expose raw source, do not cover non-Node languages, dynamic component
  factories, or runtime dataflow, and do not replace `pulumi preview` or
  project type checks.
- For Pulumi projects with safe project-root `@pulumi/*` dependencies, cached
  Pulumi Registry package docs may provide `pulumi-docs-guidance` facts for
  package modules. Treat those facts as public-reference advisory context; they
  help orient package areas but do not prove resource usage, cover component
  internals, or replace local Pulumi config facts and `pulumi preview`.
- For Pulumi projects, deterministic YAML `resources.<name>.type` tokens and
  conservative Node.js/TypeScript project-root `@pulumi/*` import/require plus
  explicit constructor evidence may select Pulumi Registry resource docs and
  cached `argument` facts. Treat those facts as public-reference advisory
  context for resource inputs; package dependencies alone do not prove resource
  usage, component internals and non-Node languages remain outside this path,
  and `pulumi preview` remains authoritative.
- For Helm charts, prefer `chart-metadata` and `chart-dependency` knowledge
  facts over raw `Chart.yaml` or `Chart.lock` reads when choosing chart identity
  or dependency versions. Locked dependencies from `Chart.lock` take precedence
  when available. These facts intentionally omit raw chart YAML, lock digests,
  generated timestamps, and unsafe metadata; they do not replace `helm lint`,
  `helm template`, or chart schema validation.
- For Helm chart docs, cached `chart-docs` markdown may provide
  medium-confidence `chart-value` facts for values tables, bullets, and
  headings. Treat those facts as public-reference advisory context only: they
  rank below local `values.schema.json`, `Chart.yaml`, and `Chart.lock` facts,
  cannot be promoted to high confidence, and must not replace `helm lint`,
  `helm template`, or chart schema validation.

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
