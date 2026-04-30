# Repository Conventions

## Language and Runtime

- Primary language: TypeScript
- Runtime target: Node.js CLI
- Module style: ESM unless the repository later proves a different need

## Intended Source Layout

```text
src/
├── cli/
├── agent/
├── tools/
├── validators/
├── domain/
├── prompts/
└── types/
```

## Directory Responsibilities

- `src/cli/`: argument parsing, command dispatch, terminal output
- `src/agent/`: execution loop, state transitions, orchestration
- `src/tools/`: repository and command tools
- `src/validators/`: Helm and Pulumi validation adapters
- `src/domain/`: Helm and Pulumi repository detection and normalization
- `src/prompts/`: system instructions and task framing
- `src/types/`: shared runtime and domain types

## Naming

- File names: `kebab-case` for file system paths unless a strong TypeScript convention suggests otherwise
- Functions: `camelCase`
- Types and interfaces: `PascalCase`
- Constants: `UPPER_SNAKE_CASE` only when values are stable constants

## Code Organization

- Keep orchestration logic out of tool modules.
- Keep validator adapters separate from repository inspection logic.
- Keep domain inference logic deterministic where possible.
- Prefer one public responsibility per file.

## Validation Expectations

When code is added, the repository should eventually support:

- static type checking
- unit tests for deterministic domain logic
- integration tests for validator adapters
- smoke tests for broad CLI regressions
- E2E tests through the full runtime path when behavior must match the
  user-facing command contract and actual file effects

These should be added only when the corresponding implementation slice exists.
