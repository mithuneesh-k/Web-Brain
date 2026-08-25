# Change Record

## Change ID
0008-phase5-reproducible-baseline

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
`docs/specs/phase5-reproducible-baseline.md`, written this change,
implementing Phase 5 of the bootstrap sequence following the VERIFIED
Graphify closure baseline (commit `691844d`).

## Files changed
- `docs/specs/phase5-reproducible-baseline.md` (new)
- `docs/adr/0004-phase5-monorepo-runtime-choice.md` (new)
- `CONTEXT.md` (updated — current state)
- `README.md` (new)
- `.gitignore` (new)
- `schemas/sanitized-context.schema.json`,
  `schemas/typed-action.schema.json`,
  `schemas/execution-result.schema.json` (new)
- `schemas/examples/*.json` (3 new)
- `schemas/test_schemas.py` (new)
- `server/app.py`, `server/requirements.txt`,
  `server/tests/test_reason.py`, `server/__init__.py`,
  `server/tests/__init__.py` (new)
- `companion/app.py`, `companion/requirements.txt`,
  `companion/tests/test_execute.py`, `companion/__init__.py`,
  `companion/tests/__init__.py` (new)
- `extension/src/roundtrip.js`, `extension/src/background.js`,
  `extension/src/manifest.json`, `extension/test/roundtrip.test.js`,
  `extension/package.json` (new)
- `logs/prompts/0008-*.md`, `logs/reports/0008-*.md` (new)

## Reason
Establish the first real, working code in Ozer — a minimal but genuinely
tested and genuinely proven end-to-end skeleton across the three runtime
boundaries the architecture already committed to (ADR 0003), before any
privacy or reasoning logic is built on top of it.

## Tests added / run / result
- `server/tests/test_reason.py` (4 tests): PASSED
- `companion/tests/test_execute.py` (4 tests): PASSED
- `schemas/test_schemas.py` (3 tests): PASSED
- `extension/test/roundtrip.test.js` (3 tests, `node --test`): PASSED
- Live, unmocked end-to-end round trip (real processes, real HTTP, real
  `fetch`): PASSED, output captured in the prompt log

## Known impact
- First real, running code in this repository. Establishes the contract
  shapes (`SanitizedContext`, `TypedAction`, `ExecutionResult`) that
  Phase 6+ work builds directly on top of — any change to these schemas
  is now a breaking-change decision, not a free edit.
- `README.md` gives any future developer/agent the exact commands to
  reproduce and test this baseline.

## Unresolved concerns
- Firefox manifest compatibility not implemented, documented as an open
  risk in ADR 0004.
- Extension not loaded in a real browser UI this session — logic proven
  via unit tests and a real HTTP round trip, but "loads cleanly in
  actual Chrome" remains unverified, stated honestly rather than
  assumed.
- No secrets in any new file — all stub logic, no credentials, no real
  data; reviewed via `git status`/`git diff --cached` before staging.
