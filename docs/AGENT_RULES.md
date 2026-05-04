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
- For local Terraform provider schema context, use only root-scoped exports such as `.infra-agent/terraform-provider-schema.json` or `.infra-agent/terraform-providers-schema.json`. Extract compact facts for resources used by the selected root, preserve `.terraform.lock.hcl` provider version labels when available, do not pass full provider schema JSON into planner prompts, and do not infer replacement safety from schema shape alone.
- For Helm context, prefer repo-local `values.schema.json` packets over external Helm or chart docs.
- For Helm dependency context, prefer repo-local `Chart.lock` over dependency repository prose. Treat HTTP(S) dependency repositories as fetch candidates and skip non-document schemes such as `file://` or `oci://`.
- Helm planner prompts may include selected chart schema packets by default. External Helm/chart docs must stay cache-only unless a deliberate fetch or prefetch path populated them.
- Use `infra-agent prefetch` for deliberate official-doc cache updates. Keep prefetch bounded with `--domain`, `--target`, and `--max-sources` when the workspace has many resources.
- Planner prompts may include cached retrieved-context packets. Keep these compact and targeted; do not inject whole official docs into the prompt.
- LLM planner client tests must use injected transports or mocked fetchers. Do not make unit, smoke, or E2E tests depend on live LLM providers or external network availability.
- Test LLM planner mode and environment selection through explicit environment maps. Avoid mutating `process.env` in tests unless a behavior specifically requires process-level integration.
- Follow `docs/CLAUDE_CODE_AGENT_PATTERNS.md` when evolving the harness: prefer compact structured turn traces, tool summaries, and explicit permission/validation state over raw logs or full runtime snapshots in agent-facing output.
- Tool summaries must preserve permission categories for workspace mutation, native CLI execution, and stack/state mutation-risk tools. Do not collapse these into generic "tool ran" prose.
- Workspace approval policy may require explicit approval for tool categories such as `native-stack-config-write`; use `--approve-tool-category <category>` to resume only when the user has approved that category.
- Planner prompts must pass retrieved official-doc/schema context through the context budget helper. Do not inject full cached documents or unbounded excerpts into LLM prompts.
- Treat retrieved context packet/token budgets as query harness configuration. Prefer `--context-packet-limit` and `--context-token-budget` for experiments instead of changing budget constants ad hoc.
- Use compact `agent --json` output for agent-to-agent handoff; reserve `--json-full` for debugging complete runtime state.
- Compact `infra-agent.agent-result` consumers must validate the shallow
  handoff contract before deriving secondary reports. Check `kind`,
  `schemaVersion`, known `outcome`, compact trace array shape, readiness check
  array shape when present, and `validation.identityConflicts` before treating
  the payload as an agent result.
- Keep compact `agent --json` readiness targeted: include planner mode, workspace blocker status, selected validation-plan status, and validators required by that selected plan, plus a `doctorCommand` for fuller read-only checks. Do not include API keys or unrelated validator noise.
- Surface readiness posture in result cards, and include the read-only
  `doctorCommand` in suggested commands when readiness is warn or fail. Do not
  let this replace approval continuation commands when an approval gate is the
  active blocker.
- Treat compact `approval.resume` as a structured handoff for the existing
  approval gate. It can show the scoped continuation command and active signal
  scope, but it is not approval and must not authorize writes or native
  operations without explicit user approval.
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
  before deeper agent runs. Never expose API keys or secrets in doctor output.
- Treat `unsafe-validation-command` validation issues as hard safety blockers.
  The validation tool must block deploy, apply, state mutation, Helm release
  mutation, and Kubernetes mutation commands before spawning them. Remove the
  unsafe command from workspace config or planner output instead of asking the
  tool to run it.
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
- Use `infra-agent identity-report <agent-result.json>` when a human operator or downstream agent needs a focused runtime exclusive-identity incident report from an existing compact result. This command is read-only and must not rerun validators or mutate state.
- `identity-report` inputs must be compact `infra-agent.agent-result` JSON with `schemaVersion=1` and `validation.identityConflicts`; do not point it at graph JSON, full debug state, native plan JSON, or raw CLI logs.
- When `suggestedCommands` includes an `agent --json > agent-result.json` export followed by `identity-report agent-result.json --json`, treat that as a read-only reporting handoff for exclusive-identity triage, not as approval to rerun apply/update or mutate state.
- Use `infra-agent graph --json` as the topology handoff surface. Treat it as inspection-derived structure until plan/preview impact data is explicitly attached.
- Use `infra-agent graph --terraform-plan <plan.json> --target <terraform-root> --json` to attach Terraform plan actions without executing Terraform. Treat replacement and rename guidance as advisory until reviewed against state.
- Use `infra-agent graph --pulumi-preview <preview.json> --target <pulumi-project> --json` to attach Pulumi preview actions without executing Pulumi.
- Keep graph contract changes covered by stable graph snapshots before building or changing topology UI behavior. Update snapshot fixtures deliberately when graph semantics change, not as incidental churn.
- When handing graph output to another agent, prefer compact `summary.impact`
  fields, especially `riskLevel`, `primaryConcern`, `recommendedAction`, and
  review-only `reviewSteps`, plus prioritized `reviewTargets`,
  `omittedReviewTargets`, `mutationAllowed=false`, and the `Impact` text
  section before pasting full `nodes` and `edges`. Each review target includes
  its own `priority`, `mutationAllowed=false`, `recommendedAction`,
  `riskCategory`, and `reviewSteps`; use those per-edge fields before
  re-reading full graph edges or duplicating kind-to-action mappings.
