# Phase 8C: WebBrain v32.2.3 Foundation Verification

## Status: verification gate PASSED with two caveats. Items 1–6 complete. **Item 7 (prototype integration) deliberately NOT attempted** — see "Why item 7 is not in this phase". No WebBrain code imported, forked, or modified.

## 1. Pinned revision

| | |
|---|---|
| Repository | `https://github.com/webbrain-one/webbrain` |
| Tag | `v32.2.3` |
| **Commit SHA** | **`52fb7914611717f2e9774dc137036a074b293b1d`** |
| Released | 2026-08-19 (one day before v33.0.0) |
| Object type | `commit` (not an annotated-tag indirection) |

## 2. Licensing at that exact revision — consistent, unlike v33

| Source at `52fb791` | Says |
|---|---|
| Root `LICENSE` | `MIT License` / `Copyright (c) 2026 Emre Sokullu` |
| `package.json` | `"license": "MIT"` |

**Both agree.** This is the material improvement over v33.2.1, where
`LICENSE` + `package.json` said GPL-3.0-or-later while
`vendor/libzim/README.webbrain.md` said "the repository itself stays
MIT" — a contradiction nobody here can resolve. At v32.2.3 the question
does not arise, because the GPL WASM that caused it is simply absent.

## 3. Dependency and license inventory

### npm

```
dependencies:         0
optionalDependencies: 0
devDependencies:      2   playwright ^1.48.0   (Apache-2.0, build/test only)
                          tldts 7.4.10         (MIT, build/test only)
```

**Zero runtime npm dependencies.** Nothing from npm ships in the
extension. The real license surface is the vendored tree.

### Vendored code (`src/{chrome,firefox}/vendor/`)

| Component | License | Evidence |
|---|---|---|
| `fflate` | MIT | vendored `LICENSE` ("MIT License", Arjun Barrett) |
| `fzstd` | MIT | vendored `fzstd.LICENSE` (MIT, Arjun Barrett) |
| `pdfjs` | Apache-2.0 | vendored `LICENSE` (Apache License 2.0) |
| `sqlite` | Apache-2.0 | vendored `LICENSE` (Apache License 2.0) |
| `transformers` | Apache-2.0 (Transformers.js) + MIT (ONNX Runtime, Microsoft) | `LICENSE.transformers.txt`, `LICENSE.onnxruntime.txt` |
| `katex` | **no vendored license file** — see caveat A | tree listing: only js/css/fonts, no LICENSE |
| `libzim` | **ABSENT at v32.2.3** | confirmed: vendor dir is fflate, fzstd, katex, pdfjs, sqlite, transformers |

### Copyleft scan

A recursive scan of the vendor tree for `GNU General Public|GPL-[23]|
LGPL|AGPL|Mozilla Public|copyleft` returns exactly one file outside
libzim: `transformers/ThirdPartyNotices.onnxruntime.txt`. Inspected
directly:

- Line 420: **Mozilla Public License Version 2.0** — a real MPL-2.0
  component among ONNX Runtime's transitive dependencies. MPL-2.0 is
  *weak, file-level* copyleft: it does not impose obligations on the
  surrounding work, only on the MPL-licensed files themselves.
- Line 490: `"means either the GNU General Public License, Version 2.0,
  the GNU..."` — this is **MPL-2.0 boilerplate** (§1.12, defining
  "Secondary License" for its compatibility clause), **not** a statement
  that a GPL component is bundled. Reading this line out of context
  would produce a false GPL alarm.

**Result: no GPL/LGPL/AGPL component in v32.2.3's vendor tree.**
Everything is MIT / Apache-2.0, plus MPL-2.0 file-level within ONNX
Runtime's dependency notices.

### Model assets

`LiquidAI/LFM2.5-VL-450M-ONNX` (vision) and `LiquidAI/LFM2.5-2.6B-ONNX`
(text) are **downloaded at runtime**, not vendored in the repo. Their
licences were **not** audited and are not covered by this inventory —
model weights carry their own terms, which are separate from the code
licence. Flagged, not resolved.

## 4. v32.2.3 vs v33.2.1 for what Ozer needs

| | v32.2.3 (MIT) | v33.2.1 (GPL) |
|---|---|---|
| `providers/` | 17 files | 17 files — **identical set** |
| `agent.js` image seam | present | present |
| WebGPU local inference | yes | yes |
| In-browser VLM | `LiquidAI/LFM2.5-VL-450M-ONNX` | `webbrain-one/webbrain-vl-2-450M-onnx` (own fine-tune) |
| Chrome + Firefox | yes | yes |
| `vendor/libzim` (GPL) | **absent** | present |

Delta since v32.2.3 (from CHANGELOG): trace subsystem polish (session
lineage, statistics, byte accounting), optional local API keys, UI
fixes, ~4 days of bug fixes, and their own fine-tuned VLM. **Nothing
architecturally relevant to Ozer.**

