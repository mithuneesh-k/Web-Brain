# Phase 7: Local Detection (Tier 1) + Redaction + Enforced Egress Client

## Problem
Phase 6 built a fail-closed gate but nothing yet produces a real
`SanitizedContext` from real page structure, and nothing structurally
stops a future code path from calling the server directly, bypassing
the gate (Threat T9). Phase 7 closes both gaps for the deterministic,
cheap detection tier only — visual/ML detection is explicitly deferred.

## Evidence
- `docs/specs/phase6-threat-model.md`, Threat T9 (gate not structurally
  enforced) and T2 (sensitive DOM text transmitted, narrow pattern
  coverage only).
- User's own prioritization: Tier 1 (DOM/pattern, cheap, high
  confidence) before Tier 2 (structural/semantic) before Tier 3
  (visual/ML) — this phase implements Tier 1 only.
- SIH judging metrics (`CONTEXT.md`): this phase's detectors are
  designed to be measurable against recall/precision (metric 2) and
  resource utilization/latency (metrics 4/5) from day one, via a
  deterministic benchmark that needs no model.

## Goal
1. A DOM-signal detector for Tier 1 categories: password fields, OTP
   fields, API-key/token-shaped values, email addresses, phone numbers,
   credit-card-shaped numbers (Luhn-validated).
2. A redactor that turns detected sensitive elements into a
   schema-valid, gate-passing `SanitizedContext` (masked text, correct
   `privacy` metadata).
3. `OzerPrivacyClient` — the single approved path from raw elements to
   an actual network call. Detection → redaction → `assertSafeForEgress`
   → transport, in one place. `roundtrip.js` is refactored to use it
   instead of calling `fetch` directly, closing Threat T9's gap for the
   one real code path that exists today.
4. A deterministic benchmark (recall/precision) over a small synthetic,
   clearly-labeled fixture set — no model, no external dependency.

## Non-goals
- Tier 2 (structural/semantic signals beyond what Tier 1 categories
  already use) and Tier 3 (visual/vision-model detection, face
  detection) — explicitly deferred, per the user's own ordering.
- Real browser DOM integration (content script extraction from a live
  page) — the detector operates on a plain JS object shape
  (`{id, role, tagName, type, name, autocomplete, ariaLabel, text}`)
  that a future content script will need to populate; that extraction
  code itself is not built here.
- Structurally preventing *all* possible bypasses of `OzerPrivacyClient`
  (e.g. nothing stops a new file from importing `fetch` directly) — this
  phase makes the *existing* code path go through the client and adds a
  test that would catch a regression in that one path, which is what
  Threat T9's stated gap was scoped to; a repo-wide lint rule is a
  reasonable Phase 8+ addition, not built here.

## Constraints
- No external AI model, no network call, in any test.
- Every detector decision must be traceable to a concrete rule (regex,
  attribute check, Luhn algorithm) — no confidence scores invented
  without a stated basis.
- Must not regress any of the 37 Phase 5/6 tests.

## Architecture

```
rawElements (DOM-shaped objects)
        |
        v
domDetector.detectSensitiveElements()   <-- Tier 1 rules only
        |
        v
redactor.redactElements()               <-- masks flagged elements,
        |                                   builds privacy metadata
        v
SanitizedContext (schema v1.1.0)
        |
        v
egressGate.assertSafeForEgress()        <-- unchanged from Phase 6
        |
        v
OzerPrivacyClient.postSanitizedContext()  <-- the ONLY approved path
        |                                    from raw elements to a
        v                                    network call
    fetch (server /reason)
```

## Interfaces

**`detectSensitiveElements(rawElements: RawElement[]): DetectedElement[]`**
(`extension/src/detection/domDetector.js`) — each output element carries
`{..., sensitive: boolean, types: string[]}`, `types` drawn from
`["authentication", "pii", "financial"]` (matching the Phase 6
`redaction_types` enum).

**`redactElements(detected: DetectedElement[]): {elements, privacy}`**
(`extension/src/redaction/redactor.js`) — produces the `elements` and
`privacy` blocks of a `SanitizedContext`; sensitive elements get
`redacted: true` and masked `text`; non-sensitive elements pass through
`redacted: false` unchanged.

