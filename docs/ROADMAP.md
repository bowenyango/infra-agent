# infra-agent Roadmap

This document is the durable product and engineering plan for future sessions.
It refines the earlier phase plan with the current implementation state and with
runtime patterns learned from `learning-claude-code`.

## Current Baseline

The repository already has a working TypeScript CLI skeleton with:

- `inspect`, `validate`, `run`, and bounded `agent` commands
- workspace inspection for Helm, Pulumi, and Terraform
- domain-focused targeting and validation selection
- a query loop with planner mode selection and bounded turn config
- controlled file tools and validation tools
- edit plans for selected Helm, Pulumi, and Terraform config workflows
- approval signals for higher-risk writes
- fixtures and smoke tests across mixed-domain workspaces

Recent implementation slices are documented in `docs/HANDOFF.md`. Future
sessions must preserve committed work and any newly discovered uncommitted
changes unless the user explicitly asks to rewrite history or discard work.

## Product Target

`infra-agent` should become an installable CLI and an agent-facing skill package
for infrastructure configuration work. It is not a general coding assistant.

The CLI should help Infra and non-Infra users:

- inspect an existing infrastructure repo
- infer repository-specific conventions from concrete files
- retrieve only task-relevant official and local context
- generate or modify Helm, Pulumi, and Terraform configuration
- validate syntax, schema, module inputs, and provider constraints
- explain update, replace, rename, and dependency impact before deployment
- stop before destructive operations or state mutations unless explicitly approved

## Claude Code Patterns To Keep

Borrow the runtime architecture, not the full product surface.

- Snapshot immutable query config at loop entry.
- Keep mutable runtime state separate from config.
- Treat tool calls and tool results as first-class events.
- Write tool results back into state in one deterministic place.
- Preserve permission and approval facts as structured state.
- Use progressive disclosure for context: metadata first, detailed references only
  when needed.
- Keep agent-facing skills lean; move detailed domain references behind links.
- Summarize tool activity for operator visibility without making summaries part of
  correctness.

Avoid copying these into v0:

- multi-agent orchestration
- background daemon behavior
- chat or terminal UI productization
- broad coding-agent tools
- speculative autonomous deploy/apply flows

## Architecture Target

The product should settle into seven layers.

1. **Installable CLI**
   - publishable package shape
   - stable `bin/infra-agent.js`
   - compact JSON output for other agents
   - clear exit codes for blocked, failed validation, and completed runs

2. **Agent Skill Surface**
   - bundled `skills/infra-configuration/SKILL.md`
   - instructions for other agents to call the CLI instead of hand-editing IaC
   - minimal trigger metadata and deeper references loaded only when needed

3. **Harness Runtime**
   - immutable `QueryLoopConfig`
   - mutable `AgentRuntimeState`
   - bounded planner decisions
   - deterministic tool-result writeback
   - approval and policy gates before writes or state suggestions

4. **Repository and Domain Tools**
   - repository search/read/write tools
   - Helm, Pulumi, and Terraform inspection adapters
   - native CLI wrappers with structured outputs
   - safe shell boundaries for validation only

5. **Knowledge and Context System**
   - version-aware local cache for official docs and examples
   - dynamic retrieval for missing or stale official material
   - structured extraction of provider/resource/chart/module facts from cached
     docs, schemas, examples, and repo-local code
   - repo-local facts as the highest priority source
   - provider, module, and chart schemas preferred over prose where available
   - opt-in team cache backends after the local fact schema is stable

6. **Semantics and Validation Layer**
   - YAML syntax parsing before any YAML write is accepted
   - Helm schema/lint/template validation
   - Terraform fmt/validate plus provider/module schema extraction
   - Pulumi config/preview plus language-level checks when project type is known
   - semantic constraints for exclusive options, required companions, defaults,
     replacement risk, and dependency relationships

7. **Change Impact and Graph Layer**
   - normalized infra graph JSON first
   - state/rename impact analysis before any web UI
   - local topology visualization only after graph data is reliable

## Knowledge Strategy

Use a hybrid model.

Do not bundle full official docs into the package. Full docs go stale, create a
large install, and can mismatch provider versions. Instead:

- bundle only durable retrieval logic, parsers, validation adapters, and small
  hand-authored rules
- persist official docs, examples, schemas, and summaries in a local versioned
  cache
- dynamically fetch or refresh official sources when the cache is missing, stale,
  or for a different provider/chart/package version
- reuse repo-local cached facts only after path/hash fingerprints still match
  the current workspace
- always prefer repo-local files, lockfiles, installed provider schemas, chart
  schemas, and validator output over generic docs prose

The cache key should include at least:

- source kind: `terraform-registry`, `pulumi-docs`, `helm-docs`, `chart-docs`,
  `repo-example`, or `module-readme`
- provider, module, chart, or package name
- resolved version or version constraint
- URL or local path
- content hash or ETag when available
- fetched time and stale-after policy

The planner should receive small retrieved context packets, not whole documents.
Each packet should include source, version, confidence, excerpt or structured
schema facts, and why it was selected.

## Knowledge Extraction And Storage Plan

This is a core product area. Infrastructure agents become materially better
when they can reuse source-linked, versioned, validated facts about providers,
resources, modules, components, and charts instead of relearning the same public
or repository-local material on every run.

Current progress as of 2026-05-09:

