---
name: infra-configuration
description: Use this skill when generating, modifying, reviewing, or validating Helm, Pulumi, or Terraform configuration in an infrastructure repository. Prefer the infra-agent CLI for semantic, low-token IaC context, compact knowledge units, validation summaries, and impact hints before doing ad hoc file reads or edits.
---

# Infra Configuration

Use `infra-agent` as the specialist IaC context compiler for infrastructure
configuration tasks. The skill exists to keep other agents from loading an
entire repo or guessing infrastructure conventions from generic IaC knowledge.

Codex, Claude Code, or the calling agent remains responsible for file edits,
shell execution, approvals, rollback, git diff review, and PR creation.
`infra-agent` should provide compact repo-specific context, validation
summaries, graph/impact hints, and selected knowledge units. It must not be
treated as approval to deploy, apply, merge, or mutate infrastructure state.

If the CLI is installed from a local checkout, use `npm link` from the
`infra-agent` repository and then call `infra-agent` from the target workspace.
The installable package intentionally includes only the CLI runtime, skills,
`AGENTS.md`, README, and durable docs. Use `infra-agent --version` as a cheap
installation check before running repository-specific commands. Use
`infra-agent doctor <workspace> --json` when another agent needs a structured,
read-only readiness report; doctor output must not expose API keys or secret
values.

## Workflow

1. Identify the workspace root.
2. Run inspection before reading broadly or editing:

   ```sh
   infra-agent inspect <workspace>
   infra-agent inventory <workspace> --json
   infra-agent cache status <workspace> --json
   infra-agent pack <workspace> --scope <path|target|env|stack> --json
   infra-agent refs <workspace> --resource <terraform|pulumi|helm-identity> --json
   infra-agent knowledge resource <workspace> --domain <helm|pulumi|terraform> --resource <identity> --json
   infra-agent knowledge from-url <public-doc-url> --library-out <artifact.json> --json
   infra-agent pack <workspace> --changed --base main --head HEAD --json
   ```

   Prefer `inventory --json` when another agent needs a compact repo map. It
   reports detected Helm/Pulumi/Terraform targets, environment hints, primary
   files, validation targets, semantic fact counts, knowledge-cache posture,
   and compact Helm chart identity/version/dependency metadata without raw file
   contents or full semantic facts. Use `--domain` and `--target` to keep the
   context scoped. Use `cache status --json` when the next agent needs cache
   posture before deciding to reuse, prefetch, extract, or pack knowledge
   units; it is read-only and does not fetch, upload, validate, plan, preview,
   apply, deploy, or mutate state. Prefer
   `pack --scope ...` when the task already has a path, target name/id,
   environment, or Pulumi stack; it returns a smaller `infra-agent.scoped-pack`
   JSON handoff, or compact Markdown without `--json`, with suggested files,
   validation targets, and compact target metadata. Prefer `pack --changed` as
   the one-shot handoff when the task is scoped to a branch or patch and
   another agent needs only changed-component context.
   Prefer `refs --scope ...` or `refs --resource ...` when the task needs
   interface shape rather than file-selection context. Treat refs as compact
   advisory facts selected from repo usage and cache posture; native schemas,
   plan/preview, Helm rendering, and validators remain authoritative.

