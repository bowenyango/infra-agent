# Agent Rules

Repository-root `AGENTS.md` is the mandatory entrypoint for future agents. This
file contains the detailed domain rules that `AGENTS.md` delegates to.

## 1. General Principles

- Generate code and configuration that meet industrial-grade engineering standards.
- Prioritize correctness, clarity, and maintainability over brevity.
- Follow existing repository conventions before introducing new patterns.
- Do not generate placeholders, incomplete logic, or speculative implementations.
- Do not guess missing infrastructure requirements when they materially affect the result.

## 2. Repository Awareness

- Inspect the repository before making changes.
- Reuse existing patterns, utilities, naming, and configuration structures.
- Do not introduce parallel abstractions when an equivalent already exists.
- Maintain consistency with current directory layout and file organization.

## 3. Scope Discipline

- Stay within the Pulumi, Terraform, and Helm domain unless the task explicitly requires adjacent systems.
- Solve the smallest complete unit of work that satisfies the request.
- Prefer one service and one environment at a time unless the task explicitly requires broader edits.

## 4. File and Structure

- Create files only when necessary and with clear purpose.
- Follow existing naming conventions exactly.
- Keep each file focused on one responsibility.
- Avoid duplicate configuration; prefer reuse and composition.
- Do not introduce alternative chart or stack layouts without evidence from the repository.

## 5. Naming

- Use descriptive, domain-accurate names.
- Avoid unclear abbreviations.
- Ensure names reflect infrastructure intent such as `service`, `stack`, `chart`, `ingress`, or `redis`.
- Include environment qualifiers only when the repository already does so or the task requires them.

## 6. TypeScript Standards

- Use strong typing throughout the implementation.
- Avoid `any` unless there is no reasonable alternative.
- Prefer explicit types in critical runtime paths.
- Keep modules small and composable.
- Avoid unnecessary abstraction layers.

## 7. Error Handling

- Fail fast on invalid state or invalid input.
- Only catch errors when adding meaningful context or handling a known case.
- Never suppress, swallow, or ignore errors.
- Preserve validator stderr and command output when it is relevant to debugging.

## 8. Helm Configuration Rules

- All configurable values must live in `values.yaml` or an established values layer.
- Avoid hardcoded values inside templates.
- Follow standard chart structure: `Chart.yaml`, `values.yaml`, `templates/`.
- Include production-grade operational fields where applicable:
- resource requests and limits
- readiness and liveness probes
- Keep template logic as simple as possible.

## 9. Pulumi Configuration Rules

- Define resources explicitly.
- Avoid depending on implicit defaults when the repository normally configures them.
- Respect stack separation and current environment structure.
- Do not generate destructive or replacement-prone changes by default.
- Prefer typed configuration over loosely structured values.

## 10. Configuration Design

- Avoid magic values.
- Make critical parameters configurable.
- Keep environment-specific configuration consistent.
- Prefer composable configuration patterns over copy-paste expansion.
- Do not duplicate stack logic across environments unless the repository already uses that approach.

## 10A. Terraform Configuration Rules

- Prefer variable-driven configuration over hardcoded literals.
- Reuse existing module and root layout instead of creating parallel Terraform structure.
- Respect existing provider, backend, and environment split conventions.
- Run formatting and validation after Terraform changes.
- Avoid speculative resource creation when the repository indicates module composition should be reused.

## 11. Comments

- Keep comments minimal and professional.
- Explain intent when it is not obvious from the code.
- Do not restate what the code already says.
- Do not leave commented-out code.

## 12. Validation and Iteration

- Validate all generated or modified artifacts.
- Parse touched ordinary YAML files before and after writes.
- Do not raw-parse Helm files under `templates/`; validate those through `helm template` because Go template syntax is not plain YAML.
- Run `helm lint` when a chart is touched.
- Run `helm template` when rendered output matters.
- Run `pulumi preview` when Pulumi code or config changes.
- Keep Pulumi validation preview-only. Do not run `pulumi stack init`,
  `pulumi login`, `pulumi refresh`, `pulumi import`, state commands, local
  backend bootstrap, or shell setup commands as validation.
- Run `terraform fmt -check` when Terraform files change.
- Run `terraform validate` when Terraform configuration changes.
- Use validation failures to refine results instead of stopping after first generation.

## 13. Safety

- Never introduce secrets or credentials into code or committed configuration.
- Reuse existing secret management patterns when present.
- Do not perform destructive actions without explicit instruction.
- Respect permission and execution boundaries.
- Treat production-targeting changes as approval-sensitive by default.
- Treat native Pulumi stack config writes as approval-sensitive by default.
  They must use the `native-stack-config-write` approval category and must not
  silently initialize stacks or perform state repair.

## 14. Output Quality

- All generated outputs must be complete and runnable within the repository context.
- Keep naming, references, and structure consistent across related files.
- Provide a final summary including:
- files created
- files modified
- validators run
- key configuration decisions
- unresolved assumptions or blockers

## 15. Additional Rules For infra-agent

- Prefer editing existing Helm, Pulumi, and Terraform assets over creating new parallel assets.
- Infer repository conventions from concrete files, not from generic best practices alone.
- Use structured `ConfigSemantics` facts from Helm schemas, Terraform variables, Pulumi stack config, validation blocks, and repo examples before asking the LLM to infer constraints.
- Treat Terraform variable enums and validation rules as configuration constraints, and validate generated values against them before writing when possible.
- Validation output is part of the task state and must inform the next step.
- Surface validation-derived semantic blockers as structured result output when they exist; do not bury required config facts in raw stderr.
- Use the resolved knowledge-cache root for docs/schema cache writes. Treat `INFRA_AGENT_KNOWLEDGE_CACHE` as the explicit user override, and only accept workspace-config cache roots that stay inside the workspace.
- Retrieve official docs through cache-first context packets. If only stale cached context is available, keep confidence at medium and do not treat it as validator-grade authority.
- Explicit official-doc fetches may normalize HTML responses into compact
  Markdown cache entries before extraction. This normalization belongs only in
  `prefetch` / `knowledge prefetch` or direct official fetch tests; do not add
  live fetchers to the agent loop.
- Treat knowledge extraction as a first-class contract surface. Extracted facts
  must be schema-versioned, source-linked, versioned or commit-linked,
  confidence-labeled, stale-aware, and parser-validated before a planner uses
  them.
- Treat `knowledge-unit` as the long-term core RAG contract. The supported unit
  types are `fact`, `guidance`, `example`, `diagnostic`, and `recipe`.
  `fact` units are compact machine constraints; `guidance` units are short
  JSON-carried explanations with apply/avoid conditions; `example` units are
  bounded snippets included only when an edit needs concrete shape guidance;
  `diagnostic` units describe validation, plan, preview, or provider failure
  signatures; `recipe` units describe safe multi-step infrastructure workflows.
- Keep infrastructure RAG deterministic by default. Retrieve and rank knowledge
  by domain, provider/package/chart, version, resource/module/component, field,
  target path, validation issue, planned action, risk type, freshness, and
  privacy scope before considering any vector-style discovery. Do not add a
  Vector DB as a required path for v0 planner accuracy.
- Planner prompts must receive compact selected unit summaries and omission
  counts, not raw docs, full provider schemas, full examples, complete cached
  content, or unbounded prose. Structured facts, validator output, repo-local
  semantics, and plan/preview diagnostics outrank generic official-doc prose.
- Repo-derived knowledge fact sets must carry safe workspace-relative local
  source fingerprints instead of raw file content. Recheck those fingerprints
  with `infra-agent knowledge validate <knowledge.json> --workspace <workspace>`
  before reusing saved extraction output after workspace files may have
  changed. Read the validation report's `freshness` summary before reuse:
  stale sources identify safe source ids, source kinds/names, stale reasons,
  affected fact counts, and safe workspace-relative stale or missing paths;
  unchecked local sources require re-extraction or workspace validation before
  their facts are trusted.
- Use the `infra-agent knowledge` namespace for reusable knowledge workflows:
  `sources` to inspect selected sources and public official-doc cache posture,
  `prefetch` to deliberately refresh bounded official-doc cache entries,
  `extract` to create fact sets and optional standalone unit artifacts from
  cache or local schema/code sources, `validate` to check facts or units before
  use, and `knowledge pack` to build bounded planner-safe unit bundles.
  Prefer `--max-units` for new unit-first packs;
  `--max-facts` remains a compatibility alias while legacy consumers migrate.
  Read `knowledge sources` cache status before
  prefetching: `fresh` means the local cache entry is currently usable,
  `stale` or `missing` means a bounded deliberate prefetch may be useful, and
  `local` means no official-doc fetch applies. Packs are advisory context, not
  validator-grade proof.