| Area | Status | Current capability | Main gap |
| --- | --- | --- | --- |
| Local knowledge cache | Partial | Version-aware local JSON entries with source metadata, content hash, stale-after policy, cache-root resolution, and fingerprint-checked reuse for repo-local extraction outputs | No structured fact index or remote backend |
| Official docs source selection | Partial | Terraform Registry source selection for used resources/data sources; Helm source selection from `values.schema.json`, `Chart.yaml`, and `Chart.lock`; Pulumi source selection for project config, YAML runtime official docs, package-level Pulumi Registry docs from project manifests, and resource-level Pulumi Registry docs from deterministic Pulumi YAML resource tokens plus conservative Node.js/TypeScript import/require constructor evidence | Pulumi resource-level docs source selection is not yet component, dynamic alias/dataflow, generated-code, or non-Node-language coverage |
| Official docs retrieval | Partial | Explicit `prefetch` and `knowledge prefetch` can fetch bounded official/external sources through mocked-testable fetchers; public URL-backed docs get a default stale-after policy; HTML official-doc responses are normalized into compact Markdown cache entries in the explicit fetch path; `knowledge sources` reports fresh/stale/missing cache posture without fetching; prefetch results report previous cache posture for each source | Agent loop remains cache-only for automatic runs; live refresh is still deliberate |
| Repo-local semantics | Partial | Helm schema, Helm chart metadata/dependency facts, Terraform variables/validation blocks, Pulumi stack config, local Terraform provider schema exports, local Terraform module interface facts, conservative Node.js/TypeScript Pulumi component interface and child-resource facts, and bounded Helm schema knowledge packs | Non-Node Pulumi component discovery and dynamic/deeper component internals are not implemented |
| Structured knowledge extraction | Partial | Normalized `KnowledgeFact` / `KnowledgeFactSet` contracts plus cache-first extraction, validation, bounded packs, runtime fact loading, planner prompt summaries, compact `knowledgeFacts`, result-card counts, deterministic fact ranking, focused Terraform provider schema facts, local Terraform module input/output facts, Pulumi config facts, Pulumi component input/output/child-resource facts, cached Pulumi config/YAML/package/resource docs facts selected from YAML and Node.js/TypeScript constructor evidence, local Helm metadata/dependency facts, cached Helm chart-doc markdown `chart-value` facts, and structured local freshness summaries for stale or unchecked repo-derived facts | Non-Node Pulumi language discovery, dynamic/deeper component internals, and real team storage backends are pending |
| Team storage | Partial | Cache root can be local, environment-selected, or workspace-relative; persisted knowledge artifacts can emit plan-only manifests with byte-level artifact hashes, storage policy, publishable/blocked source ids, remote writes disabled, and validation that rechecks referenced artifact bytes plus repo-local source fingerprints; public-reference knowledge packs can be staged through an injected mocked S3-compatible content-addressed store and compact descriptor validation; `knowledge publish-plan` emits a non-mutating dry-run publication plan for persisted pack manifests; `knowledge publish-readiness` emits a local readiness report from a saved plan and optional compact index entry; contract tests lock descriptor, publication-plan, index-entry, and readiness JSON shapes; `knowledge backend-readiness` emits compact dry-run readiness for local private backend configs without live checks or credential values; `knowledge backend-reference-readiness` emits private dry-run validation for S3-compatible config refs against an offline reference registry without reading env values; `knowledge upload-approval-intent` emits private dry-run approval-boundary state and a safe scope fingerprint from saved publication readiness plus saved backend-reference readiness without granting approval or checking credentials; `knowledge upload-approval-continuation` records a matching explicit fingerprint as private dry-run continuation state while keeping upload/client execution disabled; `knowledge upload-adapter-preflight` reviews a saved continuation plus saved mock adapter resolution plan for future dependency injection while keeping upload/client/adapter execution disabled; `knowledge upload-mock-harness` reads a saved preflight and builds an in-memory mock adapter harness contract while keeping adapter injection, object writes, index writes, clients, credentials, live checks, and upload commands disabled; `knowledge upload-execution-gate` reads saved continuation plus saved mock harness artifacts, verifies matching artifact scope, and emits dry-run permission/audit state while keeping upload approval, execution, write tokens, execution leases, adapter injection, clients, credentials, live checks, artifact bytes, commands, and object/index writes disabled; `knowledge upload-mutation-plan` reads a saved execution gate and emits a private approval-audit dry-run plan for a later human mutation review while keeping approval, execution, tokens, leases, artifact bytes, adapters, clients, credentials, commands, and object/index writes disabled; `knowledge upload-mutation-approval-review` reads a saved mutation plan plus an explicit approval fingerprint and records only that the exact plan fingerprint was reviewed while keeping mutation approval, execution, tokens, leases, artifact bytes, adapters, clients, credentials, commands, and object/index writes disabled; `knowledge upload-execution-prerequisite-plan` reads a saved mutation approval review and records the remaining execution prerequisites while keeping every upload/mutation path disabled; `knowledge upload-write-token-boundary` reads a saved prerequisite plan and records scoped, single-use, expiring, audit-bound write-token requirements while keeping token issuance, leases, artifact bytes, adapters, clients, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-execution-lease-boundary` reads a saved write-token boundary and records scoped, single-use, expiring, audit-bound execution lease requirements while keeping lease creation, token issuance, rollback plans, artifact bytes, adapters, clients, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-rollback-plan-boundary` reads a saved execution lease boundary and records scoped rollback-plan requirements while keeping rollback creation, lease creation, token issuance, artifact bytes, adapters, clients, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-audit-record-boundary` reads a saved rollback plan boundary and records scoped audit-record requirements while keeping audit creation, rollback creation, lease creation, token issuance, artifact bytes, adapters, clients, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-artifact-bytes-boundary` reads a saved audit record boundary and records local artifact-byte staging requirements while keeping byte reads/staging/provision, adapters, clients, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-adapter-injection-boundary` reads a saved artifact bytes boundary and records adapter dependency-injection requirements while keeping adapter instantiation/injection, client creation, byte reads/staging/provision, credentials, commands, object writes, index writes, and remote mutation disabled; `knowledge upload-client-creation-boundary` reads a saved adapter injection boundary and records client creation requirements while keeping SDK client creation, adapter injection, credential reads/presence checks, live checks, command generation, object-store binding, metadata-index binding, byte reads/staging/provision, object writes, index writes, and remote mutation disabled; `knowledge upload-credential-read-boundary` reads a saved client creation boundary and records credential-read requirements while keeping credential value reads, credential presence checks, SDK client creation, adapter injection, live checks, command generation, object-store binding, metadata-index binding, byte reads/staging/provision, object writes, index writes, and remote mutation disabled; `knowledge upload-credential-presence-boundary` reads a saved credential read boundary and records credential-presence requirements while keeping credential value reads, credential presence checks, SDK client creation, adapter injection, live checks, command generation, object-store binding, metadata-index binding, byte reads/staging/provision, object writes, index writes, and remote mutation disabled; `knowledge upload-live-check-boundary` reads a saved credential presence boundary and records live-check requirements while keeping credential value reads, credential presence checks, live checks, live-check result exposure, SDK client creation, adapter injection, command generation, object-store binding, metadata-index binding, byte reads/staging/provision, object writes, index writes, and remote mutation disabled; team artifact, backend-readiness, upload-intent, upload-continuation, upload-adapter-preflight, upload-mock-harness, upload-execution-gate, upload-mutation-plan, upload-mutation-approval-review, upload-execution-prerequisite-plan, upload-write-token-boundary, upload-execution-lease-boundary, upload-rollback-plan-boundary, upload-audit-record-boundary, upload-artifact-bytes-boundary, upload-adapter-injection-boundary, upload-client-creation-boundary, upload-credential-read-boundary, upload-credential-presence-boundary, and upload-live-check-boundary validators are split into focused modules behind the `knowledge validate` dispatcher; an internal team backend adapter interface now exposes mock-only capability descriptors, object-store/index dependencies, and a resolver that rejects credential, backend-detail, live-check, and remote-write leakage; the first S3-compatible backend family has a private contract parser, offline reference registry for storage/auth refs and required environment variable names, sanitized descriptor, readiness-input projection, fail-closed resolution plan, and mock-backed adapter conformance tests | No real S3/GCS/Azure/Postgres backend implementation, no remote metadata index service, no SDK client, no credential read, no credential presence check, no live backend check, and no CLI upload/publication command |

2026-05-10 addendum: `knowledge upload-command-boundary` now consumes a saved
private live-check boundary and emits a validated dry-run upload-command
boundary with command descriptor/redaction/approval requirements, object and
index dependency requirements, content-addressed key requirements, idempotent
write requirements, and explicit approval requirements. It keeps command
generation, command materialization/exposure, executable state, credential
reads, credential presence checks, live checks, SDK client creation, adapter
injection, byte staging, object/index writes, and remote mutation disabled; the
target object key is redacted from the output. Its validator is also wired into
the `knowledge validate` dispatcher.

2026-05-10 addendum: `knowledge upload-object-index-binding-boundary` now
consumes a saved private upload-command boundary and emits a validated dry-run
object/index binding boundary with object-store descriptor, metadata-index
descriptor, object-key redaction, metadata-index entry redaction,
content-addressed key, idempotent write, execution-boundary, and explicit
approval requirements. It keeps concrete store/index binding, handle exposure,
command generation/materialization/exposure, executable state, credential
reads, credential presence checks, live checks, SDK client creation, adapter
injection, byte staging, object/index writes, and remote mutation disabled;
the target object key remains redacted from the output. Its validator is also
wired into the `knowledge validate` dispatcher.

Target artifact families:

- `infra-agent.knowledge-source`: selected source metadata for official docs,
  local schemas, examples, module READMEs, and chart metadata.
- `infra-agent.knowledge-cache-entry`: raw or lightly normalized fetched/local
  content, stored by version-sensitive source id.
- `infra-agent.knowledge-facts`: extracted facts such as provider/resource
  arguments, required attributes, defaults, enum-like values, nested blocks,
  replacement-sensitive fields, identity fields, examples, chart values, module
  inputs/outputs, Pulumi component config shape, chart metadata, and chart
  dependencies.
- `infra-agent.knowledge-pack`: a bounded, validated bundle of facts for one
  provider version, resource type, chart version, module, component, or repo
  target. Repo-local pack sources carry compact safe path/hash fingerprints so
  reuse can be rejected when local files change.
- `infra-agent.knowledge-artifact-manifest`: a plan-only publication manifest
  for persisted extraction or pack artifacts. It records byte-level artifact
  hash, storage-policy summary, publishable-by-default source ids, blocked
  source ids and reasons, required validation commands, and
  `remoteWriteAllowed=false`. Validation re-reads the referenced artifact and
  rejects byte-hash or metadata drift before reuse/publication planning.
- `infra-agent.knowledge-team-artifact-descriptor`: a compact descriptor for a
  staged public-reference knowledge pack in an injected team artifact store. It
  records backend kind, content-addressed object key, byte hash, byte length,
  counts, storage-policy summary, and publication counts without backend URLs,
  buckets, endpoints, credentials, absolute workspace paths, raw docs, or raw
  repo content.
- `infra-agent.knowledge-team-publication-plan`: a dry-run publication review
  artifact for persisted knowledge-pack manifests. It rechecks manifest byte
  hash and metadata, previews the content-addressed object key, records
  allowed/blocked publication posture, and keeps `remoteWriteAllowed=false`
  without calling a store or including backend URLs, buckets, endpoints,
  credentials, absolute workspace paths, raw docs, or raw repo content.
- `infra-agent.knowledge-team-artifact-index-entry`: a compact metadata index
  record derived from a validated team artifact descriptor. It records the
  backend kind, index key, object key, byte hash, byte length, artifact counts,
  storage-policy summary, and publication counts without backend URLs, buckets,
  endpoints, credentials, absolute workspace paths, raw docs, or raw repo
  content.
- `infra-agent.knowledge-team-publication-readiness`: a local dry-run readiness
  report derived from a publication plan and optional compact index entry. It
  reports `already-published`, `upload-required`, `blocked`, or `conflict`
  posture and keeps `remoteWriteAllowed=false` without reading or writing a real
  remote index.
- `infra-agent.knowledge-team-backend-readiness`: a compact dry-run backend
  readiness report derived from a local private backend config. It records
  structural readiness for a future explicit upload design while keeping
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, and `uploadCommand=null`; it does not expose
  backend URLs, buckets, endpoints, headers, credential values, absolute local
  paths, raw docs, facts, or source arrays.
- `infra-agent.knowledge-team-upload-adapter-preflight`: a private dry-run
  adapter dependency preflight derived from a saved upload approval continuation
  and a saved backend adapter resolution plan. It can report
  `preflight-ready` only for a continuation-ready artifact plus a resolvable
  mock adapter plan, while keeping upload approval, upload execution, adapter
  injection, client creation, credential reads, live checks, remote writes, and
  upload commands disabled.
- `infra-agent.knowledge-team-upload-mock-harness`: a private dry-run in-memory
  mock harness summary derived from a saved upload adapter preflight. It can
  report `harness-ready` only for a safe mock preflight and records that object
  writes, metadata index writes, remote mutations, SDK clients, credential
  reads, live checks, upload commands, and adapter injection are disabled.
- `infra-agent.knowledge-team-upload-execution-gate`: a private dry-run
  permission/audit gate derived from a saved upload approval continuation and a
  saved upload mock harness. It can report `gate-ready` only when both inputs
  are ready and describe the same manifest id, object key, object hash, and
  artifact id, while write tokens, execution leases, upload approval, upload
  execution, adapter injection, artifact bytes, object writes, metadata index
  writes, SDK clients, credential reads, live checks, and upload commands stay
  disabled.
- `infra-agent.knowledge-team-upload-mutation-plan`: a private dry-run
  approval-audit plan derived from a saved upload execution gate. It can report
  `plan-ready` only when the gate is ready and sanitized, while mutation
  approval, upload execution, artifact bytes, write tokens, execution leases,
  rollback-plan creation, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-mutation-approval-review`: a private
  dry-run human fingerprint review record derived from a saved upload mutation
  plan and an explicit operator-supplied approval fingerprint. It can report
  `review-ready` only when the plan is ready and the fingerprint matches the
  deterministic mutation-plan approval-audit fingerprint, while mutation
  approval, upload execution, artifact bytes, write tokens, execution leases,
  rollback-plan creation, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-execution-prerequisite-plan`: a private
  dry-run execution prerequisite boundary plan derived from a saved mutation
  approval review. It can report `prerequisite-plan-ready` only when the review
  is ready, human review is recorded, and the fingerprint is verified. It
  records artifact bytes, adapter injection, write token, execution lease,
  rollback plan, and audit record as future required boundaries, while mutation
  approval, upload execution, artifact bytes, write tokens, execution leases,
  rollback-plan creation, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-write-token-boundary`: a private dry-run
  write-token boundary plan derived from a saved execution prerequisite plan.
  It can report `write-token-boundary-ready` only when the prerequisite plan is
  ready and the prior review signal remains verified. It records token-before-
  execution, artifact scope binding, single-use issuance, expiry, audit
  binding, execution lease precondition, and rollback precondition as future
  required boundaries, while token issuance, token binding, token expiry,
  mutation approval, upload execution, artifact bytes, execution leases,
  rollback-plan creation, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-execution-lease-boundary`: a private
  dry-run execution lease boundary plan derived from a saved write-token
  boundary. It can report `execution-lease-boundary-ready` only when the
  write-token boundary is ready and the prior review signal remains verified.
  It records lease-before-execution, artifact scope binding, single-use lease
  creation, expiry, write-token precondition, audit binding, and rollback
  precondition as future required boundaries, while lease creation, token
  issuance, token binding, rollback-plan creation, mutation approval, upload
  execution, artifact bytes, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-rollback-plan-boundary`: a private
  dry-run rollback plan boundary derived from a saved execution lease
  boundary. It can report `rollback-plan-boundary-ready` only when the lease
  boundary is ready and the prior review signal remains verified. It records
  rollback-plan before execution, artifact scope binding, rollback review,
  write-token and execution-lease preconditions, artifact bytes, audit binding,
  and audit record precondition as future required boundaries, while rollback
  creation, lease creation, token issuance, mutation approval, upload
  execution, artifact bytes, adapter injection, SDK clients, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-audit-record-boundary`: a private dry-run
  audit record boundary derived from a saved rollback plan boundary. It can
  report `audit-record-boundary-ready` only when the rollback boundary is ready
  and the prior review signal remains verified. It records audit-record before
  execution, artifact scope binding, audit review, write-token,
  execution-lease, rollback-plan, and artifact-byte preconditions as future
  required boundaries, while audit creation, rollback creation, lease creation,
  token issuance, mutation approval, upload execution, artifact bytes, adapter
  injection, SDK clients, credential reads, live checks, upload commands,
  object writes, metadata index writes, and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-artifact-bytes-boundary`: a private
  dry-run artifact-byte boundary derived from a saved audit record boundary. It
  can report `artifact-bytes-boundary-ready` only when the audit boundary is
  ready and the prior review signal remains verified. It records future
  artifact-byte staging requirements, digest verification, artifact scope
  binding, audit, rollback, lease, token, and adapter-injection preconditions,
  while byte reading, byte staging, digest verification, audit creation,
  rollback creation, lease creation, token issuance, mutation approval, upload
  execution, adapter injection, SDK clients, credential reads, live checks,
  upload commands, object writes, metadata index writes, and remote mutations
  stay disabled.
