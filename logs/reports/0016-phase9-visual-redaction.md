# Engineering Report

## Run
0016-phase9-visual-redaction

## Objective
Record ADR 0006 (pin WebBrain v32.2.3), then build the Tier 3 visual
redaction pixel pipeline — the hardest and most visually compelling part
of the demo — test-first, with visual proof.

## Starting Commit
`80ad5827ae0f9196d20c10f9f9ff101a231fa44c`

## Changes
- `docs/adr/0006-pin-webbrain-v32-2-3.md` (new)
- `extension/src/redaction/visualRedactor.js` (new)
- `extension/test/redaction/visualRedactor.test.js` (new, 14 tests)
- `extension/demo/render-redaction-demo.js` (new, demo artifact)
- `docs/specs/phase9-visual-redaction.md` (new)
- `.gitignore` — exclude generated demo PNGs
- This report.

## Verification
- TDD: tests written first, RED confirmed, then implemented, GREEN.
- **A real defect was found by looking at the output, not by the
  tests.** The first implementation used a fixed blur radius of 4. Its
  test passed — it asserted the pixel was "changed, not a flat fill" —
  and the code read as correct. Rendering the demo and actually viewing
  it showed the face was still plainly recognisable: eyes, mouth and
  hair structure survived. On an 82x88 region, radius 4 is cosmetic.
  This is the privacy-theatre failure mode: output that looks redacted,
  passes its tests, and protects nobody. Had I trusted the green suite
  and shipped, the demo's central claim would have been false.
- Two fixes followed: blur radius now scales with region size
  (`max(8, min(w,h)/4)`), and a new test asserts pixel **variance inside
  the region collapses to under 2% of its original** — "detail is gone"
  rather than "pixels changed". A second issue found in the same pass:
  blur sampling now clamps to the region, so it neither pulls
  unredacted surroundings into the average nor bleeds the sensitive
  region's colour outside its box. Both have tests.
- Visual proof regenerated and re-inspected after the fix: face
  unrecognisable, email/phone/password masked, and the header, labels,
  button and footer pixel-identical to the original.
- Design choice worth noting: the module takes ImageData's exact shape
  (`{width,height,data}`), so it is dependency-free and testable in Node
  while mapping 1:1 onto `OffscreenCanvas.getImageData()` in the
  extension — no rewrite to ship, and no canvas needed to test.
- Full regression: **98 tests (77 JS + 21 Python), all passing.**
- No WebBrain code imported, forked, or modified.

## Tests
98 total. 14 new, covering mask correctness, untouched non-sensitive
pixels, original pixels genuinely gone, blur-destroys-detail, no blur
bleed, multi-region, edge clipping, four fail-closed paths, no-op,
audit reporting, and caller-buffer immutability.

## Metrics
Not measured — no latency/resource benchmarking this phase. Noted in the
spec that a dedicated small face detector would likely beat prompting a
VLM on the client-resource metric, but that is untested.

## Failures
One real defect, found and fixed within the phase (above). Recorded
rather than quietly corrected, because the way it evaded a passing test
is the useful part.

## Remaining Work
1. **A detector that produces real bounding boxes.** Tier 1/2 emit
   `boundingBox: null`; faces have no detector at all. Until boxes
   exist, the visual pipeline cannot run on a real page. This is the
   next milestone and must not be described as working before it is
   measured.
2. DOM-element-to-screenshot-pixel mapping (`getBoundingClientRect()` +
   device-pixel-ratio scaling).
3. Data-URL decode/encode inside the extension.
4. The browser-loaded integration at `_withImageDetail()`.
5. Ozer still has no `LICENSE` file.

## Final Status
VERIFIED for what it claims. The pixel pipeline is real, fail-closed,
and visually proven. Deliberately NOT claimed: that Tier 3 works
end-to-end (no detector produces boxes yet), that the extension
integration exists (no WebBrain code touched), or that blur is
irreversible (it is not — solid masking is the only guarantee, and blur
for faces is a documented trade-off to preserve layout context).