- Treat compact `knowledgeFacts` as the validated handoff surface for extracted
  provider/resource/chart/module/Pulumi-config/Pulumi-component facts. Read it
  before asking for raw docs, honor `includedUnitCount`, `omittedUnitCount`,
  `includedFactCount`, `omittedFactCount`, `staleSourceCount`,
  `uncheckedSourceCount`, and the configured compact unit budget, and
  never treat omitted samples as exhaustive. Stale or unchecked source facts
  must not be treated as high-confidence planner evidence.
- Public-reference provider, package, chart, Helm metadata, and official-doc
  knowledge should be reusable through a shared registry or cache once
  extracted and validated. Internal module, component, chart, repository rule,
  incident, policy, and example knowledge may use the same extraction and pack
  workflow, but its source must remain local, repo-curated, or explicitly
  configured for an opt-in team backend according to privacy scope.
- Local internal curated knowledge belongs under
  `infra-agent.config.json` -> `knowledgeSources.curatedUnits`. Each entry must
  use a safe workspace-relative JSON path plus `domain` and optional
  `targetPath`, and the file must use
  `infra-agent.curated-knowledge-units` with compact `fact`, `guidance`,
  `example`, `diagnostic`, or `recipe` units. Treat these units as
  `internal-team` planner context and keep the source local-only unless a later
  explicit team-backend approval path is completed.
- Prebuilt unit artifacts belong under
  `infra-agent.config.json` -> `knowledgeSources.unitArtifacts`. Each entry
  must use a safe workspace-relative JSON path to an
  `infra-agent.knowledge-units` payload plus `domain` and optional
  `targetPath`. Treat this as the local read-only shape that future
  S3-compatible references will mirror; do not mutate or upload the artifact
  while extracting or packing it.
- Do not commit generated public-provider or chart cache data into user
  repositories by default. Use the resolved local cache or an explicit team
  cache. Commit only small curated packs when the team deliberately wants
  reviewed knowledge in source control.
- Do not upload private repo-derived module, component, chart, or code facts to
  shared storage without explicit configuration. Remote knowledge backends must
  be opt-in and secret-safe.
- Team artifact store work is currently abstraction-only: local filesystem
  remains the default, the only S3-compatible backend is an injected mock, and
  compact `infra-agent.knowledge-team-artifact-descriptor` payloads must not
  contain backend URLs, buckets, endpoints, headers, credentials, absolute
  workspace paths, raw docs, or raw repo content. Only fresh public-reference
  `knowledge-pack` artifacts may be staged through that mock path.
- `infra-agent knowledge publish-plan` is a dry-run review command, not a
  publish/upload command. It may read a manifest and its referenced pack
  artifact and write a local plan file, but it must not call a store write,
  remote backend, upload command, or agent-loop publication path.
- `infra-agent knowledge publish-readiness` is also a dry-run review command.
  It may read a saved publication plan and an optional compact index entry, but
  it must not read or write a real metadata index, call a remote backend, carry
  credentials, or approve an upload.
- `infra-agent knowledge backend-readiness` is a dry-run backend config review
  command. It may read a local private backend config and emit a compact
  readiness report, but it must not perform live backend checks, read
  credential values, write remote objects, mutate a metadata index, create an
  upload command, or approve an upload.
- `infra-agent knowledge backend-reference-readiness` is a dry-run private
  reference review command. It may read a local S3-compatible backend config
  and reference registry JSON, then emit required/optional environment variable
  names, but it must not read `process.env` values, validate credential
  presence, probe backend reachability, create clients, mutate remote objects,
  or approve an upload.
- `infra-agent knowledge upload-approval-intent` is a dry-run private approval
  boundary review command. It may read saved publication-readiness and
  backend-reference-readiness JSON, then emit whether explicit human upload
  approval would be required after offline preconditions are met. It must not
  grant approval, read credential values, validate credential presence, create
  clients, generate upload commands, probe backend reachability, mutate remote
  objects/indexes, or change public artifact/readiness JSON.
- `infra-agent knowledge upload-approval-continuation` is a dry-run private
  approval continuation review command. It may read a saved upload approval
  intent and compare an explicit operator-supplied approval fingerprint with the
  deterministic intent scope fingerprint. A matching continuation is still not
  upload authorization: it must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `clientCreated=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, and `uploadCommand=null`.
- `infra-agent knowledge upload-adapter-preflight` is a dry-run private adapter
  dependency review command. It may read a saved upload approval continuation
  and a saved adapter resolution plan, then report whether a future test harness
  could inject a safe mock adapter dependency. `preflight-ready` is not upload
  permission and is not execution readiness: it must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `clientCreated=false`, `adapterInjected=false`,
  `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`, and
  `uploadCommand=null`. It must not instantiate real adapters, create SDK
  clients, read credentials or credential presence, copy endpoint/bucket
  details, probe backends, build upload commands, or mutate remote
  objects/indexes.
- `infra-agent knowledge upload-mock-harness` is a dry-run private mock harness
  review command. It may read a saved upload adapter preflight and instantiate
  only the in-memory mock adapter descriptor boundary to prove the dependency
  shape. `harness-ready` is not upload permission and is not remote execution:
  it must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept artifact bytes, backend configs,
  credential names, SDK clients, upload commands, endpoint/bucket details, or
  live/remote write operations.
- `infra-agent knowledge upload-execution-gate` is a dry-run private execution
  gate review command. It may read a saved upload approval continuation and a
  saved upload mock harness, verify that their artifact scope matches, and
  report whether a separate mutation design could be requested. `gate-ready`
  is not upload permission and is not execution approval: it must keep
  `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `clientCreated=false`, `adapterInjected=false`, `remoteWriteAllowed=false`,
  `liveCheckAllowed=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept artifact bytes, issue write tokens,
  create execution leases, inject adapters into execution, create SDK clients,
  read credential values or presence, run live checks, generate commands, or
  mutate object/index storage.
- `infra-agent knowledge upload-mutation-plan` is a dry-run private mutation
  approval audit planning command. It may read one saved upload execution gate
  artifact and emit whether the gate can be taken to a separate human mutation
  approval review. `plan-ready` is not mutation approval and is not upload
  execution readiness: it must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `clientCreated=false`, `adapterInjected=false`, `artifactBytesProvided=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries,
  approval fingerprints, artifact bytes, write tokens, leases, SDK clients,
  adapters, credential values or presence checks, live checks, upload commands,
  or object/index mutation.
- `infra-agent knowledge upload-mutation-approval-review` is a dry-run private
  human fingerprint review record command. It may read one saved upload
  mutation plan and compare an explicit operator-supplied approval fingerprint
  with the plan's deterministic approval-audit fingerprint. `review-ready`
  records only that the exact plan fingerprint was reviewed; it is not mutation
  approval and is not execution readiness. It must keep
  `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `clientCreated=false`,
  `adapterInjected=false`, `artifactBytesProvided=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, artifact bytes, write tokens, leases, SDK clients, adapters,
  credential values or presence checks, live checks, upload commands, or
  object/index mutation.
- `infra-agent knowledge upload-execution-prerequisite-plan` is a dry-run
  private prerequisite boundary planning command. It may read one saved upload
  mutation approval review and record that artifact bytes, adapter injection,
  write token, execution lease, rollback plan, and audit record are still
  required before any later execution design. `prerequisite-plan-ready` is not
  upload execution readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `clientCreated=false`, `adapterInjected=false`,
  `artifactBytesProvided=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, artifact bytes, write tokens, leases, SDK clients,
  adapters, credential values or presence checks, live checks, upload commands,
  or object/index mutation.
- `infra-agent knowledge upload-write-token-boundary` is a dry-run private
  write-token boundary planning command. It may read one saved upload execution
  prerequisite plan and record the required token contract for future execution:
  token required before execution, scope binding, single use, expiry, audit
  binding, execution lease precondition, and rollback precondition.
  `write-token-boundary-ready` is not token issuance or upload execution
  readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `tokenScopeBoundToArtifact=false`,
  `singleUseTokenIssued=false`, `tokenExpirySet=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, artifact bytes, concrete write tokens, leases,
  SDK clients, adapters, credential values or presence checks, live checks,
  upload commands, or object/index mutation.
