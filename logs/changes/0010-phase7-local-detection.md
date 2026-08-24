# Change Record

## Change ID
0010-phase7-local-detection

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
`docs/specs/phase7-local-detection.md`, written this change, following
the VERIFIED Phase 6 baseline (commit `23803d7`).

## Files changed
- `docs/specs/phase7-local-detection.md` (new)
- `extension/src/detection/domDetector.js` (new)
- `extension/src/redaction/redactor.js` (new)
- `extension/src/privacy/ozerPrivacyClient.js` (new)
- `extension/src/roundtrip.js` (refactored to route through
  `OzerPrivacyClient` instead of calling `fetch` directly)
- `extension/src/background.js` (`importScripts` updated for the three
  new modules)
- `extension/test/detection/domDetector.test.js` (new, 16 tests)
- `extension/test/detection/benchmark.test.js` (new, 1 test computing
  recall/precision over 17 fixture cases)
- `extension/test/fixtures/detection-benchmark.json` (new, synthetic
  data, reviewed before commit)
- `extension/test/redaction/redactor.test.js` (new, 5 tests)
- `extension/test/privacy/ozerPrivacyClient.test.js` (new, 3 tests,
  including the T9-regression source-scan test)
- `logs/prompts/0010-*.md`, `logs/reports/0010-*.md` (new)

## Reason
Build the first real, measurable detection/redaction capability (Tier 1
only, per explicit scoping) and close Phase 6's stated Threat T9 gap by
making the privacy gate the *only* path to the server, not just an
available function.

## Tests added / run / result
- `domDetector.test.js` (16): TDD RED confirmed, then PASSED (2 bugs
  found and fixed via negative-case tests before considered done)
- `benchmark.test.js` (1, 17 fixture cases): PASSED — 100%
  recall/precision on the synthetic fixture set
- `redactor.test.js` (5): TDD RED confirmed, then PASSED
- `ozerPrivacyClient.test.js` (3): TDD RED confirmed, then PASSED,
  including a source-scan regression test
- Full suite: 62 tests total (41 JS + 21 Python), all passing
- Real, live, unmocked end-to-end round trip re-verified with the full
  pipeline active

## Known impact
- `roundtrip.js`'s only path to the server is now `OzerPrivacyClient` —
  a direct `fetch()` call to `serverUrl` in that file would now fail the
  source-scan test.
- Any future code that wants to send page-derived data to the server
  should call `OzerPrivacyClient.postSanitizedContext()` rather than
  reimplementing detection/redaction/gating — this is the intended
  single entry point going forward.

## Unresolved concerns
- `OzerPrivacyClient` enforcement is scoped to the one existing code
  path; a hypothetical new file bypassing it entirely is not caught by
  any test yet — stated as a scope boundary in the report.
- Graphify still not run — the new benchmark fixture adds more
  fake-shaped secret strings to the set of files the current
  `.graphifyignore` wouldn't exclude; same deferred decision as Phase 6.
- All fixture "secrets" reviewed before staging — deliberately fake
  formats (`sk-fakeFAKE...`, well-known public test card numbers
  `4111111111111111`/`5500000000000004`), no real credentials.