## 5. Local VLM invocation path

```
WebGPUProvider extends WebGPUOffscreenProvider extends BaseLLMProvider
    .chat(messages, options)
        -> _dispatch(message, { timeoutMs })
            -> offscreen document
                -> src/chrome/src/offscreen/vision-inference-host.js
                   src/chrome/src/offscreen/inference-worker.js
```

Inference runs in an **offscreen document**, reached by message
dispatch — structurally a service, which is favourable for reuse.
Gating observed in `providers/webgpu.js`: explicit consent
(`WEBGPU_VISION_CONSENT_VERSION`), a model download with state tracking,
and a 90 s inference timeout (`WEBGPU_VISION_INFERENCE_TIMEOUT_MS`).

**Caveat B — this is the important one.** The VLM is exposed as a
**chat interface** (`chat(messages, options)` → text). It is a
vision-*language* model, not a region detector. Ozer's `SensitiveRegion`
contract requires **bounding boxes**. Extracting reliable boxes from a
450M VL model by prompting is plausible but **unproven**, and its
accuracy would have to be measured against fixtures before Tier 3 could
depend on it. Do not assume this drops in.

Minor note: `webgpuVisionReadyMarkerUrl()` constructs a
`https://webbrain.one/.well-known/...` URL — a readiness marker, not
page context, but it is an outbound call worth knowing about in a
privacy-focused build.

## 6. The integration seams — better than expected

### Seam 1: screenshots — a single 4-line chokepoint

Every `image_url` block in `agent.js` is constructed through one helper.
Seven construction sites (lines 3138, 4447, 7714, 7964, 8934, 9157,
27104), all calling `this._withImageDetail(...)`, which is defined
**exactly once**:

```js
_withImageDetail(imageUrl) {              // agent.js:9996
  const detail = this._imageDetailField();
  return detail ? { ...imageUrl, detail } : imageUrl;
}
```

Firefox shows 8 occurrences (7 call sites + 1 definition) — **parity
confirmed**.

This is the ideal Tier 3 attachment point: one method, four lines, both
browsers, through which every screenshot data URL passes on its way
into the message array.

### Seam 2: whole payload — 4 call sites

`provider.chat()` / `provider.chatStream()` at `agent.js` lines 2282,
2435, 4530, 28632 (Phase 8A finding). Everything provider-bound —
text and images — crosses here. This is where Tier 1/Tier 2 text
redaction and the final `assertSafeForEgress()` belong.

### Seam 3: defense in depth

The OpenAI-compatible local proxy from ADR 0005, below both.

```
_withImageDetail()  ->  Tier 3 visual redaction      (1 method)
provider.chat()     ->  Tier 1/2 + assertSafeForEgress  (4 sites)
local proxy         ->  defense in depth             (0 modifications)
```

## Why item 7 (prototype integration) is not in this phase

Item 7 asked for a minimal working integration. I have not done it, and
would rather say so than produce something half-built at the end of a
long analysis session. Two honest reasons:

1. It is the first step that **requires importing WebBrain code into a
   working tree and modifying it** — which is exactly the act the
   licensing gate exists to authorise, and the decision to pin v32.2.3
   has not been recorded as an ADR yet.
2. It needs a build toolchain, an extension load into a real browser,
   and a provider configured — a materially different kind of work from
   source analysis, and it deserves its own phase with its own tests.

The verification gate this phase was named for has passed. The prototype
is Phase 9.

## Caveats — do not drop these

**A. `katex` ships with no vendored licence file.** KaTeX is MIT
upstream, so this is an *attribution* gap rather than a licence
conflict, but any distribution should add the licence text. Worth
reporting upstream.

**B. The local VLM is a chat model, not a region detector.** See item 5.
Tier 3 reuse is promising but unproven; bounding-box extraction needs
measurement before anything depends on it.

**C. Model weights were not audited.** The ONNX models download at
runtime under their own terms, separate from the code licence.

**D. "Permissive" is now well-evidenced; "MIT-clean" is still not the
right phrase.** v32.2.3's code is MIT with Apache-2.0 and MIT vendored
components and MPL-2.0 file-level within ONNX Runtime's dependencies.
That is permissive and GPL-free — genuinely good — but it is a mix, and
distribution carries Apache-2.0 NOTICE obligations and MPL-2.0
file-level obligations.

**E. Modifying v32.2.3 creates an MIT-derived work** with MIT
attribution obligations. Cleaner than GPL, not obligation-free.

## Recommendation

The gate passes. **Pin `52fb7914611717f2e9774dc137036a074b293b1d`
(v32.2.3, MIT)** as the agent foundation, with the three-seam
integration above.

This should now be recorded as an ADR, since it is a hard-to-reverse
choice with real consequences — but that is a decision to take
deliberately, not to infer from a passing verification.