- `infra-agent knowledge upload-execution-lease-boundary` is a dry-run private
  execution lease boundary planning command. It may read one saved upload
  write-token boundary and record the required lease contract for future
  execution: lease required before execution, artifact scope binding, single
  use, expiry, write-token precondition, audit binding, and rollback
  precondition. `execution-lease-boundary-ready` is not lease creation, token
  issuance, or upload execution readiness. It must keep
  `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `leaseScopeBoundToArtifact=false`,
  `singleUseLeaseCreated=false`, `leaseExpirySet=false`,
  `rollbackPlanCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`. It must not accept
  backend configs, registries, mock harnesses, mutation plans, artifact bytes,
  concrete write tokens, concrete leases, rollback plans, SDK clients,
  adapters, credential values or presence checks, live checks, upload commands,
  or object/index mutation.
- `infra-agent knowledge upload-rollback-plan-boundary` is a dry-run private
  rollback plan boundary command. It may read one saved upload execution lease
  boundary and record the required rollback contract for future execution:
  rollback plan before execution, artifact scope binding, rollback review,
  write-token and execution-lease preconditions, artifact bytes, audit binding,
  and audit record precondition. `rollback-plan-boundary-ready` is not
  rollback plan creation, lease creation, token issuance, or upload execution
  readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `rollbackScopeBoundToArtifact=false`,
  `rollbackReviewed=false`, `artifactBytesProvided=false`,
  `auditRecordCreated=false`, `adapterInjected=false`, `clientCreated=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`. It must not
  accept backend configs, registries, mock harnesses, mutation plans, artifact
  bytes, concrete write tokens, concrete leases, concrete rollback plans, SDK
  clients, adapters, credential values or presence checks, live checks, upload
  commands, or object/index mutation.
- `infra-agent knowledge upload-audit-record-boundary` is a dry-run private
  audit record boundary command. It may read one saved upload rollback plan
  boundary and record the required audit contract for future execution: audit
  record before execution, artifact scope binding, audit review, write-token,
  execution-lease, rollback-plan, and artifact-byte preconditions. An
  `audit-record-boundary-ready` result is not audit record creation, rollback
  plan creation, lease creation, token issuance, or upload execution readiness.
  It must keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `auditScopeBoundToArtifact=false`,
  `auditReviewed=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, artifact bytes, concrete write tokens, concrete
  leases, concrete rollback plans, concrete audit records, SDK clients,
  adapters, credential values or presence checks, live checks, upload commands,
  or object/index mutation.
- `infra-agent knowledge upload-artifact-bytes-boundary` is a dry-run private
  artifact-byte boundary command. It may read one saved upload audit record
  boundary and record required future byte-staging contracts: bytes before
  adapter/execution, digest verification, artifact scope binding, audit,
  write-token, execution-lease, rollback-plan, and adapter-injection
  preconditions. An `artifact-bytes-boundary-ready` result is not byte staging,
  digest verification, adapter injection, audit creation, or upload execution
  readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `auditRecordCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, raw bytes, local artifact paths, concrete write
  tokens, concrete leases, concrete rollback plans, concrete audit records, SDK
  clients, adapters, credential values or presence checks, live checks, upload
  commands, or object/index mutation.
- `infra-agent knowledge upload-adapter-injection-boundary` is a dry-run
  private adapter injection boundary command. It may read one saved upload
  artifact bytes boundary and record required future adapter dependency
  contracts: adapter injection after bytes, adapter injection before execution,
  dependency-injection-only posture, mock adapter requirement, adapter
  descriptor requirement, object-store and metadata-index dependency
  requirements, content-addressed key requirements, idempotent write
  requirement, explicit approval requirement, and client-creation precondition.
  An `adapter-injection-boundary-ready` result is not adapter injection, client
  creation, object-store binding, metadata-index binding, byte staging, or
  upload execution readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `auditRecordCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, raw bytes, local artifact paths, concrete
  adapters, SDK clients, object-store handles, metadata-index handles,
  credential values or presence checks, live checks, upload commands, or
  object/index mutation.
- `infra-agent knowledge upload-client-creation-boundary` is a dry-run private
  client creation boundary command. It may read one saved upload adapter
  injection boundary and record required future client-creation contracts:
  client creation after adapter requirements, client creation before execution,
  dependency-injection-only posture, client factory descriptor requirement,
  credential-read boundary requirement, credential-presence boundary
  requirement, live-check boundary requirement, upload-command boundary
  requirement, object-store and metadata-index dependency requirements,
  content-addressed key requirements, idempotent write requirement, and
  explicit approval requirement. A `client-creation-boundary-ready` result is
  not client creation, SDK instantiation, adapter injection, credential access,
  live checking, command generation, object-store binding, metadata-index
  binding, byte staging, or upload execution readiness. It must keep
  `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`. It must not accept
  backend configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs,
  object-store handles, metadata-index handles, credential values or presence
  checks, live checks, upload commands, or object/index mutation.
- `infra-agent knowledge upload-credential-read-boundary` is a dry-run private
  credential read boundary command. It may read one saved upload client
  creation boundary and record required future credential-read contracts:
  credential source descriptor requirement, credential reference-only posture,
  credential value redaction requirement, credential presence boundary
  requirement, live-check boundary requirement, upload-command boundary
  requirement, client-creation boundary requirement, object-store and
  metadata-index dependency requirements, content-addressed key requirements,
  idempotent write requirement, and explicit approval requirement. A
  `credential-read-boundary-ready` result is not credential access,
  credential value exposure, credential presence checking, SDK instantiation,
  adapter injection, live checking, command generation, object-store binding,
  metadata-index binding, byte staging, or upload execution readiness. It must
  keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`. It must not accept
  backend configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, object-store handles,
  metadata-index handles, live checks, upload commands, or object/index
  mutation.
- `infra-agent knowledge upload-credential-presence-boundary` is a dry-run
  private credential presence boundary command. It may read one saved upload
  credential read boundary and record required future credential-presence
  contracts: credential presence signal requirement, credential presence result
  redaction requirement, credential-reference-only posture, credential value
  redaction requirement, credential-read boundary requirement, live-check
  boundary requirement, upload-command boundary requirement, object-store and
  metadata-index dependency requirements, content-addressed key requirements,
  idempotent write requirement, and explicit approval requirement. A
  `credential-presence-boundary-ready` result is not credential access,
  credential value exposure, credential presence checking, SDK instantiation,
  adapter injection, live checking, command generation, object-store binding,
  metadata-index binding, byte staging, or upload execution readiness. It must
  keep `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `remoteMutationPerformed=false`, and `uploadCommand=null`. It must not accept
  backend configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, object-store handles,
  metadata-index handles, live checks, upload commands, or object/index
  mutation.
