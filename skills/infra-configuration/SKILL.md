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
   ```

3. For reusable provider, module, chart, stack, or validation knowledge, prefer
   the deterministic metadata workflow:

   ```sh
   infra-agent knowledge sources <workspace>
   infra-agent knowledge prefetch <workspace>
   infra-agent knowledge extract <workspace>
   infra-agent knowledge pack <workspace>
   infra-agent knowledge index <artifact>
   infra-agent knowledge validate <artifact> --workspace <workspace>
   ```

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
   Read `knowledgeFacts`, `knowledgeContext`, cache posture, omitted counts,
   source freshness, and selector reasons before asking for more files.

5. Use read-only graph and report commands when they fit the task:

   ```sh
   infra-agent graph <workspace> --json
   infra-agent impact-report <graph.json> --json
   infra-agent identity-report <agent-result.json> --json
   ```

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