- `infra-agent.knowledge-team-upload-adapter-injection-boundary`: a private
  dry-run adapter injection boundary derived from a saved artifact bytes
  boundary. It can report `adapter-injection-boundary-ready` only when the
  artifact bytes boundary is ready, the prior review signal remains verified,
  and the adapter backend remains the mock S3-compatible boundary. It records
  future adapter dependency requirements, dependency-injection-only posture,
  mock adapter descriptor, object-store and metadata-index dependencies,
  content-addressed key requirements, idempotent write requirement, explicit
  approval requirement, and client-creation precondition, while adapter
  instantiation/injection, client creation, byte staging, credential reads,
  live checks, upload commands, object writes, metadata index writes, and
  remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-client-creation-boundary`: a private
  dry-run client creation boundary derived from a saved adapter injection
  boundary. It can report `client-creation-boundary-ready` only when the
  adapter injection boundary is ready, the prior review signal remains
  verified, and the adapter backend remains the mock S3-compatible boundary.
  It records future client factory requirements, credential-read and
  credential-presence boundary requirements, live-check and upload-command
  boundary requirements, object-store and metadata-index dependencies,
  content-addressed key requirements, idempotent write requirement, and
  explicit approval requirement, while SDK client creation, adapter injection,
  credential reads, credential presence checks, live checks, command
  generation, store/index binding, byte staging, object writes, metadata index
  writes, and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-credential-read-boundary`: a private
  dry-run credential read boundary derived from a saved client creation
  boundary. It can report `credential-read-boundary-ready` only when the
  client creation boundary is ready, the prior review signal remains verified,
  and the adapter backend remains the mock S3-compatible boundary. It records
  future credential source descriptor requirements, credential reference-only
  posture, credential value redaction requirement, credential-presence
  boundary requirement, live-check and upload-command boundary requirements,
  client-creation boundary requirement, object-store and metadata-index
  dependencies, content-addressed key requirements, idempotent write
  requirement, and explicit approval requirement, while credential value reads,
  credential exposure, credential presence checks, SDK client creation,
  adapter injection, live checks, command generation, store/index binding, byte
  staging, object writes, metadata index writes, and remote mutations stay
  disabled.
- `infra-agent.knowledge-team-upload-credential-presence-boundary`: a private
  dry-run credential presence boundary derived from a saved credential read
  boundary. It can report `credential-presence-boundary-ready` only when the
  credential read boundary is ready, the prior review signal remains verified,
  and the adapter backend remains the mock S3-compatible boundary. It records
  future credential presence signal requirements, credential presence result
  redaction requirement, credential-reference-only posture, credential value
  redaction requirement, live-check and upload-command boundary requirements,
  object-store and metadata-index dependencies, content-addressed key
  requirements, idempotent write requirement, and explicit approval
  requirement, while credential value reads, credential exposure, credential
  presence checks, SDK client creation, adapter injection, live checks, command
  generation, store/index binding, byte staging, object writes, metadata index
  writes, and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-live-check-boundary`: a private dry-run
  live-check boundary derived from a saved credential presence boundary. It can
  report `live-check-boundary-ready` only when the credential presence boundary
  is ready, the prior review signal remains verified, and the adapter backend
  remains the mock S3-compatible boundary. It records future live-check
  requirements, read-only live-check policy, credential-presence and
  credential-read boundary requirements, credential and credential-presence
  result redaction, upload-command boundary requirement, object-store and
  metadata-index dependencies, content-addressed key requirements, idempotent
  write requirement, and explicit approval requirement, while credential value
  reads, credential exposure, credential presence checks, SDK client creation,
  adapter injection, live checks, live-check result exposure, command
  generation, store/index binding, byte staging, object writes, metadata index
  writes, and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-command-boundary`: a private dry-run
  upload command boundary derived from a saved live-check boundary. It can
  report `upload-command-boundary-ready` only when the live-check boundary is
  ready, the prior review signal remains verified, and the adapter backend
  remains the mock S3-compatible boundary. It records future upload-command
  descriptor, post-live-check command-generation, command payload/material
  redaction, command execution approval, object-store and metadata-index
  dependency, content-addressed key, idempotent write, and explicit approval
  requirements, while command generation/materialization/exposure, executable
  command state, credential reads, credential presence checks, SDK client
  creation, adapter injection, live checks, live-check result exposure,
  store/index binding, byte staging, object writes, metadata index writes, and
  remote mutations stay disabled. The target object key is intentionally
  redacted from this boundary output.