3. For reusable provider, module, chart, stack, or validation knowledge, prefer
   the deterministic metadata workflow:

   ```sh
   infra-agent knowledge resource <workspace> --domain <helm|pulumi|terraform> --resource <identity> --json
   infra-agent knowledge from-url <public-doc-url> --library-out <artifact.json> --json
   infra-agent knowledge sources <workspace>
   infra-agent knowledge prefetch <workspace>
   infra-agent knowledge extract <workspace>
   infra-agent knowledge pack <workspace>
   infra-agent knowledge index <workspace>
   infra-agent knowledge index <workspace> --resource <identity> --field-path <field> --json
   infra-agent knowledge validate <artifact> --workspace <workspace>
   infra-agent knowledge library-from-url <public-doc-url> --library-out <library-artifact.json> --json
   infra-agent knowledge library-stage <library-artifact.json> --workspace <workspace> --store-dir <dir> --registry <registry.json> --json
   infra-agent knowledge library-catalog <registry.json|registry-url> --domain <helm|pulumi|terraform> --resource <identity> --json
   infra-agent knowledge library-download <registry.json|registry-url> --coordinate <coordinate> --workspace <workspace> --store-dir <dir> --review-out <review.json> --json
   infra-agent knowledge library-refinement-review <library-artifact.json> --json
   infra-agent knowledge library-refinement-run <library-artifact.json> --out <refined-url-report.json> --json
   infra-agent knowledge library-refinement-apply <library-artifact.json> --refined <url-report.json> --out <updated-library-artifact.json> --json
   ```

   Use `--resource <identity>` instead of `--target <path>` when the user names
   a Terraform resource/data-source type or address, Pulumi resource token, Helm
   chart, release, Argo CD application, or namespace identity. Resource-scoped
   knowledge commands must resolve to matched inventory targets first and must
   not fall back to whole-workspace knowledge when the resource is unmatched.
   Prefer `knowledge resource --resource <identity> --json` as the one-shot
   handoff when another agent needs repo-linked targets, suggested files,
   source cache posture, compact refs, a bounded five-unit knowledge pack, and
   a unit index for a named resource. Treat `summary.acceptanceStatus` as the
   authoritative readiness field. Trust the report as acceptance-ready only when
   `summary.acceptanceStatus` is `ready`, `summary.cacheReady` is true,
   `summary.unitTypeComplete` is true, and `summary.missingUnitTypes` is empty.
   Treat `cache-refresh-needed` as a prompt to run the lower-level `sources`,
   `prefetch`, `extract`, `pack`, and `index` commands, `unmatched-resource` as
   an identity/scoping problem, and `partial-unit-coverage` as compact but
   incomplete context under the current unit budget.
   Use `knowledge from-url <public-doc-url> --json` when the caller provides
   only a public official documentation URL and asks for compact agent-ready
   public-reference knowledge without repo linkage. This path must not require
   a workspace; it infers the supported source identity from the URL, emits
   grouped compact `fact`, `guidance`, `example`, `diagnostic`, and `recipe`
   units, reports `summary.qualityStatus`, and includes a
   `centralLibraryCandidate` for reviewed public-reference reuse. Check the
   `download` trace to confirm whether the primary URL or a documented fallback
   produced the selected source, use
   `centralLibraryCandidate.classification.coordinates` as the stable
   downloadable-library coordinate, check
   `centralLibraryCandidate.classification.versionResolution` to see whether a
   mutable alias such as `latest` was resolved to a concrete provider version,
   and check `download.usedUrl` when fallback was used. For Terraform Registry
   `latest` URLs, a resolved provider version should make raw provider docs
   come from the resolved version tag before `main` or `master`. Pulumi
   Registry resource URLs are supported as unversioned public package docs, and
   Artifact Hub Helm chart URLs are supported as chart-docs public references
   with coordinates such as
   `helm/chart/prometheus-community/kube-prometheus-stack/unversioned`.
   Pulumi URL inputs should use
   `download.strategy: "official-url-primary-only"`. Artifact Hub Helm chart
   URL inputs may use
   `download.strategy: "artifacthub-page-then-package-api-readme"` when the
   page itself is not extractable, but must not use Terraform raw-provider
   fallbacks. Treat
   `llmRefinementInput` as the
   explicit offline LLM review contract. Its `reviewPacket` is the bounded
   evidence packet for future model refinement: classification,
   version-reference stability, version resolution, source hash, compact
   download evidence with a trace hash, compact source-outline headings and
   section signals, compact unit-digest path samples and identity/replacement
   counts, unit counts, quality signals, review checks, and rejection
   criteria. Add
   `--library-out <artifact.json>` when preparing a
   downloadable central-library artifact; the artifact is a local,
   review-required `infra-agent.public-knowledge-library-artifact`, not an
   upload or approval to publish. Run
   `knowledge validate <url-knowledge.json> --json` before LLM refinement, and
   `knowledge validate <artifact.json> --json` before registry staging or
   download reuse; validation checks source identity, coordinate coherence,
   version-reference drift, version-resolution drift, download trace shape,
   source-outline drift, fallback ordering, LLM download evidence drift, unit
   counts, required discovery tags, unit hash when present, unit-digest drift,
   review packet drift, and raw-content omission.
   Use `knowledge library-from-url <url> --library-out <artifact.json> --json`
   as the one-shot central-library producer path when the caller wants a
   downloadable public-reference artifact directly from official docs. It
   reuses URL download, version resolution, classification, compact extraction,
   quality, and artifact validation; with `--refine --refined-out
   <url-report.json>` it runs the bounded OpenAI-compatible model refinement
   step and persists the model output for review before rebuilding the final
   artifact. If `--workspace`, `--store-dir`, and `--registry` are supplied
   together, it stages the final artifact into a local content-addressed
   public-library registry. It must not upload, publish remotely, approve
   trust, or fetch additional docs during refinement.
   Use `knowledge library-stage <artifact.json> --workspace <workspace>
   --store-dir <dir> --registry <registry.json> --json` only after validation
   when preparing local downloadable-registry metadata. It writes a
   content-addressed artifact and an
   `infra-agent.public-knowledge-library-registry` file under the workspace;
   it is not a remote upload, trust decision, or publication approval. Add the
   local registry path, or a secret-free URL for an equivalent reviewed public
   registry, to `infra-agent.config.json` under
   `knowledgeSources.publicLibraryRegistries` when a workspace should reuse
   reviewed public-reference artifacts through `knowledge sources`, `extract`,
   `pack`, or `resource`. Run `knowledge prefetch <workspace>` first for
   URL-backed registries so the registry and matching artifacts enter the local
   cache. Public-library registry matching covers Terraform provider/resource
   usage, Pulumi package/resource tokens, and Helm chart names. Extraction
   verifies the registered artifact content hash before exposing units as
   `public-knowledge-library-artifact` sources. Use
   `knowledge validate <registry.json> --json` before sharing or configuring a
   public registry; validation checks coordinates, artifact locations, hashes,
   media type, the compact `llmRefinement` index summary, quality status, and
   review-required posture. Registry entries preserve the offline review-packet
   hash, unit-type coverage, missing unit types, and quality score so an agent
   can decide whether the artifact is useful enough to download or refine.
   Use `knowledge library-catalog <registry.json|registry-url> --json` as the
   read-only central-library browse/search surface before artifact reuse. It
   validates a local registry file or secret-free registry URL, supports filters
   for domain, provider/package/chart, resource, version, tag, coordinate, and
   quality, and reports classification, resolved artifact path or URL, content
   hash, quality, unit-type coverage, missing unit types, and the LLM
   review-packet hash without fetching artifacts or embedding raw
   documentation.
   Use `knowledge library-download <registry.json|registry-url> --coordinate
   <coordinate> --workspace <workspace> --store-dir <dir> --json` after
   choosing one catalog coordinate. It validates the registry, copies or
   downloads the artifact, resolves relative artifact paths from URL registries,
   verifies the registry SHA-256 content hash, validates the artifact payload,
   rejects identity/version/unit/quality/LLM-review drift, and writes a
   workspace-relative content-addressed artifact. Add `--review-out
   <review.json>` when the next step is model refinement; the review report is
   built from the verified stored artifact path so the model handoff cannot
   race ahead of download validation. Treat it as local download/reuse, not
   upload, publication approval, or a trust decision.
   Use `knowledge library-refinement-review <library-artifact.json> --json`
   after generating or downloading a public-library artifact when a model
   needs a focused refinement handoff. It validates the artifact and emits
   resolved compact inputs, the review-packet hash, and a bounded prompt
   contract from `artifact.llmRefinementInput` without calling a model,
   fetching more docs, mutating the artifact, or embedding raw documentation.
   Use `knowledge library-refinement-run <artifact.json> --out
   <refined-url-report.json> --json` when the operator wants the CLI to call
   the configured OpenAI-compatible JSON model. It sends only the bounded
   review packet and compact inputs, validates the returned public URL report,
   rejects source/classification/download/source-outline/version drift, and
   writes the refined report. Model execution provenance stays in the run
   report while the refined URL report remains inside the existing validated
   URL-report contract. It must not fetch more docs, update registries,
   publish, or approve trust.
   Use `knowledge library-refinement-apply <artifact.json> --refined
   <url-report.json> --out <updated-artifact.json> --json` after model review
   returns a refined public URL report. It validates both inputs, rejects
   source/classification/version/download/source-outline drift, recomputes
   unit hashes and review metadata, and keeps review-required posture before
   registry staging.
   Treat `quality.status: "ready"` plus complete unit types as the acceptance
   signal for URL-only public knowledge. Use `knowledge resource` instead when
   the caller needs repo targets, suggested files, cache posture, or local usage
   linkage.
   Use the lower-level `sources`, `pack`, and `index` commands when debugging
   one stage or preparing an explicit prefetch.
   Use `knowledge index --resource <identity> --field-path <field> --json`
   when the caller needs compact field-level `fact`, `guidance`, `example`,
   `diagnostic`, and `recipe` metadata without loading unrelated fields from
   the same resource source.

   Use the validation report's freshness summary before trusting saved
   repo-derived facts. Treat `knowledge index` and compact `unitIndex` metadata
   as lookup metadata, not raw source content.

   For team reuse of reviewed units, publish only standalone
   `infra-agent.knowledge-units` artifacts through the lean shared registry
   path:

   ```sh
   infra-agent knowledge publish <knowledge-units.json> --workspace <workspace> --store-dir <dir> --registry <registry.json>
   ```

   This stages content-addressed files and updates registry JSON only. It is
   not a deployment/upload harness and must not be treated as approval to run
   cloud clients, read credentials, perform live backend checks, or execute
   infrastructure mutations.

