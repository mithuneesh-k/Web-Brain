# Phase 8B: Privacy Gate Attachment Feasibility

## Status: analysis complete. Two candidates eliminated on hard technical grounds; a strongly favoured path identified. **No decision recorded as an ADR yet — the licensing ambiguity below needs a human answer first.** No code written, no WebBrain code imported.

## The question

How does Ozer's local privacy gate become **mandatory** for WebBrain's
provider-bound context, without unnecessarily entangling Ozer with
WebBrain's GPL architecture?

## Headline findings

1. **Chrome MV3 cannot modify request bodies.** This eliminates the two
   "intercept WebBrain's traffic" options outright. Verified, not
   assumed.
2. **The GPL is a bolt-on, not the architecture.** WebBrain v33.0.0's
   entire changelog is the licence change plus two onboarding cosmetics.
   The GPL comes from one vendored WASM runtime powering an offline
   Wikipedia feature Ozer does not need.
3. **The last MIT release (v32.2.3) already has everything Ozer needs**,
   including the full provider set and an in-browser WebGPU
   vision-language model.
4. **WebBrain's own docs contradict each other on licensing** in a way
   that materially affects the decision, and that only its maintainer or
   a lawyer can resolve.

---

## Finding 1 — Chrome MV3 body modification: NOT POSSIBLE

From the Chrome `webRequest` API documentation:

> "As of Manifest V3, the `webRequestBlocking` permission is no longer
> available for most extensions. Consider `declarativeNetRequest`…"

and, on what is never intercepted:

> "`chrome-extension://other_extension_id` where `other_extension_id` is
> not the ID of the extension."

Concretely:
- `webRequest.onBeforeRequest` exposes `requestBody` for **inspection
  only** — there is no blocking response property that returns a
  modified body.
- `declarativeNetRequest` can block, redirect, and modify **headers**.
  It cannot rewrite bodies.
- One extension **cannot** intercept another extension's requests.

**Consequence**: any design where a separate Ozer extension (or a
browser-level network hook) *reads WebBrain's provider request and
redacts the payload before it leaves* is not implementable on Chrome
MV3. This kills candidates C and D for the redaction role. Firefox
retains blocking `webRequest`, but its request-body story is the same —
`filterResponseData` addresses **responses**, not request bodies — so
this is not a Chrome-only limitation, and building on a Firefox-only
capability would break the Chrome/Firefox parity the problem statement
expects.

This is exactly the kind of assumption that would have cost days if
carried into implementation.

---

## Finding 2 — The GPL boundary is narrow and feature-isolated

Xapian/libzim appears in exactly **five** source files per browser, plus
the vendored binary:

```
src/{chrome,firefox}/vendor/libzim/         <- the GPL WASM itself
src/{chrome,firefox}/src/agent/zim-xapian.js
src/{chrome,firefox}/src/agent/zim-xapian-runtime.js
src/{chrome,firefox}/src/agent/offline-retrieval.js
src/{chrome,firefox}/src/agent/apocalypse-mode.js
src/{chrome,firefox}/src/ui/offline-rag-readiness.js
```

It touches **none** of `providers/`, `agent.js`, the screenshot path,
the AX tree, or the tool system. `apocalypse-mode.js` fetches from
`opds.library.kiwix.org` — this is the offline-Wikipedia/ZIM archive
feature. **Ozer needs none of it.**

WebBrain's own `docs/offline-rag-licensing.md` scopes the obligation the
same way:

> "Scope: the Xapian/libzim WebAssembly runtime only. Packages that
> include `src/*/vendor/libzim/` are conveyed under GPL-3.0-or-later."

and describes the adapter as deliberately severable:

> "`src/{chrome,firefox}/src/agent/zim-xapian.js` is the
> **license-neutral adapter**."

And v33.0.0's complete changelog:

> - License WebBrain 33.0.0 and later under GPL-3.0-or-later because the
>   distributed extension bundles and integrates the GPL-licensed
>   Xapian/libzim WebAssembly runtime…
> - Remove baked-in copy from onboarding-only screenshots…
> - Increase the size and contrast of the `Alt+Shift+W` onboarding hint.

**The major version bump was purely to signal the licence change.** No
agent, provider, or vision change.

---

## Finding 3 — v32.2.3 (last MIT) has what Ozer needs

Verified at `?ref=v32.2.3`:

| | v32.2.3 (MIT) | v33.2.1 (GPL) |
|---|---|---|
| `vendor/libzim/` (the GPL WASM) | **absent** | present |
| `vendor/` contents | fflate, fzstd, katex, pdfjs, sqlite, **transformers** | + libzim |
| `providers/` | all 17 files, identical set | all 17 files |
| WebGPU local inference | yes | yes |
| In-browser VLM | `LiquidAI/LFM2.5-VL-450M-ONNX` | `webbrain-one/webbrain-vl-2-450M-onnx` (their fine-tune) |
| Chrome + Firefox | yes | yes |

Released 2026-08-19, one day before v33.0.0.

