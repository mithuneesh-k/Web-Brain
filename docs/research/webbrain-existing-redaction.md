# WebBrain v32.2.3 already has a screenshot redaction pipeline

## Status: VERIFIED from source at the pinned commit. This materially changes Phase 11 and must be resolved before integration code is written.

Discovered while verifying the `_withImageDetail()` seam at the pinned
revision `52fb7914611717f2e9774dc137036a074b293b1d` (v32.2.3, MIT).

## The finding

WebBrain does **not** merely send raw screenshots to the provider. It
ships a local, all-frame screenshot redaction pipeline:

| Component | Location (v32.2.3) |
|---|---|
| Region collector (content script, all frames) | `src/chrome/src/content/redaction-regions.js` (301 lines) |
| Region snapshot orchestrator | `agent.js:1659` `_captureScreenshotRedactionSnapshot()` |
| Pixel redactor | `agent.js` `_redactScreenshotDataUrl()` (called at 1758, 21281) |
| PII regexes + re-classification | `agent/screenshot-redaction.js` (`EMAIL_RE`, `PHONE_RE`) |
| Separate model-facing image | `modelDataUrl`, kept distinct from `dataUrl` |

Its own header comment states the design:

> "Lightweight, all-frame DOM region collector for local screenshot
> redaction. Runs in the extension's isolated world. Form field *values*
> never leave their frame — only rects and kinds are reported."

### What it already solves that Ozer also built

- **Content-script region collection** across **all frames**, via
  `chrome.webNavigation.getAllFrames` and per-frame
  `get_redaction_regions` messages — including child-frame recursion.
  Ozer has no iframe story at all.
- **Coordinate spaces**: `'page'` vs `'viewport'`, adding scroll offset
  only for `'page'`. This is exactly Ozer's `captureMode` distinction,
  independently arrived at.
- **Visibility filtering** that is *more* thorough than Ozer's: it walks
  ancestors checking `display:none`, `visibility:hidden|collapse`, and
  `opacity: 0` (`contributesPixels()`). Ozer only rejects zero-area
  rects, so Ozer would currently emit regions for
  `visibility:hidden` elements.
- **Failure signalling**: `complete`, `overflowed`, `inspectionFailed`
  per frame.
- Redacted kinds: `input`, `textarea`, `select` (form field values
  generically), plus `text` regions matching email/phone heuristics.

## What this means

The user's own rule — **"there must not be two privacy pipelines"** — is
now the central question of Phase 11, and it is not hypothetical. A
naive patch at `_withImageDetail()` would have created exactly the
duplication that rule forbids: two region collectors, two coordinate
conversions, two redactors, disagreeing silently.

**Phase 11 as originally framed rests on a false premise.** It assumed
Ozer would be adding screenshot redaction where none existed.

## What Ozer still uniquely provides — and what it does not

Assessed honestly, from the evidence gathered so far:

**Genuinely still Ozer's, and still unsolved upstream:**

1. **The text/context path.** Phase 8A established from
   `agent/credential-fields.js` that credential *values* reach the
   provider in conversation history, mitigated only by a prompt asking
   the model not to quote them back. WebBrain's redaction is
   **screenshot pixels**; it does not close the text path. This remains
   the strongest, best-evidenced gap and is the project's core claim.
2. **Fail-closed egress enforcement.** `assertSafeForEgress()` plus the
   architecture test banning direct `fetch()` outside one module.
   WebBrain has no equivalent egress assertion.
3. **Strict-by-default masking** and the explicit
   `privacyMode` contract. WebBrain's mode is unexamined here.
4. **The normalized `SensitiveRegion` contract** with categories,
   confidence, and source provenance — WebBrain's regions carry `kind`
   and `type`, not a category taxonomy or confidence.
5. **Tier 2 confidence fusion.** No upstream equivalent found.

**Substantially overlapping — Ozer is duplicating, not adding:**

- Tier 1 DOM detection of form fields (WebBrain redacts *all* form
  field values generically, which is arguably broader).
- DOM→pixel geometry and coordinate-space handling.
- Visual pixel redaction of screenshots.
- Region production from a content script.

That is an uncomfortable but important assessment: **a meaningful
fraction of Phases 7, 9, and 10 duplicates capability that already
exists in the foundation we pinned.** The work is not wasted — it is
tested, contract-driven, and better specified in places — but it should
not be presented as filling a gap that was already filled.

## Options for Phase 11 (a decision is needed, not an assumption)

**A. Ozer replaces WebBrain's detector, reuses its plumbing.** Keep
WebBrain's all-frame collection, coordinate handling, and visibility
filtering; substitute Ozer's categorised `SensitiveRegion` detection
and strict redaction. Least duplication, honours the one-pipeline rule.

**B. Ozer focuses on the text/context path only**, and leaves
screenshots to WebBrain. Smallest diff, targets the best-evidenced gap
(credentials in conversation history), but abandons the visual demo
that Phases 9/10 built.

**C. Ozer as a verification layer over WebBrain's pipeline.** Let
WebBrain redact, then have Ozer independently assert — fail-closed —
that nothing sensitive survived before the provider message is built.
Complements rather than duplicates, and matches the `_withImageDetail()`
chokepoint's synchronous nature (assert, don't transform).

**D. Both A and C** — Ozer supplies detection *and* the independent
egress assertion.

## A second, independent architectural constraint discovered

`_withImageDetail()` is **synchronous** and is called inline inside
object literals at all seven sites. Decode → redact → re-encode is
inherently **async**. So `_withImageDetail()` cannot itself perform
redaction without making seven call sites and their enclosing functions
async.

This is why WebBrain redacts at *capture* time (async) and not at
message-construction time. Any Ozer design that assumed
`_withImageDetail()` was the place to *transform* the image was wrong —
it is the right place to **assert**, not to redact. Option C above is
the design that fits the seam as it actually is.

Also useful: `shot` objects carry `captureId`, `width`, `height`,
`cssWidth`, `cssHeight` — so effective DPR is derivable as
`shot.width / shot.cssWidth` without touching `window.devicePixelRatio`.

## What was NOT verified

- The full contents of `agent/screenshot-redaction.js` (only its
  existence and the `EMAIL_RE`/`PHONE_RE` reference from the content
  script's comment).
- Whether WebBrain's redaction is on by default or behind a setting.
- Whether its redaction is fail-open or fail-closed on
  `inspectionFailed` / `overflowed`.
- Its actual recall/precision. Ozer's detectors may well be better; that
  is untested either way.

Those four are the next things to establish, and they largely determine
which option above is right.