4. Prefer bounded packs and compact JSON over raw docs or whole-repo bundles.
   Read `cache status`, `knowledgeFacts`, `knowledgeContext`, omitted counts,
   source freshness, and selector reasons before asking for more files.

5. Use read-only graph and report commands when they fit the task:

   ```sh
   infra-agent graph <workspace> --json
   infra-agent changed <workspace> --base main --head HEAD --json
   infra-agent impact-report <graph.json> --json
   infra-agent identity-report <agent-result.json> --json
   ```

   Use `changed` before broad file reads when a task is scoped to a branch or
   patch and needs the broader impact report. Use `pack --changed` when a
   downstream agent needs the smaller scoped handoff built from the changed
   component set. Both reports are advisory context only: they identify
   affected Helm/Pulumi/Terraform components, suggested inspection files,
   validation targets, unmapped files, and risk hints, but they do not replace
   native plan/preview/render validation.

6. Use `infra-agent agent "<task>" --workspace <workspace> --json` only when
   the caller explicitly wants the existing bounded planner/runtime result.
   Treat `agent --json` as a compact handoff artifact, not as permission to
   mutate infrastructure. Reserve `--json-full` for debugging.

7. If a result asks for approval, do not work around it. Ask the user or rerun
   with the requested approval flags only after the user approves that exact
   scope.

