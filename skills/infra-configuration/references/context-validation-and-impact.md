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

## Official Docs Strategy

Use a hybrid cache:

- Store fetched docs and examples in a local version-aware cache.
- Cache by source, provider/module/chart/package, version, URL or path, hash,
  fetched time, and stale-after policy.
- Refresh dynamically when the requested version is missing or stale.
- Prefer local provider and chart schemas over cached prose.

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