- `infra-agent knowledge upload-live-check-boundary` is a dry-run private live
  check boundary command. It may read one saved upload credential presence
  boundary and record required future live-check contracts: live check before
  upload-command generation, credential-presence boundary requirement,
  credential-read boundary requirement, credential reference/value redaction,
  credential presence result redaction, read-only live-check policy,
  live-check result redaction requirement, upload-command boundary
  requirement, object-store and metadata-index dependency requirements,
  content-addressed key requirements, idempotent write requirement, and
  explicit approval requirement. A `live-check-boundary-ready` result is not
  backend reachability, live probing, credential access, credential presence
  checking, SDK instantiation, adapter injection, command generation,
  object-store binding, metadata-index binding, byte staging, or upload
  execution readiness. It must keep `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `auditRecordCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `credentialPresenceResultExposed=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `liveCheckResultExposed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`, and
  `uploadCommand=null`. It must not accept backend configs, registries, mock
  harnesses, mutation plans, raw bytes, local artifact paths, concrete
  adapters, SDK clients, client configs, credential values, credential files,
  credential presence results, live-check probes/results, backend endpoints,
  object-store handles, metadata-index handles, upload commands, or
  object/index mutation.
- `infra-agent knowledge upload-command-boundary` is a dry-run private upload
  command boundary command. It may read one saved upload live check boundary
  and record required future command contracts: command descriptor before
  execution, command generation only after the live-check boundary, command
  payload/material redaction, explicit command execution approval,
  object-store and metadata-index dependency requirements,
  content-addressed key requirements, idempotent write requirement, and
  explicit upload approval requirement. A `upload-command-boundary-ready`
  result is not command generation, command materialization, command
  execution, backend reachability, credential access, SDK instantiation,
  adapter injection, object-store binding, metadata-index binding, byte
  staging, upload execution readiness, or remote mutation readiness. It must
  keep `uploadCommand=null`, `uploadCommandGenerated=false`,
  `uploadCommandMaterialized=false`, `uploadCommandExposed=false`,
  `executable=false`, `objectKeyRedacted=true`, `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `auditRecordCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `liveCheckAllowed=false`,
  `liveCheckPerformed=false`, `liveCheckResultExposed=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`, and
  `remoteMutationPerformed=false`. It must not accept backend configs,
  registries, mock harnesses, mutation plans, raw bytes, local artifact paths,
  concrete adapters, SDK clients, client configs, credential values,
  credential files, credential presence results, live-check probes/results,
  backend endpoints, object keys in output, object-store handles,
  metadata-index handles, upload command payloads/material, signed URLs, or
  object/index mutation.
- `infra-agent knowledge upload-object-index-binding-boundary` is a dry-run
  private object/index binding boundary command. It may read one saved upload
  command boundary and record required future object-store and metadata-index
  binding contracts: object-store descriptor, metadata-index descriptor,
  object-key redaction, metadata-index entry redaction, content-addressed
  object/index keys, idempotent object/index writes, execution-boundary
  requirements for both writes, and explicit upload approval requirement. An
  `object-index-binding-boundary-ready` result is not object-store binding,
  metadata-index binding, upload command generation, command materialization,
  command execution, backend reachability, credential access, SDK
  instantiation, adapter injection, byte staging, upload readiness, or remote
  mutation readiness. It must keep `uploadCommand=null`,
  `objectKeyRedacted=true`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `remoteMutationPerformed=false`,
  `executable=false`, `uploadApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, and `liveCheckPerformed=false`. It must not accept
  backend configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material, signed
  URLs, metadata index entry payloads, or object/index mutation.
- `infra-agent knowledge upload-execution-readiness-boundary` is a dry-run
  private upload execution readiness boundary command. It may read one saved
  upload object/index binding boundary and record final execution-readiness
  requirements for artifact bytes, adapter injection, client creation,
  credential read, credential presence, live check, upload command,
  object/index binding, write token, execution lease, rollback plan, audit
  record, explicit upload approval, and separate upload execution approval. An
  `upload-execution-readiness-boundary-ready` result is not upload approval,
  upload execution approval, upload execution, token issuance, lease creation,
  rollback creation, audit creation, byte staging, adapter injection, SDK
  client creation, credential access, live checking, command generation,
  object-store binding, metadata-index binding, object/index writing, or
  remote mutation. It must keep `uploadCommand=null`,
  `objectKeyRedacted=true`, `uploadApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `writeTokenIssued=false`, `executionLeaseCreated=false`,
  `rollbackPlanCreated=false`, `auditRecordCreated=false`,
  `artifactBytesProvided=false`, `adapterInjected=false`,
  `clientCreated=false`, `credentialValuesExposed=false`,
  `credentialPresenceChecked=false`, `liveCheckAllowed=false`,
  `liveCheckPerformed=false`, `uploadCommandGenerated=false`,
  `artifactObjectStoreBound=false`, `metadataIndexBound=false`,
  `objectStoreHandleExposed=false`, `metadataIndexHandleExposed=false`,
  `objectWriteAllowed=false`, `metadataIndexWriteAllowed=false`,
  `objectWriteAttempted=false`, `metadataIndexWriteAttempted=false`,
  `executable=false`, and `remoteMutationPerformed=false`.
- `infra-agent knowledge request-separate-upload-execution-approval` is a
  dry-run private human upload execution approval request command. It may read
  one saved upload execution readiness boundary and emit a deterministic
  approval request fingerprint for later human review. A
  `upload-execution-approval-request-ready` result is not approval granted and
  is not upload execution authorization. It must keep `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `fingerprintVerified=false`,
  `humanApprovalRecorded=false`, `approvalGranted=false`,
  `approvalSource=null`, `suppliedFingerprint=null`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  token/lease/rollback/audit material, supplied approval fingerprints, or
  object/index mutation.
- `infra-agent knowledge record-human-upload-execution-approval` is a dry-run
  private human upload execution approval record command. It may read one saved
  upload execution approval request and one explicit operator-supplied
  fingerprint. A `upload-execution-approval-record-ready` result means only
  that the supplied fingerprint exactly matched the deterministic approval
  request fingerprint. It is not approval granted and is not upload execution
  authorization. It may set `humanApprovalRecorded=true` and
  `fingerprintVerified=true` only inside the approval record, while it must keep
  `approvalGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  token/lease/rollback/audit material, object/index mutation, or any execution
  grant token.
- `infra-agent knowledge upload-execution-authorization-boundary` is a dry-run
  private upload execution authorization boundary command. It may read one
  saved human upload execution approval record and model the final explicit
  authorization boundary for later plan/rules review. A
  `upload-execution-authorization-boundary-ready` result is not upload
  execution approval, upload execution authorization, upload execution
  readiness, mutation approval, command generation, or remote write
  permission. It may report that a source human approval record and source
  approval fingerprint were verified, while it must keep
  `authorizationGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material,
  object/index mutation, or any execution grant token.
- `infra-agent knowledge upload-execution-plan-rules-review` is a dry-run
  private Plan/Rules update review command. It may read one saved upload
  execution authorization boundary whose ready next action is
  `await-plan-rules-update-for-upload-execution`, then record only the safe
  review gate for a later explicit Plan/Rules update. A
  `upload-execution-plan-rules-review-ready` result is not Plan/Rules approval,
  upload execution approval, upload execution authorization, upload execution
  readiness, mutation approval, command generation, or remote write permission.
  It may report that the source authorization boundary and source fingerprints
  were verified, while it must keep `authorizationGranted=false`,
  `executionAuthorizationGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material,
  object/index mutation, or any execution grant token.
- `infra-agent knowledge record-upload-execution-plan-rules-update` is a
  dry-run private Plan/Rules update record command. It may read one saved
  upload execution Plan/Rules review artifact whose ready next action is
  `await-explicit-plan-rules-update`, compare an explicit operator-supplied
  review fingerprint with `planRulesReview.reviewFingerprint.value`, then
  record only that the fingerprint matched. A
  `upload-execution-plan-rules-update-record-ready` result is not upload
  execution approval, upload execution authorization, upload execution
  readiness, mutation approval, command generation, object/index binding, or
  remote write permission. It may report `planRulesUpdateRecorded=true` and
  `rulesUpdateReviewed=true` only as local fingerprint-record state, while it
  must keep `authorizationGranted=false`,
  `executionAuthorizationGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material,
  object/index mutation, or any execution grant token.
- `infra-agent knowledge upload-execution-implementation-boundary` is a
  dry-run private upload execution implementation boundary command. It may read
  one saved Plan/Rules update record whose ready next action is
  `design-upload-execution-implementation-boundary`, then record only that a
  future implementation boundary has been modeled. A
  `upload-execution-implementation-boundary-ready` result is not upload
  execution approval, upload execution authorization, upload execution
  readiness, mutation approval, command generation, adapter injection, client
  creation, credential access, live checking, object/index binding, object or
  index writes, or remote mutation permission. It may report
  `implementationBoundaryDesigned=true` only as local design-record state,
  while it must keep `authorizationGranted=false`,
  `executionAuthorizationGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material,
  implementation secrets, object/index mutation, or any execution grant token.
- `infra-agent knowledge upload-execution-runtime-boundaries` is a dry-run
  private upload execution runtime-boundaries command. It may read one saved
  implementation boundary whose ready next action is
  `design-upload-execution-runtime-boundaries`, then record only that the
  command, adapter, client, credential, live-check, object/index binding,
  write, token/lease, rollback, audit, artifact-byte, and remote-mutation
  runtime boundaries have been modeled. A
  `upload-execution-runtime-boundaries-ready` result is not upload execution
  approval, upload execution authorization, upload execution readiness,
  mutation approval, command generation, adapter injection, client creation,
  credential access, live checking, object/index binding, object or index
  writes, token/lease issuance, rollback/audit creation, byte staging, or
  remote mutation permission. It may report `runtimeBoundariesDesigned=true`
  only as local design-record state, while it must keep
  `authorizationGranted=false`, `executionAuthorizationGranted=false`,
  `uploadApproved=false`, `uploadExecutionApproved=false`,
  `uploadExecutionAllowed=false`, `mutationApprovalGranted=false`,
  `uploadCommand=null`, `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material, runtime secrets,
  object/index mutation, or any execution grant token.