- `infra-agent.knowledge-team-upload-object-index-binding-boundary`: a private
  dry-run object/index binding boundary derived from a saved upload-command
  boundary. It can report `object-index-binding-boundary-ready` only when the
  upload-command boundary is ready, the prior review signal remains verified,
  the target remains safe and object-key-redacted, and the adapter backend
  remains the mock S3-compatible boundary. It records future object-store and
  metadata-index descriptors, object-key and index-entry redaction,
  content-addressed key, idempotent write, execution-boundary, and explicit
  approval requirements, while concrete store/index binding, handle exposure,
  command generation/materialization/exposure, executable command state,
  credential reads, credential presence checks, SDK client creation, adapter
  injection, live checks, byte staging, object writes, metadata index writes,
  and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-execution-readiness-boundary`: a private
  dry-run execution readiness boundary derived from a saved object/index
  binding boundary. It can report `upload-execution-readiness-boundary-ready`
  only when the object/index boundary is ready, the prior review signal remains
  verified, the target remains safe and object-key-redacted, and the adapter
  backend remains the mock S3-compatible boundary. It records final future
  execution requirements plus separate upload execution approval, while upload
  approval, upload execution approval, upload execution, command generation,
  token issuance, lease creation, rollback creation, audit creation, byte
  staging, adapter injection, SDK client creation, credential reads,
  credential presence checks, live checks, store/index binding, object writes,
  metadata index writes, and remote mutations stay disabled.
- `infra-agent.knowledge-team-upload-execution-approval-request`: a private
  dry-run human upload execution approval request derived from a saved
  execution readiness boundary. It can report
  `upload-execution-approval-request-ready` only when the readiness boundary is
  ready, reviewed, scope-matched, and still fully non-executing. It emits a
  deterministic SHA-256 approval request fingerprint for later human review
  while keeping human approval recorded, approval granted, upload execution
  approval, upload execution, command generation, token issuance, leases,
  rollback, audit records, byte staging, adapter injection, SDK client
  creation, credential reads, credential presence checks, live checks,
  store/index binding, object writes, metadata index writes, and remote
  mutations disabled.
- `infra-agent.knowledge-team-upload-execution-approval-record`: a private
  dry-run human upload execution approval record derived from a saved approval
  request plus an explicit operator-supplied fingerprint. It can report
  `upload-execution-approval-record-ready` only when the approval request is
  ready, still non-executing, and the supplied SHA-256 fingerprint exactly
  matches the approval request fingerprint. It records human approval
  fingerprint verification for the local plan chain, while keeping approval
  granted, upload execution approval, upload execution, command generation,
  token issuance, leases, rollback, audit records, byte staging, adapter
  injection, SDK client creation, credential reads, credential presence checks,
  live checks, store/index binding, object writes, metadata index writes, and
  remote mutations disabled.
- `infra-agent.knowledge-team-upload-execution-authorization-boundary`: a
  private dry-run upload execution authorization boundary derived from a saved
  human upload execution approval record. It can report
  `upload-execution-authorization-boundary-ready` only when the approval record
  is ready, still non-executing, and its human approval fingerprint remains
  verified. It records only that a later Plan/Rules update must explicitly
  review the upload execution boundary, while approval grants, upload execution
  authorization, upload execution, command generation, token issuance, leases,
  rollback, audit records, byte staging, adapter injection, SDK client
  creation, credential reads, credential presence checks, live checks,
  store/index binding, object writes, metadata index writes, and remote
  mutations stay disabled.
- `infra-agent.knowledge-team-upload-execution-plan-rules-review`: a private
  dry-run Plan/Rules update review artifact derived from a saved upload
  execution authorization boundary. It can report
  `upload-execution-plan-rules-review-ready` only when the authorization
  boundary is ready, still non-executing, and its next action is
  `await-plan-rules-update-for-upload-execution`. It records only the safe
  review checklist for a future explicit Plan/Rules update; it is not Plan/Rules
  approval, upload execution approval, upload execution authorization, command
  generation, object/index binding, or remote write permission.
- `infra-agent.knowledge-team-upload-execution-plan-rules-update-record`: a
  private dry-run Plan/Rules update record derived from a saved Plan/Rules
  review artifact plus an explicit operator-supplied review fingerprint. It can
  report `upload-execution-plan-rules-update-record-ready` only when the review
  artifact is ready, still non-executing, and the supplied SHA-256 fingerprint
  exactly matches the review fingerprint. It records only local fingerprint
  verification for the policy-update chain; it is not upload execution
  approval, upload execution authorization, upload execution allowance, command
  generation, object/index binding, or remote write permission.

Team artifact public contracts:

- Descriptor, publication-plan, index-entry, and readiness JSON payloads have
  contract tests plus `knowledge validate` coverage before any real team cache
  backend exists.
- Contract gates reject remote-write posture, credentials, upload commands,
  backend details, absolute local paths, raw facts, raw source arrays, unsafe
  object keys, content-address/key/hash drift, and blocker-code summary drift.
- Backend-readiness reports are separate from artifact public contracts. They
  may summarize local private backend config structure, but must not be treated
  as upload approval or evidence that a remote backend was checked.

Extraction rules:

- Every fact must carry source id, source URL or local path, version or commit,
  extraction method, confidence, and a short source locator.
- Extracted facts are advisory unless confirmed by repo-local schemas,
  validators, provider schemas, plan/preview output, or explicit user/team
  curation.
- Public provider/chart facts should not be committed into every user repo by
  default. Store them in the user cache or a team cache. Repos may commit small
  curated packs only when the team intentionally wants reviewed policy or module
  knowledge in version control.
- Knowledge packs must carry storage/publication metadata so future publication
  gates can distinguish public-reference facts from workspace-private facts.
- Private repo facts must be opt-in. Do not upload or share user module,
  component, chart, or code-derived facts without explicit configuration.
- Planner prompts should receive budgeted fact summaries, not full cached docs
  or full repo files.

Implemented initial CLI surfaces:

- `infra-agent knowledge sources <workspace> [--domain helm|pulumi|terraform]
  [--target <path>] [--json]`
  - lists selected knowledge sources without fetching.
- `infra-agent knowledge prefetch <workspace> ...`
  - aliases the current top-level `prefetch` command.
- `infra-agent knowledge extract <workspace> [--domain ...] [--target ...]
  [--source <id>] [--out <knowledge.json>] [--json]`
  - extracts normalized `knowledge-facts` from cached docs, repo-local schemas,
    examples, and module/component/chart code. `--out` explicitly persists the
    generated artifact for later validation or handoff.
- `infra-agent knowledge validate <facts.json|pack.json|manifest.json|descriptor.json> [--workspace <workspace>] --json`
  - validates schema, source links, count consistency, stale policy, confidence
    labels, compact pack freshness metadata, artifact manifest publication
    posture, team artifact descriptors, compact index entries,
    publication-plan dry runs, publication-readiness reports, local source
    fingerprints, and secret safety before facts are used by the planner or
    considered for team-cache staging.
- `infra-agent knowledge pack <workspace> [--target <path>] [--out <pack.json>]
  [--manifest-out <manifest.json>] --json`
  - builds a bounded `knowledge-pack` for handoff or team cache publication.
    `--out` explicitly persists the bounded artifact without changing the
    default stdout-only behavior. `--manifest-out` writes a plan-only manifest
    that still contains no backend URL, bucket, credential, or upload command.
- `infra-agent knowledge publish-plan <manifest.json> [--descriptor <descriptor.json>]
  [--out <plan.json>] --json`
  - reads a persisted artifact manifest and its referenced knowledge-pack
    bytes, rechecks hash/metadata drift, optionally compares an existing compact
    descriptor, and emits a dry-run team publication plan. It may write the
    local plan file requested by `--out`, but it does not write to a mock or
    remote store.
- `infra-agent knowledge publish-readiness <plan.json> [--index-entry <entry.json>]
  [--out <readiness.json>] --json`
  - reads a saved dry-run publication plan and optional compact index entry,
    validates both local inputs, and emits a dry-run readiness report. It may
    write the local readiness file requested by `--out`, but it does not read or
    write a real remote metadata index.
- `infra-agent knowledge backend-readiness <backend-config.json>
  [--out <readiness.json>] --json`
  - reads a local private backend config and emits a compact dry-run backend
    readiness report. It may write the local readiness file requested by
    `--out`, but it does not perform live checks, read credential values, write
    remote objects, mutate a metadata index, or approve an upload.
- `infra-agent knowledge backend-reference-readiness <backend-config.json>
  --registry <reference-registry.json> [--out <readiness.json>] --json`
  - reads a local private S3-compatible backend config and private reference
    registry, then emits a dry-run reference validation summary. It may list
    required environment variable names, but it does not read their values,
    validate credential presence, create a client, or approve upload.
- `infra-agent knowledge upload-approval-intent <publication-readiness.json>
  --backend-reference <reference-readiness.json> [--out <intent.json>] --json`
  - reads saved dry-run publication readiness plus saved backend-reference
    readiness, then emits private approval-boundary state. It may report that
    explicit human upload approval is required, but it does not grant approval,
    check credentials, generate an upload command, or write remote objects.
- `infra-agent knowledge upload-approval-continuation <intent.json>
  --approval-fingerprint <sha256> [--out <continuation.json>] --json`
  - reads a saved private upload approval intent and compares an explicit
    operator-supplied fingerprint with the deterministic intent scope
    fingerprint, then emits private dry-run continuation state. A matching
    continuation still does not approve upload, create clients, read
    credentials, generate commands, or allow remote writes.
- `infra-agent knowledge upload-adapter-preflight <continuation.json>
  --adapter-plan <adapter-plan.json> [--out <preflight.json>] --json`
  - reads a saved private upload approval continuation plus a saved adapter
    resolution plan, then emits private dry-run adapter dependency preflight
    state. A `preflight-ready` result still does not approve upload, inject an
    adapter, create clients, read credentials, generate commands, perform live
    checks, or allow remote writes.
- `infra-agent knowledge upload-mock-harness <preflight.json>
  [--out <harness.json>] --json`
  - reads a saved private upload adapter preflight, then emits private dry-run
    in-memory mock harness state. A `harness-ready` result may instantiate only
    the mock descriptor boundary and still does not inject adapters into upload
    execution, create clients, read credentials, generate commands, perform
    live checks, or write object/index entries.
- `infra-agent knowledge upload-execution-gate <continuation.json>
  --mock-harness <harness.json> [--out <gate.json>] --json`
  - reads saved private upload approval continuation and upload mock harness
    artifacts, verifies that their artifact scope matches, then emits private
    dry-run permission/audit state. A `gate-ready` result is only a signal to
    request separate mutation approval; it does not approve upload, allow
    execution, issue write tokens, create execution leases, inject adapters,
    provide artifact bytes, create clients, read credentials, generate
    commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-mutation-plan <gate.json>
  [--out <mutation-plan.json>] --json`
  - reads one saved private upload execution gate artifact, then emits private
    approval-audit plan state for a later human mutation review. A `plan-ready`
    result is not mutation approval and does not allow execution, issue write
    tokens, create execution leases, create rollback plans, provide artifact
    bytes, inject adapters, create clients, read credentials, generate
    commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-mutation-approval-review <mutation-plan.json>
  --approval-fingerprint <sha256> [--out <review.json>] --json`
  - reads one saved private upload mutation plan artifact and records only that
    the operator reviewed the exact deterministic plan fingerprint. A
    `review-ready` result is not mutation approval and does not allow
    execution, issue write tokens, create execution leases, create rollback
    plans, provide artifact bytes, inject adapters, create clients, read
    credentials, generate commands, perform live checks, or write object/index
    entries.
- `infra-agent knowledge upload-execution-prerequisite-plan
  <approval-review.json> [--out <prerequisite-plan.json>] --json`
  - reads one saved private upload mutation approval review artifact, then
    records the remaining execution prerequisites. A `prerequisite-plan-ready`
    result does not grant mutation approval, allow execution, issue write
    tokens, create leases, create rollback plans, provide artifact bytes,
    inject adapters, create clients, read credentials, generate commands,
    perform live checks, or write object/index entries.
- `infra-agent knowledge upload-write-token-boundary
  <execution-prerequisite-plan.json> [--out <write-token-boundary.json>] --json`
  - reads one saved private upload execution prerequisite plan, then records
    future scoped, single-use, expiring, audit-bound write-token requirements.
    A `write-token-boundary-ready` result does not issue or bind a token,
    allow execution, create execution leases, create rollback plans, provide
    artifact bytes, inject adapters, create clients, read credentials, generate
    commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-execution-lease-boundary
  <write-token-boundary.json> [--out <execution-lease-boundary.json>] --json`
  - reads one saved private upload write-token boundary, then records future
    scoped, single-use, expiring, audit-bound execution lease requirements. A
    `execution-lease-boundary-ready` result does not create a lease, issue or
    bind a token, allow execution, create rollback plans, provide artifact
    bytes, inject adapters, create clients, read credentials, generate
    commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-rollback-plan-boundary
  <execution-lease-boundary.json> [--out <rollback-plan-boundary.json>] --json`
  - reads one saved private upload execution lease boundary, then records
    future scoped rollback-plan requirements. A
    `rollback-plan-boundary-ready` result does not create a rollback plan,
    create a lease, issue or bind a token, allow execution, provide artifact
    bytes, inject adapters, create clients, read credentials, generate
    commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-audit-record-boundary
  <rollback-plan-boundary.json> [--out <audit-record-boundary.json>] --json`
  - reads one saved private upload rollback plan boundary, then records future
    scoped audit-record requirements. An `audit-record-boundary-ready` result
    does not create an audit record, create a rollback plan, create a lease,
    issue or bind a token, allow execution, provide artifact bytes, inject
    adapters, create clients, read credentials, generate commands, perform live
    checks, or write object/index entries.