**`OzerPrivacyClient.postSanitizedContext(rawElements, {fetch, serverUrl, pageUrlHash}): Promise<object>`**
(`extension/src/privacy/ozerPrivacyClient.js`) — the single approved
entry point: runs detection → redaction → builds the full
`SanitizedContext` → gate → `fetch`, or throws before any network call
if the gate blocks.

## Detection rules (Tier 1, exact and stated)

- **Password**: `type === "password"`, or `name`/`id`/`ariaLabel`
  matching `/pass(word)?/i`.
- **OTP**: `name`/`id`/`autocomplete` matching `/otp|one.?time.?code|
  2fa|mfa.?code/i`, or `autocomplete === "one-time-code"`.
- **API key / token**: `text` matching the Phase 6 `apiKey` pattern
  (reused from `privacy/patterns.js`), or `name`/`id` matching
  `/api.?key|access.?token|secret.?key/i`.
- **Email**: `type === "email"`, or `text` matching the Phase 6 `email`
  pattern.
- **Phone**: `type === "tel"`, or `text` matching a phone-shaped pattern
  (7–15 digits, optional `+`/spaces/dashes/parens).
- **Credit card**: `text` (digits only, spaces/dashes stripped) is
  13–19 digits long and passes the Luhn checksum.

## Acceptance Criteria
- All Tier 1 categories detected on their designed positive fixtures,
  and none of the negative (structural-only) fixtures are flagged
  (proven by the benchmark, not just unit tests).
- `redactElements()` output always passes `assertSafeForEgress()`.
- `OzerPrivacyClient` is the only thing `roundtrip.js` calls to reach
  the server — verified by a test asserting `roundtrip.js`'s source
  does not call `fetch` directly for the server leg.
- Benchmark reports recall/precision per category, committed as a
  report, not just asserted pass/fail in a test.
- Full existing 37-test suite still passes.

## Test Plan
- `extension/test/detection/domDetector.test.js` — one positive and one
  negative case per Tier 1 category (12 cases), plus a mixed-element
  case.
- `extension/test/redaction/redactor.test.js` — masked text never
  contains the original sensitive value; `privacy` metadata accurately
  reflects what was redacted; output passes `assertSafeForEgress`.
- `extension/test/privacy/ozerPrivacyClient.test.js` — full pipeline
  with mocked `fetch`; a case where Tier 1 detection catches something
  and the gate still passes (because it was redacted); a source-scan
  test confirming `roundtrip.js` doesn't call `fetch` directly for the
  server leg.
- `extension/test/detection/benchmark.test.js` — runs the detector over
  a labeled fixture set (`extension/test/fixtures/detection-benchmark.json`,
  synthetic, clearly non-sensitive placeholder values, reviewed before
  commit) and asserts recall/precision meet a stated threshold (100% on
  this deterministic rule-based tier, since the rules are exact-match by
  design — not a claim about real-world data).

## Performance Targets
Not measured yet in wall-clock terms (deferred to Phase 10) — this
phase's "resource utilization" contribution is architectural: Tier 1 is
pure synchronous regex/attribute checks, no model load, no inference
latency, by construction.

## Risks
- Tier 1 rules will miss real-world PII not matching these narrow
  patterns (addresses, names, non-US phone formats, etc.) — explicitly
  acknowledged; Tier 2/3 exist to close this gap incrementally, not this
  phase.
- The Luhn check reduces false positives on random 16-digit numbers but
  a valid-Luhn non-card number would still false-positive — accepted
  trade-off, stated.
- `detection-benchmark.json`'s synthetic values must be reviewed before
  commit to confirm none are real card/API-key formats that could be
  mistaken for genuine leaked credentials by an automated scanner —
  done as part of the pre-commit secret scan for this change.

## Open Questions
- Whether/how to extend `.graphifyignore` for `extension/test/fixtures/`
  given it will contain sensitive-shaped synthetic strings — same open
  item as Phase 6, still deferred, still not run this phase either.
