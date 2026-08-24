# Engineering Report

## Run
0014-phase8b-attachment-feasibility

## Objective
Phase 8B: determine how Ozer's privacy gate physically attaches to
WebBrain's context pipeline, and compare the current GPL version against
the last MIT release. Feasibility analysis only — no implementation.

## Starting Commit
`0da1b0b8254c6e7f9c57d800c66599ffd82f9ad8`

## Changes
- `docs/specs/phase8b-attachment-feasibility.md` (new)
- This report.

## Verification
- Pre-work: clean tree, HEAD == origin/main == `0da1b0b`.
- **Chrome MV3 body modification — verified against Chrome's own
  webRequest documentation rather than assumed.** MV3 removed
  `webRequestBlocking` for non-policy extensions; `onBeforeRequest`
  exposes `requestBody` for inspection only; `declarativeNetRequest`
  modifies headers, not bodies; and extensions cannot intercept
  `chrome-extension://other_extension_id`. This eliminates candidates C
  and D on a hard platform limit. Had I asserted this from memory
  instead of checking, it would have been the kind of claim that reads
  as authoritative and turns out load-bearing and wrong.
- **GPL scope traced to source.** `grep` for xapian/libzim across
  `src/` returns exactly five source files per browser plus the vendored
  binary, none of them in `providers/`, `agent.js`, the screenshot path,
  the AX tree, or tools. `apocalypse-mode.js` fetches from
  `opds.library.kiwix.org` — offline Wikipedia. Corroborated by
  WebBrain's own `docs/offline-rag-licensing.md`, which scopes the
  obligation to "packages that include `src/*/vendor/libzim/`" and calls
  `zim-xapian.js` "the license-neutral adapter."
- **v33.0.0's complete changelog read**: the licence change plus two
  onboarding cosmetic fixes. The major bump signalled the relicence, not
  an architecture change.
- **v32.2.3 inspected directly at `?ref=v32.2.3`**: `vendor/` contains
  fflate, fzstd, katex, pdfjs, sqlite, transformers — **no libzim**. The
  `providers/` set is identical (17 files) and `webgpu.js` declares an
  in-browser VLM (`LiquidAI/LFM2.5-VL-450M-ONNX`). So the MIT release
  has the full agent + provider + local-vision stack without the GPL
  WASM.
- **A first-party licensing contradiction was found and is being
  surfaced rather than resolved.** Root `LICENSE` and `package.json`
  read as the project being GPL; `vendor/libzim/README.webbrain.md`
  says "the repository itself stays MIT" and
  `docs/offline-rag-licensing.md` scopes GPL to packages bundling the
  WASM. These cannot all be simultaneously true as written. This is a
  legal/maintainer question, explicitly not mine, and the spec says so.
- Post-33 changelog reviewed to price the MIT trade-off: trace polish,
  optional local API keys, UI fixes, ~4 days of bug fixes, and their own
  fine-tuned VLM. Nothing architectural.
- No code written. No WebBrain code imported, forked, or modified.

## Tests
None run — analysis-only phase, no code changed. Suite last verified
green at 84 tests in run 0013.

## Metrics
Not applicable.

## Failures
None. Two candidate architectures were eliminated, which is a result,
not a failure.

## Remaining Work
1. Human decision on the recommendation (Option E: pin MIT v32.2.3).
2. Ask the WebBrain maintainer to resolve the licence contradiction —
   cheap, and could make v33.2.1 viable, removing the trade-off.
3. Full licence audit of v32.2.3's remaining vendor tree before any
   distribution (fflate, fzstd, katex, pdfjs, sqlite, transformers were
   NOT audited).
4. Design where the gate attaches across the four `chat()` call sites.
5. Ozer still has no `LICENSE` file.

## Final Status
VERIFIED as an analysis run. The central Phase 8A tension —
unbypassable-but-GPL versus clean-but-bypassable — appears dissolvable:
the GPL was never load-bearing for the agent architecture, so an
MIT-pinned foundation is plausibly both unbypassable and licence-clean.
Two candidates were eliminated on a verified platform limit rather than
on speculation. No ADR recorded, because the recommendation depends on a
licensing question that is a human's to answer.
