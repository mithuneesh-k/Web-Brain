# ADR 0004: Monorepo layout and runtime choice for the Phase 5 baseline

## Status
Accepted

## Date
2026-08-24

## Decision
Single Ozer repository, three independently runnable components:
`extension/` (JS, Manifest V3), `server/` (Python/FastAPI), `companion/`
(Python/FastAPI), plus `schemas/` (JSON Schema) as the shared contract
source of truth between them. No shared code package yet.

## Context
Phase 5 needed a minimal, reproducible, end-to-end skeleton before any
real privacy or reasoning logic exists (`docs/specs/phase5-reproducible-
baseline.md`). ADR 0003 already fixed one runtime constraint: browser-use
(Python, `>=3.11,<4.0`) will eventually sit behind the companion process,
never inside the extension. That makes Python the natural choice for
`companion/`, and choosing Python for `server/` too avoids introducing a
second backend language for no architectural reason at this stage.

## Evidence
- `docs/adr/0003-browser-use-integration-strategy.md`: browser-use
  requires Python `>=3.11,<4.0`, cannot run inside a browser extension.
- This environment: Python `3.14.3` (satisfies `>=3.11,<4.0`), Node
  `v24.18.0` — both already available, no new runtime install required.
- FastAPI/pydantic/jsonschema/pytest/httpx all installed and working with
  Python 3.14.3 in this environment (verified by running the actual test
  suites, not assumed).

## Alternatives considered
1. **Single shared language (e.g. TypeScript everywhere, extension +
   server + companion).** Rejected — the companion must eventually host
   browser-use (Python-only), so a TypeScript companion would need to
   shell out to a separate Python process anyway, adding complexity for
   no benefit.
2. **A shared code package between server/companion (both Python).**
   Not rejected outright, just not done yet — at this size (two small
   FastAPI stubs), a shared package is premature abstraction. Revisit if
   real duplication appears once Phase 8 adds real reasoning logic.
3. **TypeScript/JSON Schema codegen for compile-time contract checking.**
   Not chosen for Phase 5 — JSON Schema files validated at runtime
   (via `jsonschema` in Python, hand-written examples for JS) are
   sufficient for a stub phase; revisit if contract drift becomes a real
   problem once more fields are added.

## Consequences
- Two independent Python dependency manifests (`server/requirements.txt`,
  `companion/requirements.txt`) — currently identical by coincidence
  (both are minimal FastAPI stubs), expected to diverge once companion
  gains a browser-use dependency in Phase 9.
- `schemas/*.schema.json` are the single source of truth for the two
  cross-boundary contracts (`SanitizedContext`, `TypedAction`) plus
  `ExecutionResult`; any field change must update the schema, its
  example, and both consuming implementations (server/companion in
  Python via pydantic models kept in sync by hand, extension in JS by
  hand) — no codegen exists yet to enforce this automatically.
- Firefox extension parity is architecturally intended
  (`webextension-polyfill`, per `CONTEXT.md`'s target-browser
  requirement) but not implemented in Phase 5 — the Manifest V3
  `background.service_worker` syntax used is Chrome's; a Firefox-
  compatible manifest variant is deferred, not silently assumed to work.

## Upstream synchronization policy
Not applicable — no upstream dependency introduced at this phase beyond
what ADR 0003 already covers for browser-use (still not installed).

## License/attribution considerations
None — all new code in this phase is original, no vendored/copied source.

## Open risks
- Pydantic models in `server/app.py` and `companion/app.py` currently
  hand-mirror the JSON Schema files rather than being generated from
  them — a future field added to one could drift from the other if not
  updated together. Acceptable at this size; worth a codegen step if the
  schemas grow significantly.
- Firefox compatibility is unverified — the extension has only been
  proven to load conceptually via Manifest V3 syntax review, not tested
  in an actual Firefox instance (no browser UI available in this
  session — see the Phase 5 report for exactly what was and wasn't
  tested).