- `infra-agent knowledge upload-artifact-bytes-boundary
  <audit-record-boundary.json> [--out <artifact-bytes-boundary.json>] --json`
  - reads one saved private upload audit record boundary, then records future
    artifact-byte staging requirements. An `artifact-bytes-boundary-ready`
    result does not read, hash, stage, or provide bytes; it also does not
    create audit records, rollback plans, leases, or tokens, allow execution,
    inject adapters, create clients, read credentials, generate commands,
    perform live checks, or write object/index entries.
- `infra-agent knowledge upload-adapter-injection-boundary
  <artifact-bytes-boundary.json> [--out <adapter-injection-boundary.json>]
  --json`
  - reads one saved private upload artifact bytes boundary, then records future
    adapter dependency-injection requirements. An
    `adapter-injection-boundary-ready` result does not instantiate or inject
    adapters, create clients, read/hash/stage bytes, read credentials,
    generate commands, perform live checks, or write object/index entries.
- `infra-agent knowledge upload-client-creation-boundary
  <adapter-injection-boundary.json> [--out <client-creation-boundary.json>]
  --json`
  - reads one saved private upload adapter injection boundary, then records
    future client creation requirements. A `client-creation-boundary-ready`
    result does not instantiate SDK clients, inject adapters, read credentials,
    check credential presence, perform live checks, generate commands, bind
    object stores or metadata indexes, read/hash/stage bytes, or write
    object/index entries.
- `infra-agent knowledge upload-credential-read-boundary
  <client-creation-boundary.json> [--out <credential-read-boundary.json>]
  --json`
  - reads one saved private upload client creation boundary, then records
    future credential read requirements. A `credential-read-boundary-ready`
    result does not read credential values, check credential presence,
    instantiate SDK clients, inject adapters, perform live checks, generate
    commands, bind object stores or metadata indexes, read/hash/stage bytes, or
    write object/index entries.
- `infra-agent knowledge upload-credential-presence-boundary
  <credential-read-boundary.json> [--out <credential-presence-boundary.json>]
  --json`
  - reads one saved private upload credential read boundary, then records
    future credential presence requirements. A
    `credential-presence-boundary-ready` result does not read credential
    values, check credential presence, expose credential presence results,
    instantiate SDK clients, inject adapters, perform live checks, generate
    commands, bind object stores or metadata indexes, read/hash/stage bytes, or
    write object/index entries.
- `infra-agent knowledge upload-live-check-boundary
  <credential-presence-boundary.json> [--out <live-check-boundary.json>]
  --json`
  - reads one saved private upload credential presence boundary, then records
    future live-check requirements. A `live-check-boundary-ready` result does
    not probe backend reachability, read credential values, check credential
    presence, expose credential presence or live-check results, instantiate SDK
    clients, inject adapters, generate commands, bind object stores or metadata
    indexes, read/hash/stage bytes, or write object/index entries.
- `infra-agent knowledge upload-command-boundary
  <live-check-boundary.json> [--out <command-boundary.json>] --json`
  - reads one saved private upload live check boundary, then records future
    upload-command requirements. A `upload-command-boundary-ready` result does
    not generate, materialize, expose, or execute upload command material,
    expose target object keys, probe backend reachability, read credential
    values, check credential presence, expose live-check results, instantiate
    SDK clients, inject adapters, bind object stores or metadata indexes,
    read/hash/stage bytes, or write object/index entries.
- `infra-agent knowledge upload-object-index-binding-boundary
  <command-boundary.json> [--out <object-index-binding-boundary.json>] --json`
  - reads one saved private upload command boundary, then records future
    object-store and metadata-index binding requirements. An
    `object-index-binding-boundary-ready` result does not bind concrete stores
    or indexes, expose handles, generate/materialize/expose command material,
    expose target object keys, probe backend reachability, read credential
    values, check credential presence, instantiate SDK clients, inject
    adapters, read/hash/stage bytes, allow object/index writes, or write
    object/index entries.
- `infra-agent knowledge upload-execution-readiness-boundary
  <object-index-binding-boundary.json> [--out <execution-readiness-boundary.json>] --json`
  - reads one saved private upload object/index binding boundary, then records
    final future upload execution readiness requirements. A
    `upload-execution-readiness-boundary-ready` result does not approve upload
    execution, grant mutation approval, issue tokens, create leases, create
    rollback plans, create audit records, stage bytes, inject adapters, create
    clients, read or check credentials, probe live backends, generate commands,
    bind stores or indexes, allow object/index writes, or write object/index
    entries.
- `infra-agent knowledge request-separate-upload-execution-approval
  <execution-readiness-boundary.json> [--out <execution-approval-request.json>] --json`
  - reads one saved private upload execution readiness boundary, then records a
    deterministic approval request fingerprint for later human review. A
    `upload-execution-approval-request-ready` result does not record human
    approval, grant approval, allow upload execution, issue tokens, create
    leases, create rollback plans, create audit records, stage bytes, inject
    adapters, create clients, read or check credentials, probe live backends,
    generate commands, bind stores or indexes, allow object/index writes, or
    write object/index entries.
- `infra-agent knowledge record-human-upload-execution-approval
  <execution-approval-request.json> --approval-fingerprint <sha256>
  [--out <execution-approval-record.json>] --json`
  - reads one saved private upload execution approval request and one explicit
    operator-supplied fingerprint, then records only that the fingerprint
    matched. A `upload-execution-approval-record-ready` result does not grant
    approval, allow upload execution, issue tokens, create leases, create
    rollback plans, create audit records, stage bytes, inject adapters, create
    clients, read or check credentials, probe live backends, generate commands,
    bind stores or indexes, allow object/index writes, or write object/index
    entries.
- `infra-agent knowledge upload-execution-authorization-boundary
  <execution-approval-record.json> [--out <execution-authorization-boundary.json>] --json`
  - reads one saved private human upload execution approval record, then
    records only the dry-run explicit authorization boundary that a later
    plan/rules update must review before any upload execution design can
    advance. A `upload-execution-authorization-boundary-ready` result does not
    grant upload execution approval, authorize upload execution, allow upload
    execution, issue tokens, create leases, create rollback plans, create
    audit records, stage bytes, inject adapters, create clients, read or check
    credentials, probe live backends, generate commands, bind stores or
    indexes, allow object/index writes, or write object/index entries.
- `infra-agent knowledge upload-execution-plan-rules-review
  <execution-authorization-boundary.json> [--out <plan-rules-review.json>] --json`
  - reads one saved private upload execution authorization boundary, then
    records only the dry-run Plan/Rules update review gate that a later
    policy update must inspect before any upload execution design can advance.
    A `upload-execution-plan-rules-review-ready` result does not approve
    Plan/Rules changes, grant upload execution approval, authorize upload
    execution, allow upload execution, issue tokens, create leases, create
    rollback plans, create audit records, stage bytes, inject adapters, create
    clients, read or check credentials, probe live backends, generate commands,
    bind stores or indexes, allow object/index writes, or write object/index
    entries.
- `infra-agent knowledge record-upload-execution-plan-rules-update
  <plan-rules-review.json> --review-fingerprint <sha256>
  [--out <plan-rules-update-record.json>] --json`
  - reads one saved private upload execution Plan/Rules review artifact and one
    explicit operator-supplied review fingerprint, then records only that the
    fingerprint matched. A `upload-execution-plan-rules-update-record-ready`
    result does not approve upload execution, grant upload execution
    authorization, allow upload execution, issue tokens, create leases, create
    rollback plans, create audit records, stage bytes, inject adapters, create
    clients, read or check credentials, probe live backends, generate commands,
    bind stores or indexes, allow object/index writes, or write object/index
    entries.

Recommended storage layers:

- Local default: current filesystem cache under the resolved knowledge-cache
  root. Implemented behind a `KnowledgeStore` interface so retrieval and
  prefetch can be tested against injected stores before remote backends exist.
- Repo-curated: small reviewed packs under a workspace-relative configured path,
  never automatic bulk cache commits. Saved repo-derived fact sets should be
  revalidated with `knowledge validate --workspace` so file hash drift is
  detected before reuse. Saved compact packs should also pass
  `knowledge validate` before handoff or team-cache publication. Optional
  manifests should be validated too; manifests with workspace-private or stale
  sources are planning artifacts only until explicit opt-in is recorded.
- Team cache: content-addressed object store plus metadata index. S3-compatible
  storage remains the expected first real remote backend for blobs; an injected
  mocked S3-compatible artifact store now proves content-addressed pack
  storage, retrieval integrity, and publication-policy gates without network
  writes, buckets, endpoints, credentials, or a CLI upload command. A compact
  injected metadata index plus `knowledge publish-readiness` now models
  already-published, upload-required, blocked, and conflict posture before any
  real remote metadata service exists. Add DynamoDB/Postgres only when
  query/index requirements justify it.
