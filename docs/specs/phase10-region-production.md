# Phase 10: Region Production — DOM to redacted pixels, end to end

## Status: IMPLEMENTED and VERIFIED against a real browser-rendered page. The manually-staged gap is closed for Tier 1/Tier 2. Tier 3 (faces) still has no producer.

## What closed

Before this phase the pipeline was a set of individually-correct parts
with a hole in the middle: detectors emitted `boundingBox: null`, and the
pixel redactor only ever ran on hand-authored boxes. Those halves are
now joined:

```
DOM --+-- Tier 1 detector --+
      +-- Tier 2 detector --+--> produceRegions() --> SensitiveRegion[]
                                  getBoundingClientRect()   (real boxes)
                                  domRectToScreenshotBox()        |
                                                                  v
                                                          redactImageData()
```

## regionProducer.js — the design rule is the point

`produceRegions(detections, viewport)` performs **no detection**. It
never inspects text, attributes, labels, or values. Given a detection
someone else made, its only job is to answer *where is that element in
the captured image*.

This is enforced by a test — "the producer performs NO detection of its
own" — which hands it an element whose text reads `password: hunter2`
but whose declared category is `pii`, and asserts the output stays
`pii`. Re-detecting there would create a second, divergent source of
privacy truth, which is what ADR 0006 term 3 exists to prevent.

**Fail-closed vs not-visible**, carried through from the geometry layer:

- Element scrolled out of the capture, or zero-sized: **omitted**. Those
  pixels are genuinely not in the image. (Its text is still handled by
  Tier 1/2 text redaction, a separate path.)
- Unmeasurable element, unknown category, bad geometry: **throws**. A
  detection that silently produced no region would leave sensitive
  pixels in the image with nothing recording the failure.

15 unit tests, covering the ten specified cases plus category
validation, padding pass-through, and the no-re-detection rule.

## The end-to-end test — real page, real geometry

`extension/test/fixtures/sensitive-page.html` is a real HTML page with
email, phone, password, API token, OTP, a harmless display-name field, a
Save button, header, labels, and footer. All values synthetic.

It was rendered in an **actual browser** at 800x600 and its real
`getBoundingClientRect()` values captured into
`captured-page-geometry.json`. Nothing in that file is hand-authored.

The capture landed on **devicePixelRatio 1.25** — a genuinely fractional
DPR with fractional rects (`85.80000305175781`,
`32.400001525878906`) — which is precisely the case most likely to
produce off-by-a-pixel under-coverage. It also included a footer at
`y=581, height=45.6` inside a 600px viewport, i.e. overflowing the
capture. Both were free real-world edge cases the synthetic tests had
only approximated.

`extension/test/integration/realPagePipeline.test.js` runs the whole
chain and asserts:

| Assertion | Result |
|---|---|
| All 5 sensitive fields produce regions with real pixel boxes | pass |
| No region for button, labels, body copy, display name | pass (0 false positives) |
| Boxes scaled by the real 1.25 DPR, not left in CSS px | pass |
| **Sensitive pixels destroyed at their centre** | pass |
| **Non-sensitive pixels untouched** | pass |
| Masked area between 1% and 30% — redaction, not a blackout | pass (~11%) |
| Viewport-overflowing footer handled without inventing pixels | pass |
| No region exceeds image bounds | pass |

Detection on the real page: **5/5 sensitive fields caught, 0 false
positives**, from Tier 1 and Tier 2 independently.

## Visual confirmation

The computed pixel boxes were converted back to CSS pixels and painted
onto the live page as overlays. They land exactly on the five sensitive
inputs. The header, all six labels, the display-name value
("Sunflower"), and the **Save changes button** remain fully visible —
which is the whole point: the agent keeps the affordances it needs to
act, and loses only the values it should never have had.

## A real gap this phase surfaced

**Tier 2's label signal reads `aria-label`, not associated
`<label for=...>` text.** On this fixture it did not matter — the inputs
were caught by `type` and `name` anyway — but an input with an
unhelpful `name`, no `type`, and only a visible `<label>` would be
missed. Closing it needs the content script to resolve label
association (`for`, `aria-labelledby`, ancestor `<label>`) and pass the
resolved text in as a field. Not done.

Conversely, the labels themselves were correctly **not** flagged, so
there is no over-redaction of the words "Password" or "API token". That
was verified, not assumed.

## Still missing

- **A face detector.** Tier 3 has no producer at all. This is now the
  only remaining manually-staged part of the demo, and it is cleanly
  isolated: `Image -> detector -> SensitiveRegion[]` plugs into the same
  contract without touching geometry, fusion, privacy modes, redaction,
  or egress.
- The browser-extension integration at `_withImageDetail()`.
- Data-URL decode/encode inside the extension.
- The capture fixture is a snapshot; if the fixture HTML changes, the
  captured geometry must be regenerated.

## Regenerating the captured geometry

Load `extension/test/fixtures/sensitive-page.html` at 800x600, then run
a snippet that walks `input, button, header, footer, p, label`,
collecting for each: `id`, `role`, `type`, `name`, `autocomplete`,
`ariaLabel`, `text` (input `value` or trimmed `textContent`), and
`getBoundingClientRect()`, plus `devicePixelRatio`, `scrollX/Y`, and
`innerWidth/Height`. Replace `captured-page-geometry.json` with the
result.

Suite after this phase: **141 tests** (120 JS + 21 Python).
