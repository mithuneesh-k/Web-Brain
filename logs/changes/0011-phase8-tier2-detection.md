# Change Record

## Change ID
0011-phase8-tier2-detection

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
`docs/specs/phase8-tier2-detection.md`, written this change, following
the VERIFIED Phase 7 baseline (commit `b266041`).

## Files changed
- `docs/specs/phase8-tier2-detection.md` (new)
- `docs/architecture/privacy-data-flow.md` (updated — Phase 8 section)
- `extension/src/detection/regionTypes.js` (new)
- `extension/src/detection/tier1Detector.js` (new — adapter over
  unchanged `domDetector.js`)
- `extension/src/detection/tier2Detector.js` (new — confidence fusion)
- `extension/src/detection/combineDetectors.js` (new)
- `extension/src/redaction/redactor.js` (rewritten for the normalized
  `SensitiveRegion[]` contract)
- `extension/src/privacy/ozerPrivacyClient.js` (extended with
  `postTypedAction()`, `postSanitizedContext()` now runs both tiers)
- `extension/src/roundtrip.js` (both legs refactored through the
  client; zero direct `fetch()` calls remain)
- `extension/src/background.js` (`importScripts` updated)
- `extension/test/detection/tier1Detector.test.js`,
  `tier2Detector.test.js`, `combineDetectors.test.js` (new)
- `extension/test/redaction/redactor.test.js` (rewritten)
- `extension/test/privacy/ozerPrivacyClient.test.js` (extended, one
  fragile duplicate check removed in favor of the dedicated
  architecture test)
- `extension/test/architecture/egressEnforcement.test.js` (new)
- `logs/prompts/0011-*.md`, `logs/reports/0011-*.md` (new)

## Reason
Add Tier 2 detection using the user's own specified confidence-fusion
model, generalize the detector→redactor contract so Tier 3 can plug in
later without redactor changes, and close the architectural bypass gap
Phase 7's own report named as unresolved (Threat T9).

## Tests added / run / result
- `tier1Detector.test.js` (3): PASSED immediately (adapter, no behavior
  change)
- `tier2Detector.test.js` (10): PASSED on first implementation attempt
- `combineDetectors.test.js` (3): PASSED
- `redactor.test.js` (6, rewritten): TDD RED confirmed against old
  signature, then PASSED
- `ozerPrivacyClient.test.js` (5, extended): PASSED
- `egressEnforcement.test.js` (3, including 2 scanner self-tests):
  PASSED
- Full suite: 84 tests total (63 JS + 21 Python), all passing
- Real, live, unmocked end-to-end round trip re-verified after the full
  refactor

## Known impact
- `extension/src/privacy/ozerPrivacyClient.js` is now the only file
  under `extension/src/` permitted to contain a `fetch(` call — enforced
  by an automated test, not just convention.
- `redactor.js`'s public signature changed from `(detectedElements)` to
  `(rawElements, regions)` — a deliberate breaking change within this
  still-pre-release codebase, all call sites updated in this same
  change.

## Unresolved concerns
- The enforcement test is a regex-based scanner (comment/string-aware,
  proven via its own sanity-check tests), not a formally verified
  guarantee against every possible way a file could reach `fetch` —
  stated in `privacy-data-flow.md`.
- Tier 3 (visual/ML) remains deferred.
- Graphify still not run — same deferred policy decision as Phase 6/7.
- No secrets in any new file — all test data synthetic, reviewed before
  staging.
