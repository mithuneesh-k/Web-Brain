# Engineering Report

## Run
0011-phase8-tier2-detection

## Objective
Add Tier 2 (structural/semantic) detection via additive confidence
fusion, using the user's own specified weight table exactly; introduce
a normalized `SensitiveRegion` contract so `redactor.js` no longer needs
Tier-1-specific knowledge; close the architectural gap Phase 7's own
report flagged as unresolved (nothing structurally prevents a direct
`fetch()` bypass of the privacy gate).

## Starting Commit
`b266041dde788db0860957bbbc3b8095fb0ffd36` (`main`, matched local and
`origin/main`).

## Changes
See `logs/changes/0011-phase8-tier2-detection.md` for the full file
list. Summary: a spec, four new detection-layer modules
(`regionTypes.js`, `tier1Detector.js`, `tier2Detector.js`,
`combineDetectors.js`), a rewritten `redactor.js`, an extended
`OzerPrivacyClient` covering both network legs, a fully-refactored
`roundtrip.js` with zero direct `fetch()` calls, and a new automated
architecture enforcement test.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `b266041`, confirmed before starting.
- **Tier 1 adapter**: `tier1Detector.js` wraps the existing, completely
  unchanged `domDetector.js` — its 3 new tests passed immediately,
  confirming the adapter introduces no behavior change to Phase 7's
  detection logic (a deliberate design choice to avoid re-risking
  already-verified rules).
- **Tier 2, TDD**: wrote `tier2Detector.test.js` (10 tests: one per row
  of the user's own weight table individually, a multi-signal additive-
  fusion case proving the 1.0 cap, and a below-threshold negative)
  before `tier2Detector.js` existed. Confirmed RED
  (`ModuleNotFoundError`-equivalent for JS). Implemented the rule table
  exactly as specified in `docs/specs/phase8-tier2-detection.md`. Re-ran
  — all 10 passed on the first implementation attempt (no bugs this
  time, unlike Phase 7's detector).
- **Redactor rewrite, TDD**: rewrote `redactor.test.js` for the new
  `(rawElements, regions)` signature before touching `redactor.js`.
  Confirmed RED against the still-old implementation (an assertion
  failure proving the old code path doesn't handle the new call shape
  correctly). Rewrote `redactor.js` to consume `SensitiveRegion[]`
  generically. Re-ran — all 6 tests passed, including one proving Tier 1
  and Tier 2 regions for the same element correctly merge into a single
  redacted output with the union of categories.
- **OzerPrivacyClient extension**: added `postTypedAction()` for the
  companion leg; `postSanitizedContext()` now runs both `tier1Detector`
  and `tier2Detector`, merges via `combineDetectors`, then redacts —
  verified by a new test proving a Tier-2-only signal (a label
  containing "secret" with no Tier 1 match) still triggers redaction
  through the full client pipeline, not just the standalone detector
  test.
- **roundtrip.js fully de-fetched**: refactored so both the server leg
  (`postSanitizedContext`) and the companion leg (`postTypedAction`) go
  through `OzerPrivacyClient` — confirmed by reading the final file:
  zero `fetch(` calls remain in it.
- **Architecture enforcement test, built and self-verified**: wrote
  `egressEnforcement.test.js`, which recursively scans every `.js` file
  under `extension/src/`, strips block comments, line comments, and
  string/template literal contents (so a docstring mentioning `fetch(`
  in prose — which several files in this very change do — doesn't
  false-positive), and asserts no file other than
  `privacy/ozerPrivacyClient.js` contains a `fetch(` call. **Caught a
  real false positive during development**: an earlier, simpler version
  of this check (naive substring match, no comment stripping) failed
  against `roundtrip.js`'s own docstring, which mentions "fetch()" in
  prose describing the refactor — this was corrected by adding comment/
  string stripping rather than by editing the docstring to avoid the
  word, which would have been fixing the symptom, not the check. Two
  additional sanity-check tests prove the scanner mechanism itself
  works: one confirms it *does* catch a deliberately-constructed
  violating snippet, one confirms it correctly *ignores* a comment/
  string-only mention — both included so this test can't be vacuously
  passing due to a scanner bug.
- **Full regression**: `python -m pytest server/tests/ companion/tests/
  schemas/` → 21 passed (unchanged). `node --test` across all extension
  test files → 63 passed. **84 total across both languages, zero
  failures, zero external model dependency.**
- **Real, live, unmocked end-to-end re-verification**: started `server/`
  and `companion/` as real processes, ran the actual refactored
  `roundtrip.js` against them with Node's real `fetch` — captured
  genuine output showing the full Tier 1 + Tier 2 + merge + redact +
  gate + `OzerPrivacyClient` (both legs) pipeline still works end-to-end.

## Tests
84 total (63 JS via `node --test`, 21 Python via `pytest`), all passing.
22 of the JS tests are new this phase. Zero external model dependency.

## Metrics
Not measured (Phase 10, as in every prior phase's spec). Architecturally
notable: Tier 2 fusion is still pure synchronous arithmetic over a fixed
rule table — no measurable latency/resource cost added beyond Tier 1's
already-negligible footprint.

## Evidence
See "Verification" above for exact commands, results, and the one real
false-positive caught and correctly fixed during the architecture test's
own development. Full detail in `docs/specs/phase8-tier2-detection.md`.

## Failures
One false positive in the architecture enforcement test's own first
draft (naive substring match catching a docstring's prose mention of
"fetch()") — caught before being considered done, fixed by adding
comment/string stripping to the scanner rather than editing the
docstring, and covered by a dedicated sanity-check test so a similar
regression in the scanner itself would be caught in the future.

## Remaining Work
1. Tier 3 (visual/ML detection) remains deferred, per the user's
   resequencing to a later phase.
2. The enforcement test is a regex-based scanner, not a formally
   verified guarantee — stated as a limitation, not a claim of
   completeness.
3. Graphify policy for fixture files still open, unchanged.
4. Per user's own recommended sequence: real browser integration and
   interception tests (their "Phase 9"), then Tier 3 visual processing
   (their "Phase 10") — awaiting direction rather than assuming which
   comes next.

## Final Status
VERIFIED. Tier 2 detection matches the user's specified weight table
exactly, verified by one test per rule plus a fusion case. The
`SensitiveRegion` contract genuinely decouples the redactor from
detector-specific knowledge, proven by a test where Tier 1 and Tier 2
regions for the same element merge correctly. The architectural bypass
gap named in Phase 7's own report is closed for the codebase as it
exists today, with an automated, self-verified regression test — not
just documentation asserting it's closed. All 84 tests pass, and the
real live end-to-end round trip still works after the full refactor.