- `infra-agent knowledge upload-execution-runtime-boundary-policy-review` is a
  dry-run private upload execution runtime-boundary policy-review command. It
  may read one saved runtime-boundaries artifact whose ready next action is
  `await-explicit-upload-execution-runtime-boundary-policy-review`, then record
  only that the artifact-byte, adapter-injection, client-creation,
  credential-read, credential-presence, live-check, upload-command,
  object/index-binding, write-token, execution-lease, rollback-plan,
  audit-record, and remote-mutation policy families were reviewed as a compact
  local checkpoint. A
  `upload-execution-runtime-boundary-policy-review-ready` result is not
  Plan/Rules update, upload execution approval, upload execution authorization,
  upload execution readiness, mutation approval, command generation, adapter
  injection, client creation, credential access, live checking, object/index
  binding, object or index writes, token/lease issuance, rollback/audit
  creation, byte staging, or remote mutation permission. It may report
  `runtimeBoundaryPolicyReviewed=true` only as local review-record state, while
  it must keep `runtimeBoundaryPolicyUpdated=false`,
  `policyUpdateAuthorized=false`, `authorizationGranted=false`,
  `executionAuthorizationGranted=false`, `uploadApproved=false`,
  `uploadExecutionApproved=false`, `uploadExecutionAllowed=false`,
  `mutationApprovalGranted=false`, `uploadCommand=null`,
  `objectKeyRedacted=true`, `writeTokenIssued=false`,
  `executionLeaseCreated=false`, `rollbackPlanCreated=false`,
  `auditRecordCreated=false`, `artifactBytesProvided=false`,
  `adapterInjected=false`, `clientCreated=false`,
  `credentialValuesExposed=false`, `credentialPresenceChecked=false`,
  `liveCheckAllowed=false`, `liveCheckPerformed=false`,
  `uploadCommandGenerated=false`, `artifactObjectStoreBound=false`,
  `metadataIndexBound=false`, `objectStoreHandleExposed=false`,
  `metadataIndexHandleExposed=false`, `objectWriteAllowed=false`,
  `metadataIndexWriteAllowed=false`, `objectWriteAttempted=false`,
  `metadataIndexWriteAttempted=false`, `executable=false`, and
  `remoteMutationPerformed=false`. It must not accept or output backend
  configs, registries, mock harnesses, mutation plans, raw bytes, local
  artifact paths, concrete adapters, SDK clients, client configs, credential
  values, credential files, credential presence results, live-check
  probes/results, backend endpoints, object keys in output, object-store
  handles, metadata-index handles, upload command payloads/material,
  authorization material, token/lease/rollback/audit material, runtime secrets,
  policy-update material, object/index mutation, or any execution grant token.
- Treat the team backend adapter interface as an internal injected dependency
  boundary. The current resolver is mock-only and must keep
  `mutationAllowed=false`, `remoteWriteAllowed=false`, `liveCheckAllowed=false`,
  `credentialValuesExposed=false`, and `uploadCommand=null`; do not add real
  SDK clients, credential lookup, endpoint/bucket fields, remote probes,
  upload commands, or remote object/index mutation through this boundary.
- Treat S3-compatible backend config support as contract-first private parsing
  only. Safe structural references may be parsed for future adapter design, but
  they must not be copied into public team artifact/readiness JSON, used to
  read environment credential values, converted into SDK clients, probed over
  the network, or treated as permission to upload.
- Treat the S3-compatible reference registry as an offline private contract
  for matching `storageProfileRef` / `authProfileRef` and validating required
  environment variable names. It must not read `process.env` values, store
  endpoint or bucket values, expose credentials, create clients, perform live
  checks, or change public team artifact/readiness JSON.
- Treat S3-compatible reference-readiness output as private routing state. It
  may be written for local review, but it must not be copied into public team
  artifact descriptor, publication-plan, index-entry, publication-readiness, or
  backend-readiness JSON.
- Treat team artifact descriptor, publication-plan, index-entry, and readiness
  JSON as public contract data. Do not add raw facts, raw source arrays,
  workspace/cache paths, backend details, credentials, upload commands, or
  non-content-addressed object keys to those payloads.
- Treat team backend readiness JSON as a compact routing artifact for future
  explicit-upload design only. Do not copy private backend config fields,
  backend URLs, buckets, endpoints, headers, credential values, absolute paths,
  raw facts, or raw source arrays into that report.
- Keep team artifact and team backend readiness validation behind focused
  modules. `src/knowledge/validate.ts` should remain the public dispatcher;
  do not move backend clients, SDK setup, credential lookup, network checks,
  upload command generation, or remote index mutation into validation helpers.
- For Terraform Registry docs, prefer provider source and locked provider version from `required_providers` and `.terraform.lock.hcl` before falling back to local-name heuristics.
- For local Terraform provider schema context, use only root-scoped exports such as `.infra-agent/terraform-provider-schema.json` or `.infra-agent/terraform-providers-schema.json`. Extract compact facts for resources used by the selected root, preserve `.terraform.lock.hcl` provider version labels when available, do not pass full provider schema JSON into planner prompts, and do not infer replacement safety from schema shape alone.
- For local Terraform modules, use only literal workspace-contained module
  sources (`./...` or `../...`) as `terraform-module` knowledge sources.
  Extract compact `module-input` and `module-output` facts from module
  variable/output declarations, skip secret-like fields, and do not read
  registry, git, URL, interpolated, absolute, or out-of-workspace sources as
  local module facts.
- For Pulumi config knowledge, use only discovered `Pulumi.yaml` and sibling
  `Pulumi.<stack>.yaml` files as `pulumi-config` knowledge sources. Extract
  compact `pulumi-config-parameter` facts for project config declarations and
  safe stack config values, skip secret-like keys, skip all `secure` stack
  entries, and do not expose raw YAML or secure ciphertext in packs, prompts,
  or compact handoff output. Treat these facts as advisory; `pulumi preview`
  remains authoritative for missing, invalid, or provider-specific config.
- For Pulumi component knowledge, use only conservative Node.js/TypeScript
  project-root class evidence that explicitly extends `pulumi.ComponentResource`
  or an imported `ComponentResource`. Extract compact `pulumi-component-input`,
  `pulumi-component-child-resource`, and `pulumi-component-output` facts from
  constructor args interfaces/types, conservative child resource constructors
  inside detected class bodies, and public output property declarations. Skip
  generated/test/declaration files, root-level resources outside the component
  class body, constructor argument objects, and secret-like fields. Preserve
  workspace-relative source fingerprints, and do not expose raw source code in
  packs, prompts, or compact handoff output. These facts describe local
  component interfaces and direct child-resource evidence only; they do not
  replace `pulumi preview`, project type checks, or language-specific tests,
  and they do not cover Python, Go, .NET, Java, dynamic class factories,
  runtime dataflow, or deeper component internals.
- For Pulumi package docs knowledge, use only safe project-root `package.json`
  `@pulumi/*` dependencies selected as `pulumi-docs:package:<slug>` sources.
  Extract compact cached markdown `pulumi-docs-guidance` facts from package
  module tables, bullets, and headings after an explicit prefetch/cache path
  exists. Treat these facts as public-reference advisory context; they rank
  below local Pulumi config facts, do not prove resource usage, and do not
  replace `pulumi preview`.
- For Pulumi resource docs knowledge, use only structured resource-level source
  evidence: deterministic Pulumi YAML `resources.<name>.type` tokens and
  conservative Node.js/TypeScript project-root `@pulumi/*` import/require plus
  explicit constructor evidence. Select public Pulumi Registry resource docs
  for those tokens and extract compact cached markdown `argument` facts only
  after an explicit prefetch/cache path exists. Do not infer resource usage
  from package dependencies alone, dynamic imports, alias dataflow, Python, Go,
  .NET, Java, generated/test files, or component internals. These facts are
  advisory and must not replace `pulumi preview`.
- For Helm context, prefer repo-local `values.schema.json` packets over external Helm or chart docs.
- For Helm chart metadata knowledge, use discovered `Chart.yaml` and sibling
  `Chart.lock` files as local `chart-metadata` sources. Extract compact
  `chart-metadata` and `chart-dependency` facts for safe chart identity,
  version, app version, type, home/source URLs, and dependencies. Prefer locked
  dependency versions from `Chart.lock`, skip secret-like names or unsafe
  metadata URLs, and do not expose raw chart YAML, lock digests, generated
  timestamps, or dependency repository prose in packs, prompts, or compact
  handoff output.
