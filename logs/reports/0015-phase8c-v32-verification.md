# Engineering Report

## Run
0015-phase8c-v32-foundation-verification

## Objective
Phase 8C items 1–7: pin v32.2.3, verify licensing at that revision,
inventory dependencies/licences, diff against v33.2.1 for what Ozer
needs, verify the local VLM path, find the message/screenshot seam, and
prototype a minimal integration.

## Starting Commit
`a213543f7e2afdcf66eb60e5899d6367886f3e61`

## Changes
- `docs/specs/phase8c-v32-foundation-verification.md` (new)
- This report.

## Verification
- **Item 1 — pinned**: v32.2.3 =
  `52fb7914611717f2e9774dc137036a074b293b1d`, object type `commit`
  (checked, so it is not an annotated-tag indirection).
- **Item 2 — licensing at that exact revision**: root `LICENSE` is
  standard MIT (Copyright 2026 Emre Sokullu) and `package.json` says
  `"license": "MIT"`. **Both agree**, which is the material difference
  from v33.2.1's three-way contradiction. Verified at `?ref=v32.2.3`,
  not inferred from the tag name.
- **Item 3 — inventory**: zero runtime npm dependencies (only
  `playwright` and `tldts` as devDeps, neither shipped). Vendored tree
  audited component by component from its own licence files: fflate
  MIT, fzstd MIT, pdfjs Apache-2.0, sqlite Apache-2.0, transformers
  Apache-2.0 + ONNX Runtime MIT. `vendor/libzim` confirmed **absent**.
  A copyleft scan surfaced one hit —
  `ThirdPartyNotices.onnxruntime.txt` — which I opened rather than
  reporting the grep result: line 420 is a genuine **MPL-2.0**
  component (weak, file-level copyleft), and line 490's "GNU General
  Public License" is **MPL-2.0 boilerplate** defining "Secondary
  License", not a bundled GPL component. Reporting that grep hit
  without opening it would have produced a false GPL alarm and
  potentially killed a viable option.
- **Item 4 — diff**: identical 17-file provider set; both have WebGPU
  local inference and a 450M VLM; the only delta relevant to Ozer is
  which VLM checkpoint. Post-v32.2.3 changelog is trace polish, local
  API keys, UI fixes, bug fixes.
- **Item 5 — VLM path**: `WebGPUProvider extends WebGPUOffscreenProvider
  extends BaseLLMProvider`, dispatching to an offscreen document
  (`vision-inference-host.js`, `inference-worker.js`). Gated by explicit
  consent, a model download, and a 90 s timeout. **Caveat recorded**:
  it is exposed as `chat(messages) -> text`, i.e. a vision-*language*
  model, not a region detector. Ozer's `SensitiveRegion` needs bounding
  boxes; extracting those by prompting is plausible but unproven and
  must be measured before Tier 3 depends on it. Stated rather than
  assumed to drop in.
- **Item 6 — the seam, better than expected**: all seven `image_url`
  construction sites in `agent.js` funnel through
  `this._withImageDetail(...)`, defined **exactly once** at line 9996
  and only four lines long. Firefox shows 8 occurrences (7 + def) —
  parity confirmed. So the screenshot seam is a single tiny method, not
  seven scattered sites. Combined with the four `provider.chat()` sites
  from Phase 8A, the integration is three well-defined attachment
  points.
- **Item 7 — deliberately not attempted.** It is the first step
  requiring WebBrain code to be imported into a working tree and
  modified, which is precisely what the licensing gate exists to
  authorise, and no ADR pinning v32.2.3 has been recorded yet. It also
  needs a build toolchain and a real browser load — different work from
  source analysis, deserving its own phase and tests. Producing a
  half-finished prototype at the end of a long analysis session would
  have been worse than not starting it.

## Tests
None run — analysis-only phase, no Ozer code changed. Suite last green
at 84 tests (run 0013).

## Metrics
Not applicable.

## Failures
None.

## Remaining Work
1. Record an ADR pinning `52fb791` (v32.2.3) — a hard-to-reverse
   decision that should be taken deliberately, not inferred from a
   passing gate.
2. Phase 9: the minimal prototype integration (item 7).
3. Add KaTeX's licence text before any distribution (attribution gap,
   worth reporting upstream).
4. Audit the runtime-downloaded ONNX model weights' terms — separate
   from the code licence, not covered here.
5. Measure whether the 450M VLM can produce usable bounding boxes
   before Tier 3 design commits to reusing it.

## Final Status
VERIFIED — gate passed, with caveats stated rather than smoothed over.
v32.2.3 is genuinely permissive and GPL-free, has the full provider and
local-vision stack, and exposes a better integration seam than expected
(one 4-line method for screenshots). Two things are deliberately NOT
claimed: that the foundation is "MIT-clean" (it is a permissive *mix*
with Apache-2.0 NOTICE and MPL-2.0 file-level obligations), and that the
local VLM can serve Tier 3 (it is a chat model, and box extraction is
unproven).
