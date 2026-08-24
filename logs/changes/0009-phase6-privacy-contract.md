# Change Record

## Change ID
0009-phase6-privacy-contract

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Note on numbering
Requested as `0008-phase6-privacy-contract.md`; renumbered `0009` to
avoid colliding with the existing `0008-phase5-reproducible-baseline.md`.

## Originating spec/issue
`docs/specs/phase6-threat-model.md` and `docs/specs/privacy-contract.md`,
written this change, implementing Phase 6 of the bootstrap sequence
following the VERIFIED Phase 5 baseline (commit `de18d96`).

## Files changed
- `docs/specs/phase6-threat-model.md` (new)
- `docs/specs/privacy-contract.md` (new)
- `docs/architecture/trust-boundaries.md` (new)
- `docs/architecture/privacy-data-flow.md` (new)
- `schemas/sanitized-context.schema.json` (v1.0.0 → v1.1.0, breaking)
- `schemas/examples/sanitized-context.example.json` (updated for v1.1.0)
- `extension/src/privacy/patterns.js`,
  `extension/src/privacy/egressGate.js`,
  `extension/src/privacy/logSanitizer.js` (new)
- `extension/test/privacy/egressGate.test.js`,
  `extension/test/privacy/logSanitizer.test.js` (new)
- `extension/src/roundtrip.js` (gate wired in as the real enforcement
  point; sanitized context updated to v1.1.0 shape)
- `extension/src/background.js` (importScripts updated for privacy
  modules)
- `companion/privacy/__init__.py`,
  `companion/privacy/typed_action_guard.py`,
  `companion/privacy/adapter_boundary.py` (new)
- `companion/tests/test_privacy.py` (new)
- `companion/app.py` (guards wired into the real `/execute` endpoint)
- `server/app.py` (Pydantic models updated to v1.1.0, `extra="forbid"`,
  action enum)
- `server/tests/test_reason.py` (updated for v1.1.0 + new
  screenshot-rejection test)
- `logs/prompts/0009-*.md`, `logs/reports/0009-*.md` (new)

## Reason
Establish the fail-closed privacy contract and prove it's actually
enforced — not just documented — before Phase 7 adds real detection
logic on top of it, and before the components that would generate real
sensitive payloads (vision, DOM extraction) exist to accidentally bypass
an undocumented or unenforced boundary.

## Tests added / run / result
- `extension/test/privacy/egressGate.test.js` (10 tests, Tests 1–10 from
  the spec): TDD RED confirmed, then PASSED
- `extension/test/privacy/logSanitizer.test.js` (3 tests, includes Test
  11): TDD RED confirmed, then PASSED
- `companion/tests/test_privacy.py` (9 tests, includes Test 12): TDD RED
  confirmed, then PASSED
- `server/tests/test_reason.py` (5 tests, updated + 1 new): PASSED
- `companion/tests/test_execute.py` (4 tests, unaffected): PASSED
- `schemas/test_schemas.py` (3 tests, unaffected): PASSED
- Full suite: 37 tests total (16 JS + 21 Python), all passing
- Real, live, unmocked end-to-end round trip re-verified after all
  changes, gate actively in the path

## Known impact
- `SanitizedContext` v1.0.0 payloads are no longer schema-valid — a
  breaking, deliberate, documented change (`privacy-contract.md`).
- Any future network call the extension makes should go through
  `assertSafeForEgress()`, per the pattern now established in
  `roundtrip.js` — not yet structurally enforced for code that doesn't
  yet exist (stated as Threat T9's gap).
- `companion/app.py`'s `/execute` now returns 400 (not just 422) for
  action-type/target-consistency violations the Pydantic schema alone
  wouldn't catch (e.g. `click` with `target_id: null`).

## Unresolved concerns
- Graphify was **not run** this phase — `.graphifyignore`'s current
  filename-based exclusions don't catch the fake-shaped secret strings
  in the new test fixtures, and extending the policy is deferred as a
  deliberate future decision rather than resolved hastily here.
- Threats T3, T6, T7, T8, T13, T14 remain explicitly OUT OF SCOPE — see
  `docs/specs/phase6-threat-model.md` for the stated reason and revisit
  point for each.
- No secrets committed — the fake-shaped strings in test fixtures are
  synthetic test data, never real credentials, reviewed before staging.