- For cached Helm chart-doc knowledge, use only public `chart-docs` sources
  selected from chart `home`, `sources`, or HTTP(S) dependency repository docs
  after an explicit cache or prefetch path exists. Extract compact
  `chart-value` facts from markdown tables, bullets, and headings only as
  medium-confidence advisory context. These facts must rank below local
  `values.schema.json`, `Chart.yaml`, and `Chart.lock` facts, must not be
  promoted to high confidence, and must not expose raw markdown, external URLs,
  cache timestamps, content hashes, or non-document schemes in compact planner
  or handoff output.
- For Helm dependency context, prefer repo-local `Chart.lock` over dependency repository prose. Treat HTTP(S) dependency repositories as fetch candidates and skip non-document schemes such as `file://` or `oci://`.
- Helm planner prompts may include selected chart schema packets by default. External Helm/chart docs must stay cache-only unless a deliberate fetch or prefetch path populated them.
- Use `infra-agent knowledge prefetch` or the compatible top-level
  `infra-agent prefetch` for deliberate official-doc cache updates. Keep
  prefetch bounded with `--domain`, `--target`, and `--max-sources` when the
  workspace has many resources. HTML official-doc responses may be normalized
  into compact Markdown in this explicit path, but raw HTML or raw Markdown
  cache content must not be copied into planner prompts, compact JSON, packs, or
  handoff prose.
- Planner prompts may include cached retrieved-context packets. Keep these compact and targeted; do not inject whole official docs into the prompt.
- LLM planner client tests must use injected transports or mocked fetchers. Do not make unit, smoke, or E2E tests depend on live LLM providers or external network availability.
- Test LLM planner mode and environment selection through explicit environment maps. Avoid mutating `process.env` in tests unless a behavior specifically requires process-level integration.
- LLM planner provider/model/base URL CLI overrides are non-secret runtime
  config only. Keep API keys environment-only, include model/base URL source
  metadata in compact handoff, and preserve CLI-selected planner flags in
  approval continuation commands.
- LLM provider adapters are declarative planner-client boundaries only. Keep
  capability metadata fail-closed and parser-validated: supported provider id,
  chat-completions transport, endpoint path, response format, JSON-object
  support, and streaming posture. Capability metadata must never bypass bounded
  parser validation, approval gates, query budgets, lifecycle limits, or IaC
  safety rules.
- Doctor, result-card, and compact planner capability output is agent-facing
  contract data, not credentials and not proof of live provider reachability.
  Keep API keys, bearer headers, tokens, and secret-bearing URLs out of all
  planner metadata and tests.
- `planner-providers` is the read-only static catalog for LLM planner adapters.
  Treat its JSON as parser-validated contract data, not as configured,
  authenticated, reachable, or account-supported provider state. Do not expand
  its provider list unless the adapter registry and tests implement the
  provider. Doctor JSON and compact `readiness.plannerProviderCatalog` may
  expose a compact discovery pointer to this command; keep that pointer static,
  read-only, planner-only, live-check disabled, and parser-validated.
- Follow `docs/CLAUDE_CODE_AGENT_PATTERNS.md` when evolving the harness: prefer compact structured turn traces, tool summaries, and explicit permission/validation state over raw logs or full runtime snapshots in agent-facing output.
- Validate compact `knowledgeContext` before using retrieved docs/schema
  context in handoff: positive packet/token/excerpt budgets, non-negative
  packet and token totals, included/omitted count arithmetic, omitted-reason
  counts, packet summary shape, confidence enums, included/omitted reason
  coherence, derived token totals, excerpt-char limits, and no raw excerpts,
  facts, or source payloads.
- Validate compact `knowledgeFacts` before using extracted fact summaries in
  handoff: schema marker, `mutationAllowed=false`, pack-id shape, max-fact
  budget alignment with `harness.queryConfig.retrievedContextBudget.maxFacts`,
  source/fact count arithmetic, source/fact linkage, stale and unchecked source
  counts, supported domain/source/fact/extraction enums, high-confidence fact
  exclusion for stale or unchecked sources, `harness.stateSummary` alignment,
  `handoffCheckpoint.budgets.knowledgeFacts`, and no raw cache/doc fields such
  as `source`, `content`, `contentHash`, `fetchedAt`, `url`, or `localPath`.
- Validate compact `knowledgeCache` as handoff metadata only: non-empty root
  string and one of the supported source labels for environment override,
  workspace config, or default user cache. Do not re-derive workspace path
  safety from compact output; that belongs in the cache-root resolver.
- Tool summaries must preserve permission categories for workspace mutation, native CLI execution, and stack/state mutation-risk tools. Do not collapse these into generic "tool ran" prose.
- Validate compact `harness.toolTrace` as permission provenance: supported
  tool safety and permission categories, non-empty tool names, boolean
  mutation/approval flags, non-negative budget counts, included-entry length,
  first included turn index, and permission-category counts that sum to
  `totalCount`.
- Validate compact `harness.toolPermissionSummary` as the aggregate permission
  posture: non-negative integer tool counts, mutation/approval counts that do
  not exceed `totalToolCount`, supported permission category keys, category
  totals that equal `totalToolCount`, and category counts that match
  `harness.toolTrace.permissionCategoryCounts` when both are present.
- Keep `harness.plannerHandoff` derived and compact. It may route by last
  action, active blocker, and next control action, but it must not include raw
  prompts, rationales, payloads, observations, or file contents.
- Keep `harness.workPlan` derived and compact. It may expose progress steps,
  status counts including `skippedStepCount`, current step, blocker kind, and
  next control action, but it must not become a writable todo store or include
  raw runtime data.
- Keep `harness.targeting` derived and compact. It may expose selected target,
  candidate score posture, bounded candidate samples, ambiguity flags, and
  recommended targeting action, but it must not include raw preflight state or
  become a second target-selection engine.
- Validate compact targeting before routing another agent: supported target
  source/kind/domain/ambiguity/action enums, read-only posture, candidate
  budget counts, unique ascending ranks, selected target consistency with root
  `primaryTarget`, candidate kind/domain coherence, score-gap arithmetic, and
  ambiguity flag/recommended-action consistency.
- Validate compact planner handoff before routing another agent: supported
  last-action kind/family/stop/clarification/execution-status values,
  stop-reason and clarification-kind coherence, active blocker issue/signal
  kinds, and outcome-to-active-blocker/next-control-action consistency.
- Workspace approval policy may require explicit approval for tool categories such as `native-stack-config-write`; use `--approve-tool-category <category>` to resume only when the user has approved that category.
- Planner prompts must pass retrieved official-doc/schema context through the context budget helper. Do not inject full cached documents or unbounded excerpts into LLM prompts.
- Treat retrieved context packet/token budgets as query harness configuration. Prefer `--context-packet-limit` and `--context-token-budget` for experiments instead of changing budget constants ad hoc.
- Use compact `agent --json` output for agent-to-agent handoff; reserve `--json-full` for debugging complete runtime state.
- Compact `infra-agent.agent-result` consumers must validate the shallow
  handoff contract before deriving secondary reports. Check `kind`,
  `schemaVersion`, known `outcome`, required root task/workspace metadata,
  root string-array handoff fields, compact trace array shape, readiness check
  array shape when present, `harness.queryConfig`, `harness.loopBudget`,
  `harness.stateSummary` counts, `harness.targeting`, `harness.workPlan`,
  `harness.turnTraceBudget`,
  `harness.lifecycleEvents`, `harness.toolTrace` budget counts,
  `harness.toolPermissionSummary` aggregate/category counts,
  `validation.selectedPlan`, `validation.commands`, `validation.issueSummary`,
  `approval.resume`, and `validation.identityConflicts` before treating the
  payload as an agent result.
- Treat compact lifecycle and turn-trace budgets as contract data, not prose.
  Validate supported lifecycle event names, numeric event counts, total =
  included + omitted invariants, lifecycle `maxEntries`, event-kind count
  totals, event entry action/status/outcome fields, and the supported
  `turnTraceBudget` `preservedWindow` value before deriving secondary reports.
