# Agent Rules

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
- Run `terraform fmt -check` when Terraform files change.
- Run `terraform validate` when Terraform configuration changes.
- Use validation failures to refine results instead of stopping after first generation.

## 13. Safety

- Never introduce secrets or credentials into code or committed configuration.
- Reuse existing secret management patterns when present.
- Do not perform destructive actions without explicit instruction.
- Respect permission and execution boundaries.
- Treat production-targeting changes as approval-sensitive by default.

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
- For Terraform Registry docs, prefer provider source and locked provider version from `required_providers` and `.terraform.lock.hcl` before falling back to local-name heuristics.
- Use compact `agent --json` output for agent-to-agent handoff; reserve `--json-full` for debugging complete runtime state.
- The agent must not call deploy or apply commands in version `v0`.
- The agent should stop and ask for clarification when any of these are ambiguous:
- target environment
- target service or chart
- stack ownership
- Terraform root or module ownership
- secret source
- ingress hostnames or external endpoints
