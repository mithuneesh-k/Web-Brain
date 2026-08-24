# Phase 9: Tier 3 Visual Redaction (pixel pipeline)

## Status: the pixel pipeline is IMPLEMENTED and TESTED with visual proof. The browser-loaded integration is NOT done — see "What is not built".

## Problem
Ozer had detection (Tier 1/2) and text redaction, but nothing that could
actually alter a screenshot. Without that, no visual privacy claim is
possible, and the most compelling part of the demo — a face blurred and
credentials blacked out *before* the image leaves the device — could not
exist.

## What is built

`extension/src/redaction/visualRedactor.js` —
`redactImageData(imageData, regions)`.

- Input is `{width, height, data}` — deliberately **ImageData's shape**,
  which is exactly what `OffscreenCanvas.getImageData()` returns inside
  WebBrain's service worker. So the module is a pure, dependency-free,
  deterministically testable function that needs **no rewrite to ship**.
- `visual_identity` regions are **blurred** (a blurred face still reads
  as "a face is here", preserving layout understanding for the model).
  Everything else is **masked** to solid black, because partial
  legibility of a credential is a leak.
- Returns a **copy**; the caller keeps the untouched original for local
  use.
- Reports `applied[]` for privacy metadata and audit.

### Fail-closed, by design

A region that cannot be applied **throws** rather than being skipped:
missing `boundingBox`, malformed box, non-positive dimensions, or a box
entirely outside the image. A sensitive region we failed to mask must
abort the request, not sail through unmasked. Partially off-screen boxes
are clipped, which is legitimate.

## A real defect this phase found, and how

The first implementation used a **fixed blur radius of 4**. The pixel
test passed — it asserted the blurred pixel was "changed, not a flat
fill" — and the code looked correct.

Then the demo image was rendered and **looked at**. The face was still
plainly recognisable: eyes, mouth, and hair structure all survived. On
an 82×88 region, radius 4 is a visible softening and nothing more.

This is the **privacy-theatre failure mode**: output that looks redacted,
passes its tests, and protects nobody.

Two changes followed:

1. **Radius now scales with the region**
   (`max(8, min(w,h) / 4)`), so detail is destroyed at any size.
2. **A test that would actually have caught it**: `blur DESTROYS detail`
   builds a high-contrast checkerboard and asserts the pixel **variance
   inside the region collapses to under 2% of its original value**.
   "Pixels changed" is not a privacy assertion; "detail is gone" is.

A second issue was fixed at the same time: blur sampling is now **clamped
to the region**. Sampling the whole image would pull unredacted
surrounding pixels into the average *and* bleed the sensitive region's
colour outward past its own box. There is a test for that too.

## Visual proof

`extension/demo/render-redaction-demo.js` renders a mock account page
(avatar, email, phone, password field, plus non-sensitive chrome), runs
it through the redactor, and writes before/after PNGs. It has **no
dependencies** — PNG encoding is done in-file with `node:zlib`.

```
node extension/demo/render-redaction-demo.js
```

Output confirms four regions applied: `blur visual_identity`,
`mask pii` ×2, `mask authentication`. The non-sensitive header, labels,
button, and footer are pixel-identical between the two images.

## How this attaches to WebBrain (designed, not yet built)

Phase 8C established the seam. Every screenshot entering WebBrain's
provider message array passes through **one four-line helper**:

```js
_withImageDetail(imageUrl) {          // agent.js:9996, Chrome AND Firefox
  const detail = this._imageDetailField();
  return detail ? { ...imageUrl, detail } : imageUrl;
}
```

Seven call sites, one definition, parity across both browsers. The Tier
3 integration is therefore: decode the data URL → `getImageData()` →
`redactImageData()` → re-encode → return. If it throws, the request
aborts.

## What is not built

- **The browser-loaded integration.** No WebBrain code has been
  imported or modified; the extension has not been loaded into a real
  Chrome or Firefox. The pixel pipeline is proven; the plumbing is not.
- **A real region detector for faces.** The demo supplies bounding boxes
  by hand. Producing them is a genuinely open problem — see below.
- Data-URL decode/encode (PNG/JPEG) inside the extension. Trivial with
  `createImageBitmap` + `OffscreenCanvas`, but unwritten and untested.

## The open problem this phase does not solve

`redactImageData` needs **bounding boxes**. Nothing in Ozer produces
them for visual content yet:

- Tier 1/Tier 2 emit regions with `boundingBox: null` — they work from
  DOM attributes, not geometry. Mapping a DOM element to screenshot
  pixels requires `getBoundingClientRect()` plus device-pixel-ratio
  scaling, which is real work and is not written.
- **Faces have no detector at all.** ADR 0006 term 6 flags that
  WebBrain's bundled VLM is exposed as `chat(messages) -> text` — a
  vision-*language* model, not a region detector. Prompting it for boxes
  is unproven. A dedicated small face detector (e.g. a BlazeFace-class
  ONNX model via the `onnxruntime-web` WebBrain already vendors) is
  likely the better path, and would also be far cheaper — which matters
  directly for the client-resource metric.

**Until a detector produces real boxes, the visual pipeline cannot run
on a real page.** That is the next milestone, and it should not be
described as working before it is measured.

## Honest limits on the privacy claim

- **Blur is not cryptographically irreversible.** Published work has
  recovered content from blurred and pixelated imagery in some
  conditions. Solid masking is the only guaranteed option. Blur is used
  for faces deliberately, to preserve layout context for the model, and
  that is a **trade-off**, not a guarantee. If a threat model requires
  certainty, faces should be masked, not blurred.
- Redaction quality has been verified against synthetic fixtures of our
  own construction. There is no real-world evaluation set yet.

## Test coverage

14 tests in `extension/test/redaction/visualRedactor.test.js`: mask
correctness, non-sensitive pixels untouched, original pixels genuinely
gone, blur-destroys-detail (variance collapse), no blur bleed outside
the box, multi-region, edge clipping, four fail-closed cases, no-op on
empty regions, audit reporting, and caller-buffer immutability.

Full suite after this phase: **98 tests** (77 JS + 21 Python), all
passing.