- Validate compact `harness.turnTrace` entries before deriving follow-up work:
  supported action/family/stop/clarification/status enums, string summaries,
  boolean terminal flags, non-negative count fields, stop-reason coherence, and
  clarification-kind coherence. Also validate that trace length, first/last
  included indexes, `turnTraceLimit`, and `turnTraceOmittedCount` agree with
  `harness.turnTraceBudget`.
- Validate compact `harness.toolTrace` entries before routing on recent tool
  activity: supported permission categories, numeric count budgets,
  `preservedWindow="tail"`, first/last included indexes matching emitted
  entries, and `latestTurnIndex` consistency when no tool entries are omitted.
- Treat compact `approval.grants` as supplied approval scope for the current
  run only. Validate granted write risks, write paths, tool categories, write
  path scope, and `hasExplicitApproval` consistency before using it for audit or
  resume explanations. Suggested rerun/export commands should preserve these
  grants; do not broaden or combine approval scope beyond what the user already
  supplied.
- Treat compact `approval.resume.additionalCommands` as per-signal rerun
  metadata. Validate each command against its signal and avoid combining
  multiple approval scopes unless the user explicitly approves that combined
  scope.
- Treat compact query and loop budgets as contract data. Validate positive
  max-turn and retrieved-context budget integers, non-negative repair attempts,
  root `turnsUsed` consistency, remaining-turn arithmetic, and exhausted-state
  consistency before a downstream agent uses the result to decide whether to
  rerun or resume.
- Treat compact repair budget as the same contract family. Validate
  non-negative repair attempt integers, `maxAttempts` alignment with
  `harness.queryConfig.maxRepairAttempts`, remaining-attempt arithmetic, and
  exhausted-state consistency before a downstream agent decides to retry or
  hand off manual repair.
- Keep compact `agent --json` readiness targeted: include planner mode,
  workspace blocker status, selected validation-plan status, validators
  required by that selected plan, a `doctorCommand` for fuller read-only
  checks, and `plannerProviderCatalog` as a compact pointer to the static
  planner adapter catalog. Do not include API keys or unrelated validator
  noise.
- Validate compact readiness as read-only status data: supported
  pass/warn/fail values, non-negative summary counts, check name/message/detail
  shapes, counts that match checks by status, and summary status derived from
  check counts. Validate `readiness.plannerProviderCatalog` as static
  discovery metadata: schema version 1, `mutationAllowed=false`,
  `liveProviderCheck=false`, `plannerOnly=true`, the exact
  `infra-agent planner-providers --json` command, supported provider ids, and
  count consistency.
- Surface readiness posture in result cards, and include the read-only
  `doctorCommand` in suggested commands when readiness is warn or fail. Do not
  let this replace approval continuation commands when an approval gate is the
  active blocker.
- Treat compact `approval.resume` as a structured handoff for the existing
  approval gate. It can show the scoped continuation command and active signal
  scope, including the primary signal, `pendingScope` count summary, and
  additional pending scope, but it is not approval and must not authorize writes
  or native operations without explicit user approval. Approval continuation
  commands must preserve query-loop budget flags so resuming does not silently
  change turn, repair, or retrieved-context limits.
- Validate compact approval handoff before using it: supported signal kinds,
  write-risk values, tool permission categories, signal path/risk/category
  coherence, resume command/null consistency, resume array shapes, and
  `signalCount`/`pendingScope` coverage for included and omitted signals.
- Treat CLI exit codes as part of the agent-facing contract: `0` means success, `1` means fatal CLI/runtime failure, `2` means validation blocked, `3` means approval required, `4` means clarification required, `5` means no safe action, `6` means repair budget exhausted, and `7` means `run` preflight blockers.
- Keep the bounded repair budget in `QueryLoopConfig`. Use
  `--max-repair-attempts <n>` for experiments instead of hard-coding retry
  counts in planners; `0` means no automatic repair loop.
- Keep the installable npm package surface narrow. Include the CLI entrypoint,
  TypeScript runtime sources, skills, `AGENTS.md`, README, and durable docs;
  exclude fixtures, tests, smoke scripts, and handoff history from
  `package.json.files`.
- The installed `bin/infra-agent.js` wrapper must preserve the caller working directory so default workspace resolution points at the user's repository, not the package root.
- Keep `infra-agent --version` available as a cheap installation and routing check for downstream agents.
- Keep `infra-agent doctor [workspace] --json` read-only. Use it for package,
  installed agent-facing surface, Node engine, LLM planner configuration,
  workspace inspection, validation plan, and external validator readiness checks
  before deeper agent runs. Doctor JSON may expose the same static
  `plannerProviderCatalog` discovery object as compact readiness. Never expose
  API keys or secrets in doctor output.
- Treat `unsafe-validation-command` validation issues as hard safety blockers.
  The validation tool must block deploy, apply, state mutation, Helm release
  mutation, and Kubernetes mutation commands before spawning them. Remove the
  unsafe command from workspace config or planner output instead of asking the
  tool to run it.
- Validate compact `validation.selectedPlan` before using intended validators
  for handoff: supported Helm/Pulumi/Terraform kinds, non-empty target paths,
  non-empty command strings, command counts that match the command array,
  executed counts that do not exceed command counts, failed counts that do not
  exceed executed counts, and boolean validator availability.
- Validate compact `validation.commands` before using command summaries for
  handoff: non-negative budget and target/yaml command counts, non-empty
  command strings, supported status/kind values, non-negative exit codes,
  status/exit-code consistency, preview strings, boolean unsafe-blocked flags,
  and unsafe rule metadata when a command is blocked.
- Validate compact `validation.issueSummary` and `validation.issueDetails`
  before deriving blocker reports: non-negative integer summary/detail counts,
  repairable plus non-repairable totals, groups bounded by `maxGroups`,
  supported issue kinds, positive group counts/source-command counts, boolean
  flags, flag/count consistency, and issue-details omitted counts that match
  summary omitted issue counts.
- Validate compact `validation.safetyBlockers` before treating validation as
  mutation-safe: non-negative budget counts, entries bounded by `maxEntries`,
  supported `unsafe-validation-command`/`yaml-syntax-failure` kinds, non-empty
  source commands and messages, string-or-null unsafe/YAML metadata, boolean
  repairability, and `mutationPrevented=true`.
- Validate capped `validation.issues` samples before using issue details:
  supported issue kinds, boolean repairability, non-empty messages, optional
  string/null guidance, string-valued metadata, sample length bounded by
  `validation.issueDetails.maxEntries`, sample plus omitted count matching
  `validation.issueSummary.totalCount`, and full-sample count agreement with
  `validation.issueSummary` when no issues are omitted.
- LLM planner `validate-targets` payloads must be treated as suggestions, not
  authority. Parser code must clamp validation commands to the selected
  validation plan and fall back to selected plan commands when a model invents
  unrelated or unsafe commands.
- LLM planner target paths must also be treated as suggestions. Parser code
  must clamp inspection paths and Terraform formatting roots to known
  `targetCandidates` instead of accepting invented paths or parent-directory
  references from model output.
- LLM planner `payload.actionFamily` values are metadata only. Preserve
  supported values for handoff traceability, but derive a deterministic fallback
  from the parsed action, primary requested domain, stop reason, clarification
  kind, or edit-plan kind when the model omits or invents an unsupported value.
- Compact `harness.plannerConfig` must be validated before another agent trusts
  model/provider handoff. Treat it as a non-secret snapshot of requested mode,
  effective planner, provider, model, base URL, source labels, and provider
  capabilities; never infer credentials from it.
- Use `infra-agent identity-report <agent-result.json>` when a human operator or downstream agent needs a focused runtime exclusive-identity incident report from an existing compact result. This command is read-only and must not rerun validators or mutate state.
- `identity-report` inputs must be compact `infra-agent.agent-result` JSON with `schemaVersion=1` and `validation.identityConflicts`; do not point it at graph JSON, full debug state, native plan JSON, or raw CLI logs.
- When `suggestedCommands` includes an `agent --json > agent-result.json` export followed by `identity-report agent-result.json --json`, treat that as a read-only reporting handoff for exclusive-identity triage, not as approval to rerun apply/update or mutate state.
- Use `infra-agent graph --json` as the topology handoff surface. Treat it as inspection-derived structure until plan/preview impact data is explicitly attached.
- Use `summary.sourceProvenance` to distinguish workspace-inspection graph facts
  from attached Terraform plan or Pulumi preview impact data. Do not infer that
  workspace-inspection-only graphs contain native plan/preview changes.
