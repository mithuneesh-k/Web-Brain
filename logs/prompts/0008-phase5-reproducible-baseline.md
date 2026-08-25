# Prompt 0008

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0007.

## User Request
Proceed to Phase 5: reproducible Ozer baseline. Lock repository/runtime
versions, define monorepo architecture, import only minimum required
foundations, create Chrome+Firefox extension baseline, local companion
baseline, server baseline, shared schemas, test harness, prove
end-to-end "hello world." Every architectural decision should trace back
to the SIH judging metrics (visual accuracy, PII recall/precision,
redaction precision, resource utilization, latency). Do not jump straight
to privacy/browser-extension feature work — establish the reproducible
skeleton first.

## Relevant Context
- `docs/adr/0003-browser-use-integration-strategy.md` (companion/server/
  extension boundary already decided)
- `docs/adr/0002-*.md` (Graphify closure, code-index-only)
- Commit `691844d` (prior verified baseline)
- `AGENTS.md`'s own rule: spec before non-trivial implementation, TDD
  loop (RED/GREEN/VERIFY)

## Intended Outcome
A minimal, honestly-scoped, genuinely tested, genuinely working
end-to-end skeleton — not a paper architecture, and not overbuilt beyond
what a "hello world" baseline needs.

## Result
Wrote `docs/specs/phase5-reproducible-baseline.md` first, per `AGENTS.md`'s
own spec-before-implementation rule, defining the exact scope
(extension/server/companion/schemas, explicit non-goals: no real privacy
detection, no real LLM reasoning, no real browser-use integration yet).
Built three JSON Schema contracts (`SanitizedContext`, `TypedAction`,
`ExecutionResult`) with example payloads. Implemented `server/` and
`companion/` as minimal FastAPI stubs, test-first (wrote failing tests,
then implementation, then verified green) — 8 pytest tests passing.
Implemented the extension's core round-trip logic as a pure, dual-
environment-exportable function (`extension/src/roundtrip.js`) so it's
unit-testable via `node --test` without a real browser (3 tests
passing, mocked-fetch), then wired it into a real Manifest V3
`background.js` + `manifest.json`. Verified schema examples validate
against their schemas (3 more pytest tests). **Proved the full round
trip live and unmocked**: started `server/` and `companion/` as real
local processes, drove the extension's actual `roundtrip.js` against
them with Node's real `fetch` (no mocking), and captured the real
response — a genuine, not simulated, end-to-end result. Added
`docs/adr/0004-phase5-monorepo-runtime-choice.md` recording the
runtime/layout decision with evidence (Python versions already
compatible with browser-use's future constraint, all dependencies
verified installable and working in this environment before being
pinned). Added `README.md`, `.gitignore`. Updated `CONTEXT.md`'s current
state.

## Evidence
- `python -m pytest server/tests/ companion/tests/ schemas/` → 11 passed
- `node --test extension/test/roundtrip.test.js` → 3 passed
- Live round trip: started `uvicorn server.app:app` and
  `uvicorn companion.app:app` as real background processes, `curl`
  confirmed both `/health` → 200, then ran `roundtrip.js` with real
  (unmocked) `fetch` against both — captured genuine response showing
  `typedAction` (click on el-1) and `executionResult` (stub
  acknowledgement), both schema-shaped correctly. Processes killed after
  the test, nothing left running.
- New files: `docs/specs/phase5-reproducible-baseline.md`,
  `docs/adr/0004-*.md`, `schemas/*.schema.json` (3),
  `schemas/examples/*.json` (3), `schemas/test_schemas.py`,
  `server/app.py`, `server/requirements.txt`, `server/tests/test_reason.py`,
  `companion/app.py`, `companion/requirements.txt`,
  `companion/tests/test_execute.py`, `extension/src/{roundtrip.js,
  background.js,manifest.json}`, `extension/test/roundtrip.test.js`,
  `extension/package.json`, `README.md`, `.gitignore`

## Open Issues
- Firefox extension parity is architecturally intended
  (`webextension-polyfill`, per `CONTEXT.md`) but not implemented —
  the current manifest uses Chrome's MV3 service-worker syntax. Recorded
  as an open risk in ADR 0004, not silently assumed to work.
- The extension was not actually loaded into a real Chrome instance in
  this session (no browser UI available) — its manifest/background
  script were reviewed for correctness and the core logic was proven via
  both mocked unit tests and a real HTTP round trip, but "loads without
  console errors in an actual Chrome window" is unverified. Noted
  honestly, not claimed as tested.
- No real dependency management lockfile (e.g. `uv.lock`,
  `package-lock.json`) was generated — `requirements.txt`/`package.json`
  pin exact versions already confirmed working in this environment,
  which is sufficient for this phase's reproducibility bar but not a
  full lockfile-based reproducibility guarantee.