- Package-bundled: only schemas, extractors, validators, and small durable rules.
  Do not bundle full provider docs.

Measurable milestones:

1. **Knowledge Fact Schema**
   - Add `KnowledgeFact`, `KnowledgeFactSet`, and parser contract.
   - Acceptance: unit tests reject missing source ids, unsupported fact kinds,
     stale/invalid version metadata, and secret-looking values.
2. **Official Docs Extractor Tool**
   - Extract Terraform Registry resource/data-source arguments and examples from
     cached markdown/JSON; add a Helm chart values extractor for schema/docs.
   - Acceptance: mocked cached docs produce deterministic facts for at least
     three Terraform resource types and two Helm chart/schema cases.
3. **Repo Knowledge Pack**
   - Extract module/component/chart facts from local Terraform modules, Pulumi
     projects/components, Helm charts, examples, and READMEs.
   - Acceptance: fixture workspace produces a bounded pack with module inputs,
     chart values, chart metadata/dependencies, Pulumi stack config shape,
     source locators, and no secrets.
4. **Planner Consumption**
   - Implemented 2026-05-05: runtime loads bounded `knowledge-pack` facts from
     cache/local sources, planner prompts receive capped `knowledgeFacts`
     summaries, `--context-fact-limit` controls the budget, compact
     `agent --json` exposes root-level `knowledgeFacts`, and the compact parser
     validates fact counts, omitted counts, source provenance, stale counts,
     handoff budgets, and raw-field exclusion.
   - Implemented 2026-05-05: `knowledge-pack` now ranks facts before truncation
     so small budgets prefer local schema facts, required inputs, type/default
     constraints, identity/replacement signals, target-local sources, and fresh
     high-confidence facts before examples or low-value attributes.
   - Implemented 2026-05-05: local Terraform provider schema exports are
     compacted to the selected root's used resources/data sources, then
     converted into provider-versioned `argument`, `attribute`, and
     `nested-block` facts without exposing the full `provider_schemas` JSON.
   - Implemented 2026-05-05: literal local Terraform module calls are
     discovered as `terraform-module` sources and converted into ranked
     `module-input` / `module-output` facts from compact module interface
     summaries, without exposing raw `.tf` content.
   - Implemented 2026-05-05: Pulumi project and stack config are discovered as
     `pulumi-config` sources and converted into ranked
     `pulumi-config-parameter` facts from compact local summaries, without
     exposing raw YAML, secure values, or secret-like keys.
   - Implemented 2026-05-05: Helm `Chart.yaml` and sibling `Chart.lock` files
     are discovered as local `chart-metadata` sources and converted into ranked
     `chart-metadata` and `chart-dependency` facts. Locked dependencies from
     `Chart.lock` take precedence over declared dependency ranges, and raw chart
     YAML, lock digests, and generated timestamps stay out of packs, runtime
     facts, and CLI JSON.
   - Implemented 2026-05-06: Pulumi projects now select bounded public
     `pulumi-docs` sources for official configuration docs and YAML runtime
     docs from `Pulumi.yaml`/stack-file metadata. These sources are listed and
     prefetched through the existing public-reference cache path.
   - Implemented 2026-05-06: cached `pulumi-docs:config` and
     `pulumi-docs:yaml` markdown entries now extract bounded
     `pulumi-docs-guidance` facts through the `pulumi-docs-markdown`
     extraction method. These are medium-confidence public-reference guidance
     facts and do not include raw docs, HTML, examples, or secret-looking
     values.
   - Implemented 2026-05-06: Pulumi project-root `package.json` manifests now
     select package-level Pulumi Registry API docs sources for safe `@pulumi/*`
     dependencies, excluding `@pulumi/pulumi`. These sources are URL-backed,
     public-reference, target-filtered, deduped by cache id, and do not expose
     raw package manifest content or local dependency specs.
   - Implemented 2026-05-07: Pulumi YAML projects now record deterministic
     `resources.<name>.type` tokens, use them for targeting details, and select
     resource-level Pulumi Registry API docs sources such as
     `pulumi-docs:resource:aws:s3/bucket`. Source selection uses safe
     `@pulumi/*` dependency versions when available and remains
     public-reference/cache-first.
   - Implemented 2026-05-07: Node.js/TypeScript Pulumi projects now scan
     bounded project-root source files for conservative `@pulumi/*`
     import/require bindings plus explicit resource constructors such as
     `new aws.s3.Bucket(...)`. That parser records compact evidence locators,
     skips comments, strings, generated/test/declaration files and ignored
     directories, and selects the same public-reference resource docs path
     without exposing raw source code. Package dependencies still provide
     version context only; they do not prove resource usage.
   - Implemented 2026-05-07: cached Pulumi Registry resource docs markdown can
     extract bounded medium-confidence `argument` facts from resource input
     tables or bullets. Compact `knowledgeFacts` accepts these resource facts
     while continuing to reject raw docs URLs, cache payloads, and stale-source
     high-confidence facts.
   - Implemented 2026-05-07: cached Pulumi Registry package docs markdown can
     extract bounded medium-confidence `pulumi-docs-guidance` facts from
     package module tables, bullets, and headings selected by safe project-root
     `@pulumi/*` dependencies. These package docs facts stay
     public-reference/advisory, rank below local Pulumi config facts, enter
     compact planner prompts through `knowledgeFacts`, and exclude raw docs,
     package manifests, URLs, cache timestamps, and content hashes from compact
     handoff.
   - Implemented 2026-05-07: cached Helm chart-doc markdown can extract bounded
     medium-confidence `chart-value` facts from chart values tables, bullets,
     and headings selected from chart `home`, `sources`, or dependency HTTP(S)
     docs sources. These chart-doc facts remain cache-first public-reference
     advisory context, rank below local `values.schema.json`, `Chart.yaml`, and
     `Chart.lock` facts, cannot be promoted above medium confidence, enter
     planner prompts only through compact `knowledgeFacts`, and exclude raw
     markdown, external URLs, cache timestamps, and content hashes from compact
     handoff.
   - Implemented 2026-05-08: conservative Node.js/TypeScript Pulumi
     `ComponentResource` classes are discovered as local `pulumi-component`
     sources. The extractor emits high-confidence `pulumi-component-input` and
     `pulumi-component-output` facts from constructor args interfaces/types and
     public output property declarations, skips generated/test/declaration
     paths and secret-like fields, preserves recheckable source fingerprints,
     ranks local component interface facts above public docs guidance, and
     excludes raw source content from packs, planner prompts, and compact
     handoff.
   - Implemented 2026-05-09: the same conservative Node.js/TypeScript
     `ComponentResource` path now emits high-confidence
     `pulumi-component-child-resource` facts for child Pulumi resource
     constructors declared inside detected component class bodies. Facts carry
     only the child resource name, Pulumi type token, source locator, and safe
     related paths; constructor argument objects, raw source/import text,
     generated/test files, root-level resources, and secret-like names remain
     excluded. These facts rank as local component evidence below required
     component inputs and above public Pulumi docs guidance.
   - Implemented 2026-05-08: `knowledge validate --workspace` reports a
     structured `infra-agent.knowledge-freshness-summary` with stale and
     unchecked local source counts, affected fact counts, safe source ids,
     source kinds/names, stale reasons, and safe workspace-relative
     stale/missing paths. Compact `knowledgeFacts` now exposes
     `uncheckedSourceCount`, result cards mirror stale/unchecked source posture,
     and stale or unchecked source facts are not handed off as high-confidence
     compact context.
   - Remaining: non-Node Pulumi language discovery, dynamic/deeper component
     internals, optional markdown normalization for live official docs, and
     opt-in team storage backends.
5. **Refresh And Staleness**
   - Implemented for local repo-derived facts. Changing a local source file or
     deleting a fingerprinted file marks derived facts stale during
     `knowledge validate --workspace`, reports safe stale/missing paths, and
     prevents stale or unchecked sources from producing high-confidence compact
     handoff facts.
   - Implemented 2026-05-09 for public official-doc cache posture:
     `knowledge sources` reports `fresh`, `stale`, and `missing` cache status
     for URL-backed public docs without fetching, text output marks when
     deliberate `knowledge prefetch` is recommended, and prefetch results
     expose each source's previous cache posture while preserving existing
     prefetch status values.
   - Implemented 2026-05-09 for explicit official-doc fetch normalization:
     `fetchOfficialKnowledgeSource` converts HTML-shaped official-doc responses
     into compact Markdown cache entries for existing Pulumi and Helm markdown
     extractors, strips high-noise HTML blocks, preserves TTL behavior, and
     leaves fresh cache entries untouched.
   - Remaining: opt-in team storage backends.
6. **Team Backend Abstraction**
   - Define a storage interface after local schema and validation settle.
   - Acceptance: local filesystem remains default; mocked S3-compatible adapter
     stores and retrieves content-addressed packs without leaking private data.

## Validation Strategy

Validation should be tool-first and layered.

- **Universal YAML**: parse every touched YAML file before and after edits.
- **Helm**: `helm lint`, `helm template`, values schema checks when
  `values.schema.json` exists, and Kubernetes schema validation through an
  optional adapter such as `kubeconform`.
- **Terraform**: `terraform fmt -check`, `terraform validate`, `terraform
  providers schema -json` where initialized, `terraform plan -json` for impact
  analysis when state/backend access is available, and optional `tflint`.
- **Pulumi**: preview-only `pulumi preview` validation with local safe
  environment defaults, stack config inspection, language checks such as `tsc`
  or package tests when detected, and preview JSON/event parsing for
  replacements and dependency impact. Local backend bootstrap, `pulumi stack
  init`, login, refresh/import, and state mutation remain outside validation;
  bounded native stack config writes require `native-stack-config-write`
  approval.
- **Policy**: optional `conftest`, `checkov`, or organization-specific validators
  should be workspace-configured, not hardcoded as mandatory.

The LLM may propose a repair, but deterministic validators decide whether a
configuration is acceptable.

## Module Semantics Strategy

