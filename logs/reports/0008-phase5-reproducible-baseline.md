# Engineering Report

## Run
0008-phase5-reproducible-baseline

## Objective
Phase 5: establish a reproducible, tested, end-to-end Ozer baseline
(extension, server, companion, shared schemas) before any privacy or
reasoning logic exists, per the user's explicit phase roadmap and
`AGENTS.md`'s spec-before-implementation / TDD rules.

## Starting Commit
`691844d9aad5ddfe00f4d6d25379d63cb587587c` (`main`, matched local and
`origin/main`).

## Changes
See `logs/changes/0008-phase5-reproducible-baseline.md` for the full file
list. Summary: a spec (`docs/specs/phase5-reproducible-baseline.md`), an
ADR (`docs/adr/0004-*.md`), three shared JSON Schema contracts with
examples, a minimal FastAPI `server/` and `companion/` (both stub logic,
test-first), a Manifest V3 `extension/` with pure, unit-tested core
logic, a `README.md`, and a `.gitignore` (first one this repo has had).

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `691844d`, confirmed before starting.
- **Spec-first**: wrote `docs/specs/phase5-reproducible-baseline.md`
  before any code, per `AGENTS.md`'s own rule, with explicit non-goals
  to prevent scope creep into Phase 6/7/8/9 territory.
- **TDD, server**: wrote `server/tests/test_reason.py` (4 tests)
  targeting an app that didn't exist yet, then wrote `server/app.py`,
  then ran the suite — all 4 passed on the real implementation, not
  adjusted to make the tests trivially pass.
- **TDD, companion**: same pattern — `companion/tests/test_execute.py`
  (4 tests) written first, `companion/app.py` implemented after,
  verified green.
- **TDD, extension**: `extension/test/roundtrip.test.js` (3 tests,
  mocked `fetch`) written targeting the not-yet-created
  `extension/src/roundtrip.js`, then the pure function implemented,
  verified green (`node --test`).
- **Dependency versions locked to what's actually verified working**:
  ran `pip install` without pins first to discover which versions
  install cleanly with the Python 3.14.3 already in this environment
  (`fastapi==0.119.1`, `uvicorn==0.35.0`, `pydantic==2.12.5`,
  `jsonschema==4.26.0`, `pytest==8.3.4`, `httpx==0.28.1`), then pinned
  exactly those in both `requirements.txt` files — not guessed, not
  copied from an unrelated project.
- **Schema validation**: `schemas/test_schemas.py` (3 tests) confirms
  each example payload validates against its own schema — the contracts
  are internally consistent, not just aspirational JSON files.
- **Real, live, unmocked end-to-end proof** (the strongest evidence in
  this phase): started `python -m uvicorn server.app:app` and
  `python -m uvicorn companion.app:app` as real background processes on
  `127.0.0.1:8001`/`8002`. Confirmed both `/health` endpoints respond
  `200 {"status":"ok"}` via `curl`. Then invoked the actual
  `extension/src/roundtrip.js` function with Node's real, unmocked
  global `fetch` (Node 24 has native fetch) pointed at both live
  servers. Captured the genuine round-trip result: a `TypedAction`
  (`click` on `el-1`, decided by the server's stub logic reading the
  fixed `SanitizedContext`) followed by an `ExecutionResult` (the
  companion's stub acknowledgement referencing that same target id) —
  proving the full data path actually works end-to-end with real HTTP,
  not simulated with mocks. Both background processes were killed
  immediately after, nothing left running.
- **Full test suite, combined**: `python -m pytest server/tests/
  companion/tests/ schemas/` → 11 passed. `node --test
  extension/test/roundtrip.test.js` (also runnable via `npm test` in
  `extension/`) → 3 passed. 14 total automated tests, all passing, plus
  the one live manual end-to-end proof above.

## Tests
14 automated (11 Python via pytest, 3 JS via `node --test`), all
passing. See "Verification" for what each covers.

## Metrics
Not applicable — Phase 5 explicitly defers performance measurement to
Phase 10, per the spec's own Non-goals section; there is no real work
(vision, detection, reasoning) to measure yet.

## Evidence
See "Verification" above for exact commands and results.

## Failures
None. The `node --test extension/test/` directory-argument form failed
with a module-resolution error on this Windows/Git-Bash setup; worked
around by passing the exact test file path instead
(`node --test extension/test/roundtrip.test.js`), which is also what
`extension/package.json`'s `test` script now uses — documented as the
correct invocation in `README.md`, not left as a silent gotcha.

## Remaining Work
1. Load the extension in an actual Chrome window to confirm no console
   errors — not possible in this session (no browser UI available).
2. Implement Firefox manifest parity (`webextension-polyfill`) — deferred,
   documented as an open risk in ADR 0004.
3. Per the user's own roadmap: Phase 6 (threat model + privacy contract)
   is the next step, not further infrastructure work.

## Final Status
VERIFIED. All three components exist, are individually tested (14
automated tests passing), and were proven to work together end-to-end
with a real, live, unmocked HTTP round trip — not a paper architecture
and not a simulated demo. Every dependency version was verified
installable and working in this actual environment before being pinned,
not assumed. The two honestly-flagged gaps (real-browser loading,
Firefox parity) are stated plainly rather than glossed over, consistent
with this project's evidence standard throughout every prior phase.