8. If validation fails, use the structured issue summary, sampled details,
   identity conflicts, safety blockers, and suggested next action before making
   a manual change.

9. Never run `terraform apply`, `pulumi up`, `helm upgrade`, Kubernetes
   mutation commands, or deployment commands as part of this skill.

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
- Use the canonical public target resolver for public Terraform/Pulumi/Helm
  examples. HashiCorp AWS provider docs, `@pulumi/aws`, and
  `kube-prometheus-stack` are generic regression anchors only; do not introduce
  provider-specific or chart-specific parser behavior for them.
- Treat `knowledgeFacts` as a ranked compact summary: local schemas and required
  fields should appear before examples under small budgets, but facts remain
  advisory and do not replace native validation, plan, preview, or provider
  schema context. Source freshness and fingerprint digest fields are handoff
  signals; stale or unchecked source facts should be revalidated or
  re-extracted and should not be used as high-confidence guidance.
- Treat `knowledge index` output and compact `unitIndex` metadata as
  deterministic retrieval metadata for `fact`, `guidance`, `example`,
  `diagnostic`, and `recipe` units. It must remain source-linked,
  raw-content-free, parser-neutral, and validated before planner use. A
  multi-source pack's source-level omitted distribution is estimate-only until
  exact per-source accounting exists.
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
