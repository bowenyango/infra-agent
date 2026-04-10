# Execution Target

## Purpose

This document pins the active product target for `infra-agent` so future development stays aligned with the intended scope.

It exists to prevent drift into adjacent agent-platform work before the core infrastructure-agent runtime is complete.

## Current Target

`infra-agent` is being developed as a `TypeScript` CLI agent for understanding, generating, modifying, and validating infrastructure configuration in a repository workspace.

The active infrastructure domains are:

- `Helm`
- `Pulumi`
- `Terraform`

The active focus is the **general foundation runtime**, not the final repository-specific production version.

There is also a pinned future expansion target:

- after the CLI runtime is stable, add a local visualization server that shows the inferred infrastructure topology

## What This Means In Practice

Current development should prioritize:

- repository inspection
- bounded planning and execution
- controlled editing
- validation-first iteration
- bounded repair loops
- approval and safety boundaries
- clear summaries and clarification flows for non-Infra contributors

Current development should not drift into:

- general agent platform work
- plugin systems
- skills marketplaces
- multi-agent orchestration
- chat UI or IDE productization
- deployment automation
- visualization server work before the CLI runtime is complete

## Design Reference

The runtime shape should continue borrowing from Claude Code where it is useful:

- query loop
- tool-driven execution
- structured runtime state
- tool result writeback
- permission and approval boundaries

This does **not** mean copying Claude Code as a product surface.

The goal is to borrow the runtime architecture, not to recreate an all-purpose coding assistant.

## Active Priorities

Development should continue in this order unless explicitly changed:

1. Strengthen the core runtime.
2. Improve controlled editing behavior.
3. Improve validation and repair behavior.
4. Improve approval and safety behavior.
5. Add `Terraform` as a first-class supported domain beside `Pulumi` and `Helm`.
6. Add repository-specific behavior for real infrastructure repositories.
7. Only then consider higher-level agent-platform concerns.
8. After the CLI runtime is stable, add a local visualization server for inferred infrastructure topology.

## Current Runtime Boundary

The expected runtime boundary is:

- single CLI process
- single task per run
- single workspace per run
- Helm, Pulumi, and Terraform only
- no automatic apply or deploy
- no secrets generation
- no requirement that the caller already understands internal Infra conventions

## Current Editing Boundary

The editing system is expected to prefer:

- `create`
- `append`
- `replace`

and treat:

- `rewrite`

as a higher-risk fallback that should surface stronger approval signals.

## Current Validation Boundary

The default validation contract remains:

- `helm lint`
- `helm template`
- `pulumi preview`
- `terraform fmt -check`
- `terraform validate`

Validation should be part of the normal execution loop, not an optional afterthought.

## Current Approval Boundary

High-risk edits should surface explicit approval signals.

Approval behavior should become more explicit over time, but the immediate requirement is:

- identify high-risk rewrite operations
- stop before applying them without clear approval
- distinguish approval-required pauses from ordinary clarification

## Future Expansion Rule

Repository-specific behavior is expected and desirable, but only **after** the general foundation runtime is stable enough across Helm, Pulumi, and Terraform.

The next major adaptation layer should be:

- the user's local infrastructure repositories, starting with `scrawlr/infra-apps` and `scrawlr/infra-cloud` when appropriate

These repositories should shape future domain rules, validation conventions, Terraform conventions, and safety constraints.

## Future Visualization Target

The visualization target should be treated as a separate phase after the CLI is reliable.

The intended shape is:

- local server, not cloud-hosted service
- read repository-derived infra graph data from the CLI/runtime layer
- show topology views that non-Infra users can understand

The first visualization provider should likely be AWS, with views such as:

- which resources are inside the same VPC
- which resources are public vs private
- which resources can likely communicate because of shared or connected security groups
- how load balancers, services, compute, and data stores are connected

This should remain repository-derived and inference-based at first, not dependent on direct cloud account reads.

Provider support should be extensible over time so later versions can add other clouds and platforms without changing the core CLI runtime boundary.

## Change Control

If the product direction changes, this document should be updated before or alongside major implementation changes.
