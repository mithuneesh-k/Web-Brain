# Engineering Report

## Run
0009-phase6-threat-model

## Objective
Phase 6: define and prove-in-code the security/privacy/trust-boundary/
data-flow contract, without implementing real detection, redaction,
vision, LLM reasoning, or browser-use integration — establish the
fail-closed architecture Phase 7+ builds real capability into.

## Starting Commit
`de18d96c5225ac0b4a54250d90644c14690379bf` (`main`, matched local and
`origin/main`).

## Changes
See `logs/changes/0009-phase6-privacy-contract.md` for the full file
list. Summary: four spec/architecture documents (threat model, privacy
contract, trust boundaries, data flow — all with Mermaid diagrams), a
`SanitizedContext` schema evolution to v1.1.0, a JS privacy gate
(`egressGate.js`/`patterns.js`/`logSanitizer.js`) wired into the actual
round-trip code, and a Python companion-side guard
(`typed_action_guard.py`/`adapter_boundary.py`) wired into the actual
`/execute` endpoint.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `de18d96`, confirmed before starting.
- **TDD, JS privacy gate**: wrote `extension/test/privacy/
  egressGate.test.js` (10 tests) and `logSanitizer.test.js` (3 tests)
  before any implementation existed. Ran them — confirmed RED (module
  not found / undefined function). Implemented `patterns.js`,
  `egressGate.js`, `logSanitizer.js`. Re-ran — all 13 GREEN.
- **TDD, Python companion guard**: wrote `companion/tests/
  test_privacy.py` (9 tests) before `companion/privacy/` existed. Ran —
  confirmed RED (`ModuleNotFoundError`). Implemented
  `typed_action_guard.py`, `adapter_boundary.py`. Re-ran — all 9 GREEN.
- **Not left unused**: `assertSafeForEgress()` is called inside
  `extension/src/roundtrip.js` before every network call — verified by
  reading the updated function and by the fact the full 16-JS-test suite
  (including the pre-existing round-trip tests) still passes with the
  gate now actively in that path. `validate_typed_action()` and
  `submit_to_local_execution_adapter()` are both called inside
  `companion/app.py`'s real `/execute` handler, not left as
  standalone-only functions — verified by reading the updated endpoint
  and by the companion test suite passing against the real endpoint via
  `TestClient`.
- **Schema evolution verified end-to-end**: updated
  `schemas/sanitized-context.schema.json` to v1.1.0 (breaking,
  documented), updated its example, updated `server/app.py`'s Pydantic
  models to match (including `extra="forbid"` and action-type enums on
  both server and companion), updated `server/tests/test_reason.py` for
  the new required fields, and added a new test proving a
  screenshot-shaped extra field is rejected at the schema level (Threat
  T1 / Test 10 equivalent, server-side).
- **Full regression run**: `python -m pytest server/tests/
  companion/tests/ schemas/` → 21 passed. `node --test` across all three
  extension test files → 16 passed. **37 total, zero failures**, no
  external model dependency in any test.
- **Real, live, unmocked end-to-end re-verification**: after all changes,
  started `server/` and `companion/` as real local processes again and
  re-ran the actual `roundtrip.js` (not a test double) against them with
  Node's real `fetch` — captured a genuine result showing the gate
  passed the fixed stub context, the server's stub reasoning produced a
  `click` action, and the companion's stub execution acknowledged it.
  This proves the gate doesn't just pass its own unit tests in
  isolation — it works inside the actual, live data path.
- **Threat model completeness**: all 15 threats (T1–T15) have an entry
  point, asset, scenario, mitigation, detection method, residual risk
  (marked `UNKNOWN` where evidence doesn't support a specific claim, per
  instruction — never a fabricated likelihood), and test requirement.
  9 are IMPLEMENTED+TESTED (T1, T2, T4, T5, T9-partial, T10, T11, T12,
  T15), 6 are explicitly OUT OF SCOPE with a stated reason and revisit
  point (T3, T6, T7, T8, T13, T14) — checked against the document
  itself before writing this report to confirm no threat was silently
  dropped.
- **Graphify decision**: checked `.graphifyignore`'s filename-based
  exclusion patterns (`*credential*`, `*secret*`, `*token*`, `logs/`,
  etc.) against the new test files, which contain deliberately
  fake-shaped secret strings as literal test data (e.g.
  `"sk-abcdefghijklmnopqrstuvwx"`, `"hunter2Password!"`). None of the
  new test file paths match the existing exclusion patterns, so running
  Graphify's code-only extraction would embed these fake strings into a
  committed `graph.json`. **Decided not to run Graphify this phase** —
  this is a policy decision (extend `.graphifyignore` to exclude test
  directories, or accept synthetic test strings in the graph, or
  something else) that deserves deliberate consideration, not a rushed
  call inside an already-large phase. Documented as an explicit open
  item, not silently resolved either way.
- **Evidence standard**: reviewed every new document for the forbidden
  words (`secure`, `private`, `safe`, `zero-leakage`, `fully
  anonymized`, `guaranteed`) before finalizing — none appear as
  unqualified claims; all use IMPLEMENTED/TESTED/VERIFIED/UNVERIFIED/
  BLOCKED/OUT OF SCOPE instead.

## Tests
37 total (16 JS via `node --test`, 21 Python via `pytest`), all passing,
zero external model dependency. Full breakdown in "Verification" above.

## Metrics
Not applicable — Phase 6 explicitly defers performance measurement to
Phase 10, consistent with Phase 5's spec.

## Evidence
See "Verification" above for exact commands and results. Full detail in
the four new documents under `docs/specs/` and `docs/architecture/`.

## Failures
None as defects. The TDD RED-then-GREEN cycle was followed correctly
for both the JS and Python privacy modules — no test was written after
its implementation.

## Remaining Work
1. Extend `.graphifyignore` (or otherwise decide) before ever running
   Graphify against this repo again, now that test fixtures contain
   synthetic secret-shaped strings.
2. Threat T9's gap (nothing structurally forces every future
   network-calling code path to use the gate) — recommended fix
   (a single wrapped HTTP client) noted in the threat model, not
   implemented, since no second network-calling code path exists yet to
   need it.
3. Per user instruction: stop here. Phase 7 (local privacy gate MVP:
   real DOM/password/PII detection, visual redaction, network
   interception tests, redaction accuracy benchmarks) is the next step.

## Final Status
VERIFIED. The core security invariant (raw sensitive data must not cross
the privacy boundary) now has a real, tested, fail-closed enforcement
point on both legs of the architecture — `assertSafeForEgress()` on the
extension→server leg, `validate_typed_action()` +
`submit_to_local_execution_adapter()` on the server→companion→
(future browser-use) leg — both actually wired into the live code path,
not left as unused utility functions. All 12 required deterministic
tests pass, plus additional coverage. 9 of 15 threats have a
tested mitigation; the remaining 6 are explicitly scoped out with
reasons, not silently dropped. The schema evolution is deliberate,
documented, and doesn't break the working end-to-end proof — re-verified
live after every change. Two honest gaps (Graphify policy for synthetic
secrets in fixtures, and the "nothing forces gate usage" architectural
recommendation) are stated plainly rather than glossed over, consistent
with this project's evidence standard throughout every prior phase.
