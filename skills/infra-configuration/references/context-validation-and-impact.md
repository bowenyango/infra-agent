# Context, Validation, And Impact Reference

Load this reference only for tasks that require official documentation, module
semantics, replacement analysis, rename detection, or topology graph planning.

## Source Priority

1. Repository files and examples
2. Lockfiles, provider schemas, chart schemas, and module validation rules
3. Native tool output such as `helm template`, `terraform validate`,
   Terraform plan JSON, and Pulumi preview events
4. Official docs for the exact resolved version
5. LLM inference, marked as uncertain until validated

Do not pass full docs to the model when a schema, focused excerpt, or validator
message is enough.

## Agent-Facing Output

- Prefer `infra-agent agent "<task>" --workspace <workspace> --json` when
  another agent will consume the result.
- The `--json` agent output is compact and uses kind
  `infra-agent.agent-result`.
- Use `--json-full` only for debugging because it includes the complete runtime
  state and can carry more context than another agent should need.

## Official Docs Strategy

Use a hybrid cache:

- Store fetched docs and examples in a local version-aware cache.
- Cache by source, provider/module/chart/package, version, URL or path, hash,
  fetched time, and stale-after policy.
- Refresh dynamically when the requested version is missing or stale.
- Prefer local provider and chart schemas over cached prose.

Current cache foundation:

- The CLI has `KnowledgeSource`, `KnowledgeCacheEntry`, and
  `RetrievedContextPacket` types.
- The local cache adapter stores JSON entries with source metadata, content hash,
  fetched time, and stale-after policy.
- The resolved cache root is visible from workspace inspection. Precedence is:
  `INFRA_AGENT_KNOWLEDGE_CACHE`, then workspace-config
  `knowledgeCache.root`, then the user cache directory.
- Workspace-config cache roots must be relative paths inside the workspace;
  absolute or escaping paths should be rejected before any cache write.
- Context retrieval is cache-first and returns compact
  `RetrievedContextPacket` excerpts instead of whole documents.
- Missing or stale sources can be refreshed through an explicit fetcher. If
  fresh retrieval fails but a version-scoped cached entry exists, the retriever
  may return the stale entry with medium confidence.
- A first official URL fetcher abstraction exists, but automatic official-doc
  selection from planner/runtime flows is not implemented yet.
- Terraform Registry context selection now exists for Terraform resource and
  data-source docs. It uses `required_providers` plus `.terraform.lock.hcl`
  provider versions when available, then retrieves compact packets through the
  cache layer.
- Terraform agent runs load cached Terraform Registry packets for selected
  Terraform roots into planner prompts. The runtime does not automatically fetch
  missing docs from the network yet.
- Helm chart context selection exists for repo-local `values.schema.json`, Helm
  schema docs, and chart `home`/`sources` metadata. Treat local chart schema
  packets as higher authority than external chart docs.
- Helm agent runs load selected chart schema packets into runtime prompts for
  Helm-focused tasks. External Helm/chart docs should only appear when already
  present in the version-aware cache or fetched by a deliberate prefetch path.

The CLI package should bundle retrieval logic and small durable rules, not full
Terraform, Pulumi, Helm, or provider documentation.

## Validation Layers

Always validate syntax before domain validation.

- YAML: parse touched `.yaml` and `.yml` files before accepting writes. The CLI
  uses its bundled `yaml` npm dependency for ordinary YAML parsing.
- Helm files under `templates/` are Go templates, not plain YAML. Do not block
  them with raw YAML parsing; rely on `helm template` for rendered syntax.
- Helm: run `helm lint` and `helm template`; use `values.schema.json` when
  present; optionally validate rendered manifests with Kubernetes schemas.
- Terraform: run `terraform fmt -check` and `terraform validate`; use provider
  schemas and plan JSON when initialized and safe.
- Pulumi: run `pulumi preview`; inspect stack config; run language checks when
  the project type makes them obvious.
- Policy tools such as `tflint`, `checkov`, `conftest`, and `kubeconform` should
  be workspace-configured until the repo proves they are standard.

## Module Semantics

Capture constraints as structured facts:

- required field
- defaulted field
- enum
- mutually exclusive fields
- exactly-one or at-least-one groups
- field implies another required field
- selected mode disables other fields
- identity field
- likely replacement field
- dependency edge

Each fact needs a source and confidence. Low-confidence LLM-inferred facts should
not block a run unless confirmed by repo files or tools.

Current implemented source:

- Helm `values.schema.json` is detected during workspace inspection.
- The first extraction pass records `required-field`, `defaulted-field`, `enum`,
  and `exactly-one-group` facts from chart values JSON Schema.
- Terraform variable blocks are detected during workspace inspection.
- The first Terraform extraction pass records `required-field`,
  `defaulted-field`, `type-constraint`, `validation-rule`, and
  validation-derived `enum` facts from `.tf` variable declarations.
- These facts are focused to top candidate targets before being sent to the
  planner.
- Terraform tfvars edit plans now block requested environment values that
  violate extracted enum facts.
- Pulumi `Pulumi.yaml` and `Pulumi.<stack>.yaml` files are detected during
  workspace inspection.
- The first Pulumi extraction pass records `type-constraint`,
  `defaulted-field`, and `configured-field` facts without exposing secret
  `secure` values.
- Pulumi stack edit plans use these facts to reuse established config keys and
  namespaces before falling back to project names.
- Pulumi preview missing-config failures are promoted into runtime
  `required-field` facts sourced from `pulumi-preview`.
- Terraform tfvars edit plans use extracted `type-constraint` facts when
  rendering scalar values.
- Result cards expose validation-derived Pulumi preview `required-field`
  semantic blockers in a compact `Semantic blockers` line. Treat a non-`none`
  value there as structured validator-backed context, not generic prose.

## Rename And Replacement Impact

Before accepting delete/create output as a real replacement, compare:

- resource type
- provider/package
- stable identity attributes
- module or stack path
- dependency edges
- old and new logical names

High-confidence source-address renames should produce guidance such as moved
blocks, aliases, or state-move review. The skill should not execute state
mutations by default.

For true replacements, explain:

- field or identity change that triggered replacement
- downstream resources affected by dependency edges
- whether an in-place update appears possible
- whether the confidence came from plan/preview output or heuristic inference

## Graph Planning

Graph JSON should come before a web topology viewer.

Minimum graph nodes:

- stack, module, chart, and manifest/resource nodes
- provider type and logical address
- environment and workspace target
- create/update/delete/replace action when known
- confidence and source

Minimum graph edges:

- explicit dependencies
- rendered owner or selector relationships
- network or exposure relationships when inferable
- module/stack/chart containment

The UI should remain local-only and downstream of graph JSON.
