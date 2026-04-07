# Execution Target

## Purpose

This document pins the active product target for `infra-agent` so future development stays aligned with the intended scope.

It exists to prevent drift into adjacent agent-platform work before the core infrastructure-agent runtime is complete.

## Current Target

`infra-agent` is being developed as a `TypeScript` CLI agent for understanding, modifying, and validating `Helm` and `Pulumi` configuration in a repository workspace.

The active focus is the **general foundation runtime**, not the final repository-specific production version.

## What This Means In Practice

Current development should prioritize:

- repository inspection
- bounded planning and execution
- controlled editing
- validation-first iteration
- bounded repair loops
- approval and safety boundaries

Current development should not drift into:

- general agent platform work
- plugin systems
- skills marketplaces
- multi-agent orchestration
- chat UI or IDE productization
- deployment automation

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
5. Add repository-specific behavior for `scrawlr/infra-apps` and `scrawlr/infra-cloud`.
6. Only then consider higher-level agent-platform concerns.

## Current Runtime Boundary

The expected runtime boundary is:

- single CLI process
- single task per run
- single workspace per run
- Helm and Pulumi only
- no automatic apply or deploy
- no secrets generation

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

Validation should be part of the normal execution loop, not an optional afterthought.

## Current Approval Boundary

High-risk edits should surface explicit approval signals.

Approval behavior should become more explicit over time, but the immediate requirement is:

- identify high-risk rewrite operations
- stop before applying them without clear approval
- distinguish approval-required pauses from ordinary clarification

## Future Expansion Rule

Repository-specific behavior is expected and desirable, but only **after** the general foundation runtime is stable.

The next major adaptation layer should be:

- `scrawlr/infra-apps`
- `scrawlr/infra-cloud`

These repositories should shape future domain rules, validation conventions, and safety constraints.

## Change Control

If the product direction changes, this document should be updated before or alongside major implementation changes.