Infrastructure modules and chart values need a structured semantic model, not
only prompt reasoning.

Represent discovered constraints as `ConfigSemantics` records:

- required fields
- defaulted fields
- enum values
- mutually exclusive groups
- at-least-one and exactly-one groups
- fields that imply new required fields
- fields that become invalid when another mode is selected
- identity fields that often indicate rename vs replacement
- fields likely to force replacement
- dependency edges between resources or rendered objects
- confidence and source for every fact

Sources should be ordered by authority:

1. repo-local schemas and validation blocks
2. native tool schema output and preview/plan output
3. official docs for the exact resolved version
4. examples from the same repo or module
5. LLM-inferred candidates marked as low confidence until a tool confirms them

This layer should drive both generation and explanation. For example, if an
option selects `ingress.enabled=true`, the agent should know that host, class,
TLS, service port, and path semantics may become relevant, and should ask or
infer from repo examples before writing incomplete values.

## Rename And Replacement Strategy

Terraform and Pulumi often describe source-level renames as delete/create
operations. `infra-agent` should add a plan-analysis layer that can distinguish:

- pure source-address renames where the remote resource identity is unchanged
- provider identity changes that require replacement
- field updates that can happen in place
- replacement cascades caused by dependencies
- unknown cases where state inspection is required

The CLI should suggest safe state operations or source-level alias/moved-block
patterns, but v0 should not execute state mutations automatically.

Initial Terraform support should parse plan JSON and compare delete/create pairs
by provider type, stable identity attributes, module path, and dependencies.
When confidence is high, suggest `moved` blocks or state move guidance. When
confidence is medium or lower, ask the user to confirm whether it is a rename.

Initial Pulumi support should parse preview events and identify URN/name/type
changes that may be modeled as aliases or state operations. It should explain
replacement reasons and dependency cascades before suggesting any state change.

## Topology Visualization Strategy

The topology web UI is useful, but it depends on a reliable graph model.

Do this first:

- produce `infra-agent graph --json`
- include resources, logical modules/stacks/charts, dependencies, exposure hints,
  replacement risk, and confidence
- derive graph data from repository facts, rendered Helm manifests, Terraform
  plan/state JSON where available, and Pulumi preview/stack exports where
  available

Only after that should the project add a local web server. The first UI should be
local-only and read the graph JSON. It should start with high-value views:

- VPC/subnet/resource containment
- load balancer to service to workload paths
- security-group or NetworkPolicy reachability hints
- cross-stack/module references
- planned create/update/delete/replace changes

## Next Execution Plan

### Step 1: Stabilize Current Runtime Slices

- Review staged and unstaged work in `docs/HANDOFF.md`.
- Commit or otherwise preserve the current slices intentionally.
- Keep the full local gate passing with `npm run verify` and `git diff --check`.
  For test-only changes, also run the affected layer (`npm run test:unit`,
  `npm run test:integration`, or `npm run test:contract`) and
  `npm run test:structure`.

### Step 2: Make The Agent-Facing Surface Real

- Keep `skills/infra-configuration/SKILL.md` in the repo as the canonical
  instruction surface for other agents.
- Add compact JSON result mode if `agent --json` becomes too verbose.
- Add a documented install path once package metadata is ready to publish or
  install from git.

Status on 2026-04-28:

- `agent --json` now emits a compact `infra-agent.agent-result` payload for
  downstream agents instead of the full runtime state.
- `agent --json-full` remains available for full debug state output.
- `identity-report <agent-result.json>` can render compact identity conflict
  data into `infra-agent.identity-conflict-report` without rerunning validators
  or native IaC commands. The renderer validates compact result
  `schemaVersion=1` before reading `validation.identityConflicts`.
  Validation-blocked runs with runtime exclusive-identity conflicts now include
  suggested commands to export compact JSON and render the focused incident
  report.
- The compact payload includes outcome, target, changed files, result-card
  lines, next steps, suggested commands, validation issue summaries, semantic
  blockers, exclusive-identity conflict summaries with triage risk categories,
  approval signals, and the resolved knowledge-cache root.
- Planner prompts now include compact `runtimeIdentityConflicts` derived from
  runtime validation issues, so LLM decisions can see exclusive-identity risk
  category and review context without parsing raw provider stderr.
- LLM client request/response contracts are testable with injected transports,
  keeping planner tests deterministic and independent of live LLM providers.
- LLM planner mode selection and environment precedence are testable with
  explicit environment maps, avoiding process-wide environment mutation in unit
  tests.
- Agent and doctor commands can now accept non-secret OpenAI-compatible planner
  overrides for provider, model, and base URL. API keys remain env-only,
  compact handoff records `harness.plannerConfig`, and approval continuation
  commands preserve CLI-selected planner flags.
- The OpenAI-compatible planner provider now has a small adapter/capability
  boundary. Request transport details live outside `LLMModelClient`, doctor
  and result-card output summarize non-secret capability posture, and compact
  `harness.plannerConfig.llm.capabilities` is parser-validated before handoff.
- `planner-providers [--json]` now exposes the declared LLM planner adapter
  catalog as a read-only, non-secret text/JSON report for downstream agents.
  It does not inspect workspaces, resolve secrets, or prove live model
  reachability.
- Claude Code harness design notes are persisted in
  `docs/CLAUDE_CODE_AGENT_PATTERNS.md`; compact agent output includes
  `harness.turnTrace` and `harness.toolTrace` for low-noise per-turn and
  tool-summary handoff.
- Retrieved official-doc/schema context is compacted through a shared budget
  helper before planner handoff, and compact output now reports
  `knowledgeContext` packet/token budget metadata.
- Context packet and token budgets are explicit query harness config and can be
  adjusted from the CLI with `--context-packet-limit` and
  `--context-token-budget`.
- Tool summaries now carry explicit permission categories, and compact harness
  output aggregates workspace mutations, native CLI calls, and stack/state
  mutation-risk tools.
- Compact `agent --json` output now includes a targeted `readiness` block with
  planner mode, workspace blocker status, selected validation plan status, and
  only validators required by that selected plan, plus a `doctorCommand` for
  the fuller read-only package/Node/tool report.
- Result cards now include compact readiness posture, and suggested commands
  prepend the read-only `doctorCommand` whenever readiness is warn or fail.
- Workspace approval policy can now require explicit approval for tool
  categories, with `--approve-tool-category` used to resume gated native
  operations.
- CLI exit codes now distinguish completed runs, validation blockers, approval
  pauses, clarification pauses, no-safe-action exits, repair-budget exhaustion,
  fatal errors, and `run` preflight blockers for downstream agent control flow.
- Package metadata now exposes the `infra-agent` bin and a narrow installable
  surface containing `bin`, `src`, `skills`, `AGENTS.md`, README, and selected
  durable docs, while excluding fixtures, tests, and handoff history from
  packed installs.
- The installable bin wrapper now preserves the caller working directory, and
  `infra-agent --version` provides a cheap installation self-check.
- `infra-agent doctor [workspace]` now provides a read-only readiness report for
  package metadata, installed agent-facing surface, Node engine, LLM planner
  configuration, workspace inspection, validation plan, and
  Helm/Pulumi/Terraform executable availability without exposing API keys.

### Step 3: Add Syntax Validators

- Add a YAML parsing validator used before accepting YAML writes.
- Normalize validator results into `ValidationIssue` records.
- Add tests with invalid Helm values, Pulumi stack YAML, and generic YAML config.

Status on 2026-04-28:

- Ordinary YAML writes now run `validate_yaml_syntax` before and after the write.
- Invalid YAML is blocked before file mutation and classified as
  `yaml-syntax-failure`.
- Helm files under `templates/` are excluded from raw YAML parsing and remain
  covered by rendered `helm template` validation.
- YAML parse success is treated as a write guard, not as full target validation.
- YAML parsing now uses the project `yaml` npm dependency instead of relying on
  a machine-local Python/PyYAML fallback.

### Step 4: Add Knowledge Cache Interfaces

- Define `KnowledgeSource`, `KnowledgeCacheEntry`, and `RetrievedContextPacket`
  types.
- Implement a local filesystem cache with version/source metadata.
- Add repo-local schema discovery first; add dynamic official-doc fetching later.

Status on 2026-04-28:

- Added `KnowledgeSource`, `KnowledgeCacheEntry`, `KnowledgeCacheWrite`, and
  `RetrievedContextPacket` types.
- Added a local JSON cache adapter with deterministic source IDs, content hashes,
  read/write helpers, and stale-after checks.
- Cache IDs include source kind/name/version/url/path metadata so official docs
  and schemas can be cached per provider/chart/package version.
- Added a knowledge-cache root resolver with explicit env override,
  workspace-config override, and user-cache default. Workspace-config roots must
  be relative paths that stay inside the active workspace.
- `inspect` now exposes the resolved knowledge-cache root and source for
  downstream agents and operators.
- Added a cache-first context retrieval helper that returns compact
  `RetrievedContextPacket` excerpts, fetches missing or stale sources when a
  fetcher is available, and falls back to stale version-scoped cache entries
  with medium confidence when fresh retrieval is unavailable.
- Added a first official URL fetcher abstraction with content-type
  normalization. Tests use mocked fetchers; no test requires external network.
- Added a first Terraform Registry context selection path for Terraform
  resource/data-source docs. It reads `required_providers` and
  `.terraform.lock.hcl` when present, records provider source/version metadata,
  and retrieves compact packets through the cache layer.
- Terraform runs now load cached Terraform Registry context packets for selected
  Terraform roots into runtime state and planner prompts. This path is
  cache-only by default and does not automatically fetch from the network during
  the agent loop.
- Added Helm chart context selection for repo-local `values.schema.json`,
  Helm schema docs, and chart `home`/`sources` metadata from `Chart.yaml`.
  Local chart schema context is emitted directly as a high-confidence packet;
  external Helm/chart docs still go through cache retrieval.
- Helm runs now load selected chart schema context into runtime state and
  planner prompts. External Helm/chart docs remain cache-only inside the agent
  loop unless a separate fetch/prefetch path populates them.
