# Prompt 0009

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0008.

## Note on numbering
Requested as `logs/prompts/0008-phase6-threat-model.md` /
`logs/changes/0008-phase6-privacy-contract.md` /
`logs/reports/0008-phase6-threat-model.md`, but `0008` is already used
by the Phase 5 baseline logs. Numbered `0009` throughout instead,
continuing this repo's established sequential convention.

## User Request
Phase 6: define and test the security/privacy/trust-boundary/data-flow
contract, without implementing real detection/redaction/vision/LLM
reasoning/browser-use integration. Define the core fail-closed
invariant (raw sensitive data must never cross the privacy boundary),
trust boundaries for 11 components, a data classification taxonomy, a
canonical privacy contract evolving the existing `SanitizedContext`
schema, a 15-threat threat model (T1–T15) with entry point/asset/
scenario/mitigation/detection/residual-risk/test-requirement per threat
and no fabricated likelihood values, a fail-closed policy, a testable
`assertSafeForEgress()` network egress gate, 12 deterministic tests
(no external model), a logging sanitization contract, and a `TypedAction`
security contract (allowlist, schema validation, adapter boundary
proving browser-use cannot receive raw screenshots). Create
`docs/specs/phase6-threat-model.md`, `docs/specs/privacy-contract.md`,
`docs/architecture/trust-boundaries.md`,
`docs/architecture/privacy-data-flow.md` with Mermaid diagrams. Run
Graphify only against approved source, verifying exclusions first if
test fixtures contain synthetic secrets/PII-like strings. Never use
"secure"/"private"/"safe"/"guaranteed" without evidence — use
IMPLEMENTED/TESTED/VERIFIED/UNVERIFIED/BLOCKED/OUT OF SCOPE. Log
prompt/change/report, commit, push, verify sync. Stop after Phase 6.

## Relevant Context
- `docs/specs/phase5-reproducible-baseline.md`,
  `docs/adr/0004-phase5-monorepo-runtime-choice.md` (Phase 5, the seams
  this phase builds the gate on top of)
- `docs/adr/0003-browser-use-integration-strategy.md` (the Threat T11
  claim this phase is the first to actually enforce in code)
- Commit `de18d96` (prior verified baseline)

## Intended Outcome
A real, tested, fail-closed privacy gate and adapter boundary — not a
paper contract — with every gap that isn't closed in this phase stated
plainly rather than glossed over.

## Result
Wrote all four required documents. Evolved `SanitizedContext` to
v1.1.0 (breaking change, documented) adding required `privacy` metadata
(`redaction_applied`, `redacted_regions`, `redaction_types`,
`visual_context_version`) and per-element `redacted` flags. Implemented
`extension/src/privacy/{patterns,egressGate,logSanitizer}.js`
test-first (RED confirmed before implementation, then GREEN) — 13
privacy tests plus the 3 pre-existing round-trip tests, 16 total, all
passing. Implemented `companion/privacy/{typed_action_guard,
adapter_boundary}.py` test-first (RED then GREEN) — 9 tests. Updated
`server/app.py` and `companion/app.py`'s Pydantic models to v1.1.0/
`extra="forbid"`/action enums, and wired the new guards into
`companion/app.py`'s actual `/execute` endpoint (not left unused).
Wired `assertSafeForEgress()` into `extension/src/roundtrip.js` as the
real enforcement point before any network call, not just an available-
but-unused function. Updated `server/tests/test_reason.py` for the new
schema and added a test proving a screenshot-shaped field is rejected.
Re-ran the full test suite (37 tests: 16 JS + 21 Python) — all passing.
Re-proved the real, live, unmocked end-to-end round trip with the gate
now actually active in the path. Wrote the 15-threat threat model with
9 threats IMPLEMENTED+TESTED, 6 explicitly OUT OF SCOPE with stated
reasons (T3, T6, T7, T8, T13, T14), and 2 stated gaps within otherwise-
mitigated threats (T9: nothing yet forces every future caller to use
the gate; T4: partial redaction not matching known patterns would slip
through). Checked `.graphifyignore` against the new test fixtures
(which contain deliberately fake-shaped secret strings like
`sk-abc...`/`hunter2Password!` for pattern testing) and found the
current filename-based exclusion rules would not catch them if Graphify
were run — **decided not to run Graphify this phase**, deferring that
policy decision rather than indexing hastily.

## Evidence
- RED-then-GREEN TDD cycle for both `egressGate.js`/`logSanitizer.js`
  and `typed_action_guard.py`/`adapter_boundary.py`, confirmed via
  explicit failing-test runs before implementation existed
- `node --test` (16 tests) + `python -m pytest` (21 tests) = 37 total,
  all passing
- Real, live, unmocked end-to-end round trip re-run after all changes,
  captured genuine output
- New/updated: `docs/specs/phase6-threat-model.md`,
  `docs/specs/privacy-contract.md`,
  `docs/architecture/trust-boundaries.md`,
  `docs/architecture/privacy-data-flow.md`,
  `schemas/sanitized-context.schema.json` (v1.1.0),
  `schemas/examples/sanitized-context.example.json`,
  `extension/src/privacy/*.js` (3 new), `extension/test/privacy/*.js`
  (2 new), `extension/src/roundtrip.js` (gate wired in),
  `extension/src/background.js` (importScripts updated),
  `companion/privacy/*.py` (2 new), `companion/tests/test_privacy.py`
  (new), `companion/app.py` (guards wired in), `server/app.py` (v1.1.0
  models), `server/tests/test_reason.py` (updated + new test)

## Open Issues
- Threat T9 (extension bypassing the gate) has no automated test — no
  second code path exists yet to test against. Recorded as an
  architectural recommendation for Phase 7 instead.
- `.graphifyignore` does not yet exclude test fixtures containing
  synthetic secret-shaped strings — Graphify was deliberately not run
  this phase rather than indexing without that decision being made
  deliberately. Left as an explicit open item, not silently resolved.
- The gate's pattern-matching remains a narrow, stated sanity net, not
  general PII/secret detection — every document says so explicitly,
  repeatedly, to avoid this being mistaken for more than it is.
