# Phase 8: Tier 2 Detection, Normalized SensitiveRegion Contract, Egress Enforcement

## Problem
Phase 7's Tier 1 detector is a single regex/attribute pass with no
confidence model and an ad-hoc output shape specific to itself. Nothing
stops a new file from calling `fetch()` directly and bypassing
`OzerPrivacyClient` entirely — Phase 7's report named this as a known
scope boundary, not a solved problem.

## Evidence
- `logs/reports/0010-phase7-local-detection.md`, "Remaining Work" #2
  (OzerPrivacyClient enforcement scoped to one file, not repo-wide).
- User's own signal-weighting example (password type +1.0, autocomplete
  current-password +0.9, label "secret" +0.7, name "token" +0.6) — used
  directly as this phase's Tier 2 rule set, not reinvented.

## Goal
1. A normalized `SensitiveRegion` shape every detector emits.
2. Tier 1 wrapped to emit this shape (no behavior change, same rules).
3. Tier 2: label/field-semantics/context signals combined via additive
   confidence fusion (capped at 1.0, `>=0.5` threshold to emit a region).
4. `redactor.js` consumes `SensitiveRegion[]` instead of Tier-1-specific
   output — Tier 3 (Phase 10, deferred) becomes just another producer.
5. An automated architecture test scanning `extension/src/` for direct
   `fetch()` calls outside the approved transport module — closing the
   bypass gap for real, not by convention.

## Non-goals
- Tier 3 (visual/vision-model detection) — deferred to Phase 10, per
  user's own resequencing this turn.
- Bounding-box population (the shape carries the field, always `null` in
  this phase — no real DOM coordinates exist yet without a live page).
- A full NLP/ML confidence model — Tier 2 fusion is deterministic,
  rule-weighted arithmetic, matching the user's own worked example.

## Constraints
No external model, no network call, in any test. Must not regress the
62 tests from Phase 5/6/7.

## SensitiveRegion shape

```js
{
  id: "el-3-tier2-password",       // unique per (element, detector, subtype)
  elementId: "el-3",
  category: "authentication",       // authentication | pii | financial | visual_identity
  subtype: "password",              // free-form label, informational
  confidence: 0.94,
  source: "tier1-dom-pattern" | "tier2-semantic",
  boundingBox: null                 // reserved for Tier 3
}
```

## Tier 2 signal weights (as specified by the user, extended minimally for the same categories Tier 1 already covers)

| Signal | Weight | Category | Subtype |
|---|---|---|---|
| `type === "password"` | +1.0 | authentication | password |
| `autocomplete` is `current-password`/`new-password` | +0.9 | authentication | password |
| label/ariaLabel/placeholder matches `/password/i` | +0.9 | authentication | password |
| `name`/`id`/`autocomplete` matches OTP pattern | +0.8 | authentication | otp |
| label/ariaLabel/placeholder matches `/secret/i` | +0.7 | authentication | credential |
| label/ariaLabel/placeholder matches `/api.?key\|credential/i` | +0.6 | authentication | api_key |
| `name`/`id` matches `/token/i` | +0.6 | authentication | api_key |
| label/ariaLabel/placeholder matches `/card\|credit\|payment/i` | +0.6 | financial | card |
| `type === "email"`, `autocomplete === "email"`, or label matches `/email/i` | +0.5 | pii | email |
| `type === "tel"`, `autocomplete === "tel"`, or label matches `/phone/i` | +0.5 | pii | phone |

Scores accumulate per category (multiple matching signals in the same
category add up, capped at 1.0). A region is emitted per category once
its score reaches `>=0.5`; `subtype` is taken from the highest-weight
contributing signal.

## Architecture

```
rawElements
    |
    +--> tier1Detector.detectTier1Regions()   --> SensitiveRegion[] (confidence 1.0)
    |
    +--> tier2Detector.detectTier2Regions()   --> SensitiveRegion[] (fused confidence)
    |
    v
combineDetectors.mergeRegions(...)  --> SensitiveRegion[]
    |
    v
redactor.redactElements(rawElements, regions)  --> {elements, privacy}
    |
    v
egressGate.assertSafeForEgress()  (unchanged from Phase 6)
    |
    v
OzerPrivacyClient  (ONLY approved transport — both legs now)
    |
    v
Network
```

## Egress enforcement

`extension/test/architecture/egressEnforcement.test.js` scans every
`.js` file under `extension/src/` except
`extension/src/privacy/ozerPrivacyClient.js` for the literal substring
`fetch(`. `roundtrip.js` is refactored so **both** legs (server and
companion) go through `OzerPrivacyClient` — `postSanitizedContext()` and
a new `postTypedAction()` — so this test can be a blanket rule, not one
scoped only to the server leg.

## Acceptance Criteria
- Tier 1 behavior is unchanged (same 62-test suite still passes,
  benchmark still 100%/100%).
- Tier 2 fusion matches the weight table exactly, proven by tests hitting
  single-signal, multi-signal, and below-threshold cases.
- `redactor.js` works from `SensitiveRegion[]` alone — Tier 1 and Tier 2
  regions merge correctly for an element flagged by both.
- The architecture test fails if a direct `fetch(` call exists anywhere
  under `extension/src/` outside `ozerPrivacyClient.js` — verified by
  temporarily confirming it fails against the pre-refactor `roundtrip.js`
  (RED), then passes after the refactor (GREEN).
- Real, live, unmocked end-to-end round trip still works after the
  refactor.

## Test Plan
- `extension/test/detection/tier1Detector.test.js` — adapter shape test.
- `extension/test/detection/tier2Detector.test.js` — one test per signal
  category, a multi-signal fusion case, and a below-threshold negative.
- `extension/test/detection/combineDetectors.test.js` — merge behavior.
- `extension/test/redaction/redactor.test.js` — rewritten for the new
  `(rawElements, regions)` signature.
- `extension/test/privacy/ozerPrivacyClient.test.js` — extended for the
  new `postTypedAction` method.
- `extension/test/architecture/egressEnforcement.test.js` — new,
  RED-then-GREEN against the actual refactor.

## Performance Targets
Not measured (Phase 10, as in every prior phase's spec).

## Risks
- Additive confidence fusion is a simple, interpretable model, not a
  calibrated probability — stated as such, not oversold as "94% accurate
  detection" without a real evaluation dataset behind it.
- The `>=0.5` threshold is a design choice, not derived from data (no
  real-world labeled dataset exists yet) — documented, not hidden.

## Open Questions
None blocking. Graphify policy for fixtures remains deferred, unchanged
from Phase 6/7.
