# Testing

This repository keeps tests split by responsibility and runs them through
stable category entrypoints.

## Commands

- `npm run test:unit`: domain helpers, planner helpers, extraction, ranking,
  validation models, and focused output helpers.
- `npm run test:integration`: CLI and runtime flows that exercise multiple
  modules together.
- `npm run test:contract`: compact JSON, graph, report, and handoff schema
  contracts.
- `npm run test:all`: all category suites.
- `npm run test:coverage`: all category suites with Node's native coverage
  gate over `src/**/*.ts` (minimum 85% lines, 75% branches, 90% functions).
- `npm test`: structure guard plus all category suites.
- `npm run package:check`: package dry-run for shipped file surface.
- `npm run verify`: full local gate: lint, structure, unit, integration,
  contract, smoke, e2e, coverage, and package dry-run.
- `npm run test:focused -- --test-name-pattern "<pattern>" <runner-or-shard>`:
  focused checks while developing.

## Live Network Knowledge Extraction

Normal CI and the default local test commands do not fetch public docs. The
live network extraction smoke in
`test/integration/cli-knowledge-network-extraction-main.test.mjs` is opt-in:

```sh
INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1 npm run test:integration -- cli-knowledge-network-extraction-main
```

Without `INFRA_AGENT_LIVE_KNOWLEDGE_TESTS=1`, the shard only verifies that the
canonical public extraction targets are defined and then returns without using
the network. With the env var set, it fetches the canonical targets into a temp
cache, validates cache/source shape and normalized content, and validates any
emitted `infra-agent.knowledge-units` payloads. If the machine cannot reach the
network, the shard no-ops safely rather than requiring committed skips.

The canonical v0 live targets are:

- Terraform: HashiCorp AWS provider docs at
  `https://registry.terraform.io/providers/hashicorp/aws/latest/docs`.
- Pulumi: Pulumi AWS package/provider docs at
  `https://www.pulumi.com/registry/packages/aws/api-docs/`.
- Helm: `kube-prometheus-stack` public chart docs.

Do not turn live public docs into brittle full-content goldens. Assert source
identity, cache write/read shape, normalization metadata or content type,
redaction/no raw HTML, stable target identity signals, and schema-valid
five-unit payloads when extraction emits units.

## Layout

- Put unit shards directly under `test/unit/`.
- Put integration shards directly under `test/integration/`.
- Put contract shards directly under `test/contract/`.
- Put only narrow shared fixtures or capture helpers under `test/support/`.
- Do not add nested test shard directories. Category runners discover only
  direct `.test.mjs` files.
- Do not restore a broad `test/support/cli-smoke-harness.mjs` helper or a
  monolithic `test/cli-smoke.test.mjs` shard.

`test/run-category.mjs` discovers category shards in stable filename order, so
new direct shard files do not need manual runner imports.

## Guardrails

`npm run test:structure` enforces the test layout:

- no root-level `.test.mjs` shards
- no nested category shards
- no test-like files outside direct `test/unit`, `test/integration`, or
  `test/contract` `.test.mjs` shards
- no broad smoke harness helper imports
- no committed `.only` or `.skip` tests
- `.test.mjs` shards at or below 1,000 lines
- `test/support/*.mjs` helpers at or below 1,000 lines
- category runners must use `test/run-category.mjs`
- `test/run-isolated.mjs` must reuse category discovery and execute each shard
  in a separate Node process
- `package.json` must keep category, coverage, and verification scripts wired
  into the expected gates
- `.github/workflows/verify.yml` must keep read-only permissions, concurrency,
  timeouts, separated category jobs, coverage, smoke/e2e, and package dry-run
  gates

When a shard approaches the size cap, split it by behavior before adding more
coverage.

## CI

GitHub Actions intentionally reports failures by layer instead of hiding them
behind one aggregate job:

- `static`: lint, test-structure guard, and package dry-run.
- `unit`, `integration`, `contract`: category-specific test jobs.
- `isolated-shards`: reruns every shard in an independent Node process after
  the category gates.
- `smoke-e2e`: realistic CLI smoke and E2E checks after the category gates.
- `coverage`: native Node coverage thresholds after static and category gates.