- Helm context selection now includes local `Chart.lock` packets and dependency
  chart repository/version sources from `Chart.yaml` and `Chart.lock`. Only
  HTTP(S) dependency repositories become external fetch candidates.
- Added an explicit `prefetch` CLI path for selected Terraform/Helm knowledge
  sources. It uses the same version-aware cache and is bounded by
  `--max-sources` so dynamic official-doc retrieval stays outside the agent
  loop unless deliberately invoked.
- Added a first normalized `infra-agent.infra-graph` workspace graph with nodes
  and edges derived from inspection facts. This is a topology/impact foundation
  only; plan/preview actions and dependency impact are still future work.
- `infra-agent graph` can now attach read-only Terraform plan JSON resource
  actions as `terraform-resource` nodes with `planned-change` edges. It parses
  `create`, `update`, `delete`, `replace`, `read`, and `no-op` actions, and
  records Terraform `replace_paths` when present.
- Terraform plan graph analysis now marks confidence-scored `possible-rename`
  edges when delete/create pairs share resource type, provider, and stable
  identity fields such as `name`, `bucket`, or `tags.Name`. Strong identity
  fields can raise confidence to high; weak tag-only matches stay medium.
- Terraform plan graph analysis now attaches `depends-on` edges from plan value
  dependencies or configuration expression references, and marks
  `replacement-cascade` edges when a replaced/deleted upstream resource has a
  changed dependent in the same plan graph.
- Terraform plan graph analysis now enriches changed resource nodes and
  replacement-cascade edges with provider-specific replacement reasons derived
  from `replace_paths` plus known immutable or exclusive-identity fields.
- Terraform plan graph analysis now uses the shared exclusive-identity specs to
  mark `create-before-delete-conflict` edges for create-before-destroy
  replacements, and medium-confidence ordering warnings for delete/create pairs
  with the same provider-exclusive identity.
- Terraform plan graph analysis now adds unchanged dependency resources as
  `dependency-context` nodes when planned values, prior state values, or no-op
  resource changes provide safe metadata. These nodes support `depends-on`
  edges without adding `planned-change` edges or change counts.
- `infra-agent graph` can also attach read-only Pulumi preview JSON/event
  actions as `pulumi-resource` nodes with `planned-change` edges. It currently
  parses common `resourcePreEvent.metadata`, `resOutputsEvent.metadata`, and
  simple `steps` shapes.
- Pulumi preview graph analysis now marks advisory `possible-rename` edges for
  delete/create pairs with matching resource type and stable identity fields,
  while avoiding namespace-only Kubernetes matches.
- Pulumi preview graph analysis now also attaches `depends-on` edges from
  preview dependency metadata and marks advisory `replacement-cascade` edges
  when a replaced/deleted upstream resource has a changed dependent.
- Pulumi preview graph analysis now extracts replacement paths from
  `detailedDiff` entries whose kind contains `replace`, falls back to preview
  `diffs` for replacement operations, and enriches resource nodes/cascade edges
  with the same provider-specific replacement reason metadata.
- Pulumi preview graph analysis now adds unchanged preview resources as
  `dependency-context` nodes when `same`/no-op preview metadata is available,
  preserving dependency edges without treating the unchanged resources as
  planned changes.
- Graph summaries now include `edgesByKind` and compact `summary.impact`
  counters for planned changes, dependency edges, possible renames, and
  replacement cascades, plus create-before-delete conflict warnings. The impact
  summary also includes `riskLevel`, `primaryConcern`, `recommendedAction`,
  review-only `reviewSteps`, prioritized `reviewTargets` with per-target
  `priority`, `mutationAllowed=false`, `recommendedAction`, `riskCategory`, and
  `reviewSteps`, plus summary-level `omittedReviewTargets` and
  `mutationAllowed=false` for machine-readable handoff. Text graph output
  includes an `Impact` section with the most relevant rename, cascade, and
  ordering-conflict edges.
- Added a stable graph snapshot helper and cross-domain impact fixture covering
  Terraform and Pulumi planned changes, unchanged dependency context,
  dependency edges, replacement cascades, possible renames,
  create-before-delete conflicts, and replacement reason metadata. This is the
  contract baseline before a topology viewer is introduced.
- Pulumi preview graph analysis uses the same shared exclusive-identity specs
  and flags common exclusive-identity delete/create pairs, including
  `delete-replaced`/`create-replacement` step pairs, as
  `create-before-delete-conflict` edges. Current specs include AWS Routes, S3
  buckets, selected named AWS resources, legacy and VPC-style AWS security
  group rules, IAM OIDC providers, AWS load balancing listener priorities,
  CloudFront aliases, API Gateway custom domains, Route53 records including ACM
  validation CNAMEs, and Kubernetes objects. VPC-style security group rule
  ports are protocol-gated identity fields: graph matching permits omitted
  ports for all-protocol or `icmpv6` rules but keeps TCP/UDP rules conservative.
- Runtime validation issue classification now recognizes Pulumi and Terraform
  `AlreadyExists`/duplicate-name failures plus DNS/domain conflicts such as
  CloudFront `CNAMEAlreadyExists`, API Gateway domain `ConflictException`, and
  Route53 `InvalidChangeBatch`, plus load balancer listener rule
  `PriorityInUse`, security group rule `InvalidPermission.Duplicate`, and IAM
  OIDC provider `EntityAlreadyExists`, then produces guidance for aliases,
  Terraform moved blocks, `deleteBeforeReplace`, lifecycle sequencing, manually
  sequenced replacement, or explicit state/import repair review. When the
  runtime classifier can parse a Pulumi or Terraform resource type, it reuses
  the shared graph exclusive identity spec table and emits spec-backed
  `conflictFamily`, `conflictLabel`, and `conflictSuggestedAction` metadata.
  Runtime conflicts can also preserve Terraform `resourceAddress` and Pulumi
  `resourceName` locators so downstream agents can present concrete review
  candidates without reparsing raw stderr.
  Compact identity conflicts include review-only checklist steps for logical
  rename vs real replacement triage before moved-block, alias, import/state
  repair, or sequencing decisions. Checklist steps can include provider-family
  identity checks such as route table plus destination, listener plus priority,
  security group permission peers, DNS/domain ownership, OIDC URLs, physical
  AWS names, and Kubernetes name/namespace ownership.
  `infra-agent identity-report <agent-result.json>` renders those compact
  conflicts into a focused read-only incident report with
  `mutationAllowed=false` for every incident.
  Kubernetes `AlreadyExists` failures can also include parsed object names and
  namespaces for agent-to-agent handoff. AWS named-resource failures such as
  ECR repository or IAM role duplicates can include parsed physical names as
  `duplicateIdentity`.
- Terraform roots can now ingest an optional local
  `.infra-agent/terraform-provider-schema.json` or
  `.infra-agent/terraform-providers-schema.json` export from
  `terraform providers schema -json`. The runtime extracts compact provider
  schema facts for resources and data sources actually used by the root, and
  exposes a bounded local context packet instead of passing the full schema JSON
  to the planner. Provider schema sources and context packets include locked
  provider version labels from `.terraform.lock.hcl` when available. Treat this
  as shape/type/required-field context; replacement behavior remains driven by
  native plan output and provider-specific impact rules.
- End-to-end automatic network fetching from planner/runtime flows is
  intentionally not implemented yet.

### Step 5: Add Semantic Constraint Extraction

- Extract Helm constraints from `values.schema.json`, rendered manifests, and
  existing values files.
- Extract Terraform variable requirements and validation blocks from `.tf` files.
- Extract Pulumi stack config keys and required-missing-config failures from
  preview output.
- Feed these facts into edit-plan builders before LLM planning.

Status on 2026-04-28:

- Added `ConfigSemanticsSummary` and `ConfigSemanticFact` types.
- Workspace inspection now detects Helm `values.schema.json` files.
- Helm values schema extraction currently emits high-confidence
  `required-field`, `defaulted-field`, `enum`, and `exactly-one-group` facts.
- Terraform variable extraction currently emits high-confidence
  `required-field`, `defaulted-field`, `type-constraint`, `validation-rule`,
  and validation-derived `enum` facts from `.tf` variable blocks.
- Pulumi config extraction currently emits high-confidence `type-constraint`,
  `defaulted-field`, and `configured-field` facts from `Pulumi.yaml` and
  `Pulumi.<stack>.yaml`, without exposing secret `secure` values.
- Focused config semantics are included in the planner user prompt for the top
  candidate targets.
- Helm and Terraform edit-plan builders now consume selected semantics before
  writing values. Helm ingress plans use schema enum facts, and Terraform tfvars
  plans block environment values that violate validation-derived enums.
- Pulumi stack edit plans now consume config semantics to reuse existing config
  keys/namespaces before falling back to project-name heuristics.
- Runtime validation can now promote Pulumi preview missing-config failures into
  high-confidence `required-field` facts, so planner prompts and repairs can use
  validator-discovered semantics.
- Terraform tfvars edit plans now use `type-constraint` facts when rendering
  scalar values, so string variables stay quoted even when values look numeric.
- Result cards now surface validation-derived Pulumi preview `required-field`
  semantic blockers as compact structured output, so downstream agents and
  human operators can see the config path without rereading raw stderr.

### Step 6: Add Impact Analysis

- Refine candidate renames and detect replacement cascades from parsed graph
  actions across Terraform and Pulumi.
- Print guidance without executing state changes.

### Step 7: Add Graph JSON Before Web UI

- Add normalized graph types.
- Generate graph JSON from Helm rendered output, Terraform plan/state facts, and
  Pulumi preview/stack facts.
- Build the web topology viewer only after graph snapshots are stable in tests.

## Near-Term Definition Of Done

The next durable milestone is not the web UI. It is:

- installable local CLI shape
- agent-facing skill checked into the repo
- syntax validation for YAML writes
- first knowledge-cache type definitions
- first semantic constraints used by edit plans
- clear plan-impact output for update vs replacement vs possible rename