- Treat graph nodes with `metadata.role=dependency-context` as relationship context only. They explain unchanged upstream resources needed by `depends-on` edges and must not be counted as planned changes unless a `planned-change` edge and `metadata.action` are also present.
- Treat graph replacement reason metadata such as `replacementReasons`, `replacementReasonCategories`, and `dependencyReplacementReasons` as advisory provider/schema context. Use it to explain why a replacement or cascade is likely, but confirm with native plan/preview output and state before recommending state mutation or downtime.
- Treat graph `possible-rename` edges as review candidates only, even when confidence is high. Use `score`, `matchingIdentityKeys`, and `reason` metadata to explain the candidate, but do not execute `terraform state mv`, write moved blocks, or mutate Pulumi state without explicit user approval and a human-reviewed address mapping.
- For Pulumi rename candidates, require more than a namespace-only Kubernetes match before suggesting review.
- Treat graph `depends-on` and `replacement-cascade` edges as impact explanation, not approval to apply. Use them to explain likely downstream blast radius and why a dependent changed, then confirm with native plan/preview output.
- Treat graph `create-before-delete-conflict` edges as high-risk ordering warnings. These are common when a provider resource has an exclusive physical identity and Pulumi or Terraform plans creation before deletion. Remediation candidates are Pulumi aliases or Terraform moved blocks/state moves for logical renames, `deleteBeforeReplace`/delete-before-create/manual sequencing for true replacements with accepted downtime, or explicit state/import repair after human approval.
- Treat runtime `pulumi-create-before-delete-conflict` and `terraform-create-before-delete-conflict` validation issues the same way, including DNS/domain families such as CloudFront aliases, API Gateway custom domains, and Route53 records, plus listener rules, security group rules, and IAM OIDC providers. They are blockers, not bounded automatic repairs. Terraform runtime classification is for captured plan/apply failure output only; it does not authorize running apply.
- Runtime exclusive-identity validation issues should reuse the shared graph exclusive identity specs when a resource type is parseable. Preserve `conflictFamily`, `conflictLabel`, and `conflictSuggestedAction` metadata for downstream agents, but keep suggestions review-only until native plan/preview/state is checked.
- Compact `agent --json` output should expose runtime exclusive-identity blockers through `validation.identityConflicts` so downstream agents can consume engine, family, identity fields, `riskCategory`, source command, and suggested review action without parsing raw stderr or long guidance strings.
- Preserve Terraform `resourceAddress` and Pulumi `resourceName` metadata for runtime exclusive-identity blockers when parseable. Treat these as IaC locator candidates for review, not as approval to write moved blocks, aliases, imports, state moves, or stack mutations.
- Preserve `validation.identityConflicts[].riskCategory` as a triage grouping, not a remediation decision. Current categories include `create-before-delete-ordering`, `dns-or-domain-ownership`, `physical-name-ownership`, `kubernetes-object-ownership`, and `exclusive-identity-review`.
- Planner prompts should expose the same runtime exclusive-identity blockers as compact `runtimeIdentityConflicts`, including `riskCategory`, locator fields, parsed identity, and review steps. Treat this as low-noise blocker context for the planner, not as permission to plan or execute Terraform state moves, Pulumi aliases/imports, DNS changes, Kubernetes ownership changes, deletion, or stack mutation.
- Preserve `validation.identityConflicts[].reviewSteps` as a review-only checklist. It may suggest moved blocks, aliases, import/state repair, or sequencing analysis, and it may include family-specific identity checks such as routes, listener priorities, security permissions, DNS/domain ownership, OIDC URLs, named AWS resources, or Kubernetes name/namespace ownership. It must not trigger state or stack mutation without explicit approval and human-reviewed mappings.
- Preserve `infra-agent.identity-conflict-report.mutationAllowed=false`. Treat that report as incident triage only; it is not a remediation plan and does not authorize Terraform state, Pulumi stack, import, alias, DNS, or Kubernetes object changes.
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
