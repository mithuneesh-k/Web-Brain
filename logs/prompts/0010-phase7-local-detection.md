# Prompt 0010

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0009.

## User Request
Move to Phase 7, scoped as a "first measurable privacy pipeline," not
general AI vision. Priority order: Tier 1 (DOM/pattern detection —
password fields, OTP, API keys/tokens, email, phone, credit card),
Tier 2 (structural/semantic — deferred), Tier 3 (visual/ML — deferred).
Additionally close Phase 6's Threat T9 gap: create a single approved
egress client (`OzerPrivacyClient`) so future/existing code cannot
bypass the privacy gate by calling `fetch()` directly; refactor the
existing round-trip code path to go through it and add a test that
would catch a regression. Make the first deliverable benchmarkable
(recall/precision), not just unit-tested pass/fail.

## Relevant Context
- `docs/specs/phase6-threat-model.md`, Threat T9 (gate not structurally
  enforced) — this is the concrete gap this phase closes for the one
  real code path that exists.
- `docs/architecture/privacy-data-flow.md`'s "what remains unimplemented"
  — named the wrapped-HTTP-client idea already; this phase builds it.
- Commit `23803d7` (prior verified Phase 6 baseline)

## Intended Outcome
Real, tested Tier 1 detectors with a genuine recall/precision benchmark,
a redactor that produces gate-passing output, and an enforced single
egress path — not three more unused utility functions.

## Result
Wrote `docs/specs/phase7-local-detection.md` first. Built
`extension/src/detection/domDetector.js` test-first (RED confirmed, 16
tests, then GREEN) covering all 6 Tier 1 categories with both positive
and negative cases per category. **Testing caught two real bugs before
they shipped**: the phone-shaped pattern was originally broad enough to
misclassify a 16-digit non-card number, and the API-key field-name regex
missed `api_token` (only matched `api_key`/`access_token`/`secret_key`)
— both fixed and re-verified against the negative test cases and the
benchmark. Built `extension/src/redaction/redactor.js` test-first (5
tests) producing masked, gate-passing `SanitizedContext` output — proven
by a test that runs the actual `assertSafeForEgress()` gate against the
redactor's output, not just asserting shape. Built
`extension/src/privacy/ozerPrivacyClient.js` — the single approved
detection→redaction→gate→transport path — and refactored
`extension/src/roundtrip.js` to call it instead of building a context
and calling `fetch` directly, closing Threat T9's gap for this real code
path. Added a source-scan regression test
(`ozerPrivacyClient.test.js`) that reads `roundtrip.js`'s own source and
fails if it ever calls `fetch` directly against the server URL again.
Built a 17-case synthetic benchmark fixture set (10 positive across all
6 categories, 7 negative including a deliberately Luhn-invalid
16-digit number as an adversarial case) and a benchmark test computing
TP/FP/FN/TN/recall/precision — 100% recall and precision on this
fixture set (expected, since Tier 1 rules are exact-match by design;
documented as not a claim about real-world data).

## Evidence
- RED-then-GREEN TDD cycle for `domDetector.js`, `redactor.js`, and
  `ozerPrivacyClient.js`, confirmed via explicit failing-test runs
  before each implementation existed
- Two real bugs found and fixed via the negative test cases and
  benchmark (phone/credit-card overlap; `api_token` field-name miss)
- Full regression: 62 tests total (41 JS + 21 Python), all passing
- Real, live, unmocked end-to-end round trip re-run with the full
  Tier 1 pipeline wired in — still works
- New/updated: `docs/specs/phase7-local-detection.md`,
  `extension/src/detection/domDetector.js`,
  `extension/src/redaction/redactor.js`,
  `extension/src/privacy/ozerPrivacyClient.js`,
  `extension/src/roundtrip.js` (refactored), `extension/src/background.js`
  (importScripts updated), `extension/test/detection/*.js` (2 new),
  `extension/test/redaction/redactor.test.js` (new),
  `extension/test/privacy/ozerPrivacyClient.test.js` (new),
  `extension/test/fixtures/detection-benchmark.json` (new, synthetic
  data only, reviewed)

## Open Issues
- Tier 2 (structural/semantic signals) and Tier 3 (visual/ML) remain
  fully deferred, per the user's own explicit ordering.
- `OzerPrivacyClient` is enforced for the one real code path
  (`roundtrip.js`); nothing yet stops a brand-new file from importing
  `fetch` directly and bypassing it entirely — the source-scan test only
  catches regression in the existing path, not a hypothetical new one.
  Recorded as a known scope boundary, not claimed as fully closed.
- Graphify still not run — same open item as Phase 6, now compounded by
  the new benchmark fixture file also containing fake-shaped secret
  strings. Deferred, consistent with the prior decision not to resolve
  this hastily.