- When consuming saved graph JSON, parse it as compact `infra-agent.infra-graph`
  schema version 1 before trusting impact fields. Reject graph payloads where
  root `mutationAllowed`, `summary.impact.mutationAllowed`, or any impact review
  target is not `false`.
- Use `infra-agent impact-report <graph.json>` when a human operator or
  downstream agent needs a focused graph impact report from an existing graph
  handoff. Graph impact reports are read-only summaries of existing
  `infra-agent.infra-graph` JSON. They do not rerun Terraform, Pulumi, Helm, or
  Kubernetes commands and do not authorize state moves, aliases, imports, or
  apply/update operations.
- When consuming saved impact report JSON, parse it as
  `infra-agent.infra-graph-impact-report` schema version 1 and reject payloads
  where the report or any review target has `mutationAllowed` set to anything
  other than `false`.
- Use `infra-agent graph --terraform-plan <plan.json> --target <terraform-root> --json` to attach Terraform plan actions without executing Terraform. Treat replacement and rename guidance as advisory until reviewed against state.
- Use `infra-agent graph --pulumi-preview <preview.json> --target <pulumi-project> --json` to attach Pulumi preview actions without executing Pulumi.
- Keep graph contract changes covered by stable graph snapshots before building or changing topology UI behavior. Update snapshot fixtures deliberately when graph semantics change, not as incidental churn.
- When handing graph output to another agent, prefer compact `summary.impact`
  fields, especially `riskLevel`, `primaryConcern`, `recommendedAction`, and
  review-only `reviewSteps`, plus prioritized `reviewTargets`,
  `reviewTargetBudget`, `omittedReviewTargets`, `mutationAllowed=false`, and
  the `Impact` text section before pasting full `nodes` and `edges`. Each
  review target includes its own `priority`, `mutationAllowed=false`,
  `recommendedAction`, `riskCategory`, and `reviewSteps`; use those per-edge
  fields before re-reading full graph edges or duplicating kind-to-action
  mappings.
- Treat graph nodes with `metadata.role=dependency-context` as relationship context only. They explain unchanged upstream resources needed by `depends-on` edges and must not be counted as planned changes unless a `planned-change` edge and `metadata.action` are also present.
- Treat graph replacement reason metadata such as `replacementReasons`, `replacementReasonCategories`, and `dependencyReplacementReasons` as advisory provider/schema context. Use it to explain why a replacement or cascade is likely, but confirm with native plan/preview output and state before recommending state mutation or downtime.
- Treat graph `possible-rename` edges as review candidates only, even when confidence is high. Use `score`, `matchingIdentityKeys`, and `reason` metadata to explain the candidate, but do not execute `terraform state mv`, write moved blocks, or mutate Pulumi state without explicit user approval and a human-reviewed address mapping.
- For Pulumi rename candidates, require more than a namespace-only Kubernetes match before suggesting review.
- Treat graph `depends-on` and `replacement-cascade` edges as impact explanation, not approval to apply. Use them to explain likely downstream blast radius and why a dependent changed, then confirm with native plan/preview output.
- Treat graph `create-before-delete-conflict` edges as high-risk ordering warnings. These are common when a provider resource has an exclusive physical identity and Pulumi or Terraform plans creation before deletion. Remediation candidates are Pulumi aliases or Terraform moved blocks/state moves for logical renames, `deleteBeforeReplace`/delete-before-create/manual sequencing for true replacements with accepted downtime, or explicit state/import repair after human approval.
- Treat runtime `pulumi-create-before-delete-conflict` and `terraform-create-before-delete-conflict` validation issues the same way, including DNS/domain families such as CloudFront aliases, API Gateway custom domains, and Route53 records, plus listener rules, security group rules, and IAM OIDC providers. They are blockers, not bounded automatic repairs. Terraform runtime classification is for captured plan/apply failure output only; it does not authorize running apply.
- Runtime exclusive-identity validation issues should reuse the shared graph exclusive identity specs when a resource type is parseable. Preserve `conflictFamily`, `conflictLabel`, and `conflictSuggestedAction` metadata for downstream agents, but keep suggestions review-only until native plan/preview/state is checked.
- Compact `agent --json` output should expose runtime exclusive-identity blockers through `validation.identityConflicts` so downstream agents can consume engine, family, identity fields, `riskCategory`, source command, and suggested review action without parsing raw stderr or long guidance strings.
- Treat `validation.identityConflictSummary` as the authoritative count surface
  for exclusive-identity blockers. `validation.identityConflicts` is a capped
  detail sample, so consumers must check total, included, omitted, engine, and
  risk-category counts before assuming all blockers are visible. Validate that
  summary counts are non-negative integers, included plus omitted equals total,
  included count matches the conflict sample length, engine/risk-category maps
  sum to total, and included conflicts are covered by those maps.
- Compact identity conflict consumers must reject malformed conflict samples:
  engine must match issue kind, risk category must be one of the supported
  triage categories, `identity` must be a string-valued object, `sourceCommand`
  must be present, `reviewSteps` must be string-only, and any
  `mutationAllowed` field must be `false`.
- Preserve Terraform `resourceAddress` and Pulumi `resourceName` metadata for runtime exclusive-identity blockers when parseable. Treat these as IaC locator candidates for review, not as approval to write moved blocks, aliases, imports, state moves, or stack mutations.
- Preserve `validation.identityConflicts[].riskCategory` as a triage grouping, not a remediation decision. Current categories include `create-before-delete-ordering`, `dns-or-domain-ownership`, `physical-name-ownership`, `kubernetes-object-ownership`, and `exclusive-identity-review`.
- Planner prompts should expose the same runtime exclusive-identity blockers as
  compact `runtimeIdentityConflictSummary` plus sampled
  `runtimeIdentityConflicts`, including `riskCategory`, locator fields, parsed
  identity, and review steps. Treat this as low-noise blocker context for the
  planner, not as permission to plan or execute Terraform state moves, Pulumi
  aliases/imports, DNS changes, Kubernetes ownership changes, deletion, or
  stack mutation.
- Preserve `validation.identityConflicts[].reviewSteps` as a review-only checklist. It may suggest moved blocks, aliases, import/state repair, or sequencing analysis, and it may include family-specific identity checks such as routes, listener priorities, security permissions, DNS/domain ownership, OIDC URLs, named AWS resources, or Kubernetes name/namespace ownership. It must not trigger state or stack mutation without explicit approval and human-reviewed mappings.
- Preserve `infra-agent.identity-conflict-report.mutationAllowed=false`. Treat that report as incident triage only; it is not a remediation plan and does not authorize Terraform state, Pulumi stack, import, alias, DNS, or Kubernetes object changes.
- Identity conflict reports should preserve `incidentSummary` and
  `omittedIncidentCount` from compact results so downstream agents know whether
  incident details are capped.
- Identity conflict reports must pass their own contract parser before handoff:
  root and incident `mutationAllowed` must be false, incident counts must match
  included summaries, engine/risk grouped counts must sum to total incidents,
  and incident identities/review steps must keep string-only shapes.
- Report command tests should exercise the real CLI entrypoint for
  `identity-report --json` and `impact-report --json`, not only argument
  parsing or loader helpers, so command routing and JSON output stay covered.
- For Kubernetes `AlreadyExists` runtime failures, preserve parsed `kubernetesNames` and `kubernetesNamespaces` metadata when present. Treat the identity as API kind plus `metadata.name` plus `metadata.namespace` for namespaced objects, or API kind plus `metadata.name` for namespaces.
- For AWS named-resource runtime failures, preserve parsed `duplicateIdentity` metadata from provider messages such as `repository with name ... already exists`, `Role with name ... already exists`, or safe Terraform `creating <resource> (<name>)` context. Treat this as physical identity context for review, not as approval to import or replace.
- Some exclusive-identity specs intentionally use overlap matching, such as CloudFront aliases and security group rule source sets, optional identity parts such as Route53 `set_identifier`, or protocol-gated omissions such as VPC security group rule ports for `ipProtocol=-1` or `icmpv6`. Explain the matched identity keys from graph metadata and still confirm with native plan/preview/state before recommending DNS, alias, security group permission, or state changes.
- The agent must not call deploy or apply commands in version `v0`.
- The agent should stop and ask for clarification when any of these are ambiguous:
- target environment
- target service or chart
- stack ownership
- Terraform root or module ownership
- secret source
- ingress hostnames or external endpoints