**What pinning to MIT costs** (from the 33.0.x–33.2.1 changelog): trace
subsystem polish (session lineage, statistics, byte accounting),
optional local API keys in settings, UI fixes, ~4 days of bug fixes, and
their own fine-tuned VLM in place of the upstream LiquidAI one. Nothing
architectural. For an SIH prototype this is a small price.

---

## Finding 4 — WebBrain's licensing statements conflict (needs a human)

Three first-party sources disagree:

| Source | Says |
|---|---|
| Root `LICENSE` | "WebBrain 33.0.0 and later is free software… under the terms of the GNU General Public License" |
| `package.json` | `"license": "GPL-3.0-or-later"` |
| `vendor/libzim/README.webbrain.md` | "the store packages carry that license **even though the repository itself stays MIT**" |
| `docs/offline-rag-licensing.md` | "**Packages that include** `src/*/vendor/libzim/` are conveyed under GPL-3.0-or-later" |

The last two scope the GPL to **distributed packages bundling the WASM**;
the first two read as the **project** being GPL. WebBrain's own doc adds:
"This is an engineering distribution record, not legal advice."

If the *repository source* is MIT and only the *bundled artifact* is
GPL, then a build excluding `vendor/libzim/` may be an MIT foundation
even at v33.2.1 — which would remove the trade-off entirely. **I cannot
resolve this and will not guess.** Two cheap ways to settle it: ask the
maintainer directly (a GitHub issue/discussion), or take v32.2.3 where
the question does not arise because the GPL WASM is simply not there.

---

## Decision matrix

Scored against the ten criteria. **Bypassable** = can WebBrain be
configured to skip Ozer.

| | A. Modify GPL WebBrain | B. Local proxy | C. Separate Ozer extension | D. Browser network intercept | **E. MIT v32.2.3 + Ozer** | F. Upstream patch |
|---|---|---|---|---|---|---|
| 1. Sees text context | yes | yes | **no** | **no** | yes | yes |
| 2. Sees image blocks | yes | yes (with precondition) | **no** | **no** | yes | yes |
| 3. Redacts before egress | yes | yes | **NO — MV3 cannot modify bodies** | **NO — same** | yes | yes |
| 4. Bypassable | no | **yes (baseUrl)** | n/a | n/a | no | no |
| 5. Modifies WebBrain | yes | no | no | no | yes | yes (upstream) |
| 6. Chrome | yes | yes | fails at (3) | fails at (3) | yes | yes |
| 7. Firefox | yes | yes | fails at (3) | fails at (3) | yes | yes |
| 8. Latency/resource | in-process, lowest | extra local hop | n/a | n/a | in-process, lowest | in-process |
| 9. Licensing boundary | **GPL entanglement** | cleanest | n/a | n/a | **MIT — clean** | GPL, upstream |
| 10. Satisfies "sanitize before egress" | yes | **only if routed** | no | no | **yes** | yes |

**C and D are eliminated on criterion 3** — a hard platform limit, not a
difficulty. **B alone fails criterion 10**, which is the SIH
requirement itself (already established in ADR 0005). **A and E are
functionally identical; they differ only in licence.**

---

## Recommendation (for a human decision, not recorded as an ADR yet)

**E — pin WebBrain v32.2.3 (MIT) as the agent foundation, integrate
Ozer's privacy gate directly, and keep the local proxy as defense in
depth.**

This follows the user's own decision hierarchy and satisfies it at the
first branch: *can an unmodified MIT WebBrain support Ozer?* On the
evidence, yes — v32.2.3 has the full provider set, both browsers, and
in-browser WebGPU vision, without the GPL WASM.

It resolves the tension that stopped Phase 8A cold. The choice looked
like "unbypassable but GPL-entangled" versus "clean but bypassable."
Option E is unbypassable **and** licence-clean, because the GPL was
never load-bearing for the agent architecture — it arrived with an
offline-Wikipedia feature one day before the version bump.

Retain the proxy from ADR 0005 as the second boundary: it costs little,
and it holds even if WebBrain's provider internals change.

### What must not be overstated

- Ozer's gate placed inside a WebBrain-derived build is unbypassable
  **within that build**. It says nothing about a user running stock
  WebBrain instead.
- "MIT is clean" rests on v32.2.3 genuinely not shipping GPL components.
  Verified for `vendor/libzim/` specifically; the rest of its vendor
  tree was **not** audited (fflate, fzstd, katex, pdfjs, sqlite,
  transformers all have their own licences). A full licence audit is
  required before distribution.
- Modifying v32.2.3 still creates an MIT-derived work with MIT
  attribution obligations. Cleaner than GPL, not obligation-free.

## Open questions

1. **Ask the maintainer** whether the repository source is MIT with only
   the bundled artifact GPL (per their vendor README) or the project is
   GPL (per root `LICENSE`/`package.json`). Cheap, and could make even
   v33.2.1 viable.
2. Full licence audit of v32.2.3's remaining vendor tree.
3. Where exactly the gate attaches inside `agent.js` — four `chat()`
   call sites were located in Phase 8A; whether one wrapper covers all
   four is undesigned.
4. Ozer still has no `LICENSE` file.
