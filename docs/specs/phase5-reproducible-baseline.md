# Phase 5: Reproducible Ozer Baseline

## Problem
Ozer has no code yet. Before any privacy feature is built, the project
needs a minimal, reproducible, end-to-end skeleton across its three
runtime boundaries (browser extension, local companion, server
reasoning) so that Phase 6+ work has real seams to build against instead
of a paper architecture.

## Evidence
- `CONTEXT.md`: architectural constraint —
  `RAW DATA -> LOCAL DETECTION -> LOCAL REDACTION -> SANITIZATION ASSERTION -> NETWORK`.
- `docs/adr/0003-browser-use-integration-strategy.md`: browser-use is a
  Python companion process, never extension code; typed actions cross
  the boundary, never raw screenshots.
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md`: git+Markdown
  remain canonical; no dependency on this phase.
- SIH judging metrics (`CONTEXT.md`): visual accuracy 25%, PII
  recall/precision 20%, redaction precision 20%, client resource
  utilization 20%, latency 15%.

## Goal
A minimal but real, testable, reproducible "hello world" that exercises
the full intended data path with **no sensitive data involved yet**:
extension → server (reasoning stub) → companion (execution stub), with
shared, versioned schemas for the two contracts that matter
architecturally (sanitized context, typed action). Locked runtime
versions. A test harness that actually runs.

## Non-goals
- No real privacy detection, redaction, or vision (Phase 7/8).
- No real browser-use integration yet (Phase 9) — companion's execution
  endpoint is a stub that returns a fixed result, not a live browser
  action.
- No real LLM-backed reasoning — server's `/reason` endpoint returns a
  deterministic, hardcoded typed action for a fixed input, proving the
  contract, not intelligence.
- No production packaging/distribution (extension store listing, CI/CD).

## Constraints
- Runtimes must match what later phases actually need: Python
  `>=3.11,<4.0` (matches browser-use's own constraint per ADR 0003,
  since the companion will depend on it in Phase 9), Node `>=20` for
  extension tooling.
- Extension must target Manifest V3 (Chrome) with WebExtensions
  compatibility path for Firefox — per `CONTEXT.md`'s target-browser
  constraint. No framework lock-in beyond what's needed for a minimal
  background-script hello-world.
- Schemas must be a single source of truth two different runtimes
  (JS extension, Python server/companion) can both validate against —
  JSON Schema, not a language-specific type system.
- No network egress beyond `localhost` in this phase — the whole
  point is a local skeleton, not a deployed service.

## Architecture

```
extension/  (Manifest V3, JS, Chrome + Firefox via webextension-polyfill)
  background.js --HTTP(localhost)--> server/  /reason
      |
      v (typed action returned)
  background.js --HTTP(localhost)--> companion/  /execute

server/     (Python, FastAPI)
  POST /reason  {sanitized_context} -> {typed_action}   [stub logic]
  GET  /health

companion/  (Python, FastAPI)
  POST /execute {typed_action} -> {execution_result}    [stub logic]
  GET  /health

schemas/    (JSON Schema, source of truth for both contracts)
  sanitized-context.schema.json
  typed-action.schema.json
```

Monorepo layout, single Ozer repo, three independently runnable
components plus a shared schema directory — not a fourth "shared code"
package yet (premature at this size).

## Interfaces

**`SanitizedContext`** (extension → server): `{version, page_url_hash,
elements: [{id, role, text}], timestamp}`. Deliberately excludes
anything resembling a real DOM/screenshot payload at this phase — it's a
contract shape proof, not real sanitization (that's Phase 7).

**`TypedAction`** (server → extension → companion): `{version, action,
target_id, value}` where `action` is an enum (`click`, `noop` for this
phase's stub).

**`ExecutionResult`** (companion → extension): `{version, status,
detail}`.

## Acceptance Criteria
- `server/` starts, `/health` returns 200, `/reason` given a valid
  `SanitizedContext` returns a schema-valid `TypedAction`.
- `companion/` starts, `/health` returns 200, `/execute` given a valid
  `TypedAction` returns a schema-valid `ExecutionResult`.
- `extension/` loads unpacked in Chrome (Manifest V3) without console
  errors, and its background script can complete one full round trip
  (build a fixed sanitized context → POST to server → receive typed
  action → POST to companion → receive execution result) — proven via a
  headless test, not manual clicking, since this session has no way to
  manually load a browser UI.
- Both schemas validate their respective example payloads.
- `pytest` passes for server and companion.
- A Node-based test (schema validation + a mocked round trip of the
  extension's core logic function, extracted so it's testable outside
  the browser) passes.

## Test Plan
- `server/tests/test_reason.py`: `/health`, `/reason` happy path against
  the fixed example `SanitizedContext`, schema validation of the
  response.
- `companion/tests/test_execute.py`: same shape for `/execute`.
- `extension/test/roundtrip.test.js`: the core round-trip logic
  (currently in `background.js`) refactored into a pure, importable
  function so it can be unit-tested with `node --test` against mocked
  `fetch`, without needing a real browser.
- `schemas/test_schemas.py` (or folded into server/companion tests):
  validate the example payloads in `schemas/examples/` against their
  JSON Schemas.

## Performance Targets
Not meaningful yet — no real work is done in this phase. Deferred to
Phase 10, once there's something to measure against the SIH latency
metric.

## Risks
- A monorepo with three independent runtimes (JS + two Python services)
  has real tooling overhead (dependency management per component,
  version drift). Mitigated by keeping each component's dependency
  manifest minimal and explicit, and by locking versions in this spec.
- Stubbed reasoning/execution logic could be mistaken for real behavior
  later if not clearly marked. Mitigated by explicit `STUB` markers in
  code comments and this spec's Non-goals section.

## Open Questions
None — this phase is deliberately scoped to avoid needing any judgment
call the SIH problem statement doesn't already answer.
