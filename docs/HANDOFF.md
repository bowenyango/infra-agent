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
