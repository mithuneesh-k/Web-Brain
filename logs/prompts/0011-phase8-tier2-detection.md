# Prompt 0011

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0010.

## User Request
Continue to Tier 2 before Phase 8/visual work. Add a normalized
`SensitiveRegion` detector-output contract so all future detectors
(Tier 1/2/3) produce the same shape. Implement Tier 2 signals (labels,
field semantics, context) combined via additive confidence fusion, using
the user's own worked weight example (password type +1.0, autocomplete
current-password +0.9, label "secret" +0.7, name "token" +0.6). Update
the redactor to consume the normalized region contract instead of
Tier-1-specific output. Fix the remaining architectural weakness named
in Phase 7's own report: add an automated test scanning extension
source and rejecting direct `fetch()` calls outside the approved
transport module.

## Relevant Context
- `logs/reports/0010-phase7-local-detection.md`, "Remaining Work" #2 —
  the exact gap this phase closes.
- Commit `b266041` (prior verified Phase 7 baseline)

## Intended Outcome
A real confidence-fusion detector matching the user's specified weights
exactly, a genuinely normalized contract multiple detectors share, and
an enforcement test that would actually catch a regression — not three
more standalone modules.

## Result
Wrote `docs/specs/phase8-tier2-detection.md` first. Built
`extension/src/detection/regionTypes.js` (the `SensitiveRegion` shape
+ validation) and `tier1Detector.js` (a thin adapter wrapping the
existing, unchanged Phase 7 `domDetector.js` into the new contract — 3
tests, passed immediately since no behavior changed). Built
`tier2Detector.js` test-first (10 tests covering every row of the
user's weight table individually, a multi-signal-fusion case proving
additive capping at 1.0, and a below-threshold negative) — passed on
first implementation attempt. Built `combineDetectors.js` (simple flat
merge, deliberately not deduplicating across detectors to preserve
provenance). Rewrote `redactor.js` and its tests for the new
`(rawElements, regions)` signature — confirmed RED against the old
signature first, then GREEN. Extended `OzerPrivacyClient` with
`postTypedAction()` (the companion leg) and updated
`postSanitizedContext()` to run Tier 1 + Tier 2 + merge before redacting
— refactored `roundtrip.js` so it makes **zero** direct `fetch()` calls
at all (both legs now route through the client). Built the real
architecture enforcement test
(`extension/test/architecture/egressEnforcement.test.js`): scans every
`.js` file under `extension/src/`, strips comments/strings first (to
avoid false-positiving on this very file's own docstrings mentioning
`fetch(`), and fails if any file other than `ozerPrivacyClient.js`
contains a direct call — plus two sanity-check tests proving the
scanner itself actually works (catches a synthetic violation, ignores a
comment mention).

## Evidence
- RED-then-GREEN TDD cycle for `tier2Detector.js` and the rewritten
  `redactor.js`, confirmed via explicit failing-test runs
- Full regression: 84 tests total (63 JS + 21 Python), all passing
- Real, live, unmocked end-to-end round trip re-run after the full
  refactor (both legs through `OzerPrivacyClient`) — still works
- New/updated: `docs/specs/phase8-tier2-detection.md`,
  `docs/architecture/privacy-data-flow.md` (Phase 8 update section),
  `extension/src/detection/{regionTypes,tier1Detector,tier2Detector,
  combineDetectors}.js`, `extension/src/redaction/redactor.js`
  (rewritten), `extension/src/privacy/ozerPrivacyClient.js` (extended),
  `extension/src/roundtrip.js` (both legs refactored),
  `extension/src/background.js` (`importScripts` updated),
  `extension/test/detection/{tier1Detector,tier2Detector,
  combineDetectors}.test.js` (new), `extension/test/redaction/
  redactor.test.js` (rewritten), `extension/test/privacy/
  ozerPrivacyClient.test.js` (extended),
  `extension/test/architecture/egressEnforcement.test.js` (new)

## Open Issues
- The egress enforcement test is a real, repo-wide regex-based scanner,
  not a formally verified guarantee — stated explicitly in
  `privacy-data-flow.md`'s Phase 8 update rather than oversold.
- Tier 3 (visual/ML) remains fully deferred, now explicitly to "Phase
  10" per the user's own resequencing this turn.
- Graphify still not run — same open item, now with even more
  fake-shaped strings across more test/fixture files.
