# Phase 8A: WebBrain Integration Feasibility Analysis

## Status: analysis complete, DECISION NOT YET MADE — no implementation, no code imported. Awaiting a human decision on the licensing question (see "The licensing constraint").

## Problem
Ozer has built a working privacy pipeline (Tier 1 + Tier 2 detection,
redaction, egress gate, enforced transport client) on top of a minimal,
self-built extension/server/companion baseline. WebBrain already
provides the browser-agent substrate Ozer would otherwise have to keep
building: Chrome + Firefox extensions, an agent loop, accessibility-tree
page reading, a tool system, permission gates, local and cloud model
providers, in-browser WebGPU inference, traces, workflows, and an MCP
bridge. Rebuilding that is waste. But WebBrain's own privacy model is
the thing SIH asks Ozer to fix.

## Evidence
All source-level findings, with file paths and verbatim quotes at pinned
commit `692cdf25e883b528f0e37e88b644705b54c3635e`, are in
[`docs/research/webbrain.md`](../research/webbrain.md). The four
findings that drive this analysis:

1. **License**: v33.2.1 is GPL-3.0-or-later (33.0.0+); pre-33.0.0 is
   MIT. Confirmed from `LICENSE` and `package.json`.
2. **A real common seam exists**: `BaseLLMProvider.chat()/chatStream()`
   takes one `messages` array, and `_messagesContainImage()` proves
   screenshots ride inside that same array as `image_url`/`image`
   blocks. One structure carries all provider-bound context.
3. **Custom endpoints are supported**: `openai.js` resolves
   `this.config.baseUrl`, self-described as working with "any
   OpenAI-compatible endpoint" — so WebBrain can be redirected without
   modifying it.
4. **WebBrain's credential defense is prompt-level, not egress-level**:
   `credential-fields.js` appends a note asking the model not to *quote*
   a credential; its own comment says "The value is in the conversation
   history above if you need to reference it." The value **is sent** to
   the provider.

Finding 4 is the strongest possible validation of the project thesis:
the gap is real, it is architectural, and it is exactly what Ozer's
egress gate was built to close.

## The licensing constraint (read this before the options)

GPL-3.0-or-later is strong copyleft. The practical distinction that
matters here:

- Code that is **modified from, linked into, or distributed as a
  combined work with** WebBrain 33.x is generally a derivative work and
  must itself be GPL-3.0-or-later when distributed.
- Code that is a **separate program communicating over a network
  protocol** is generally *not* a derivative work under the GPL's own
  stated position on separate processes and arm's-length communication.

**I am not able to give a legal opinion, and this analysis should not be
treated as one.** The distinction above is the widely-understood shape
of the rule, but its application to a browser extension bundling
WASM — and to a proxy the user configures rather than one that ships
together — is a genuine legal question. Any option other than "keep
Ozer entirely separate" should get a real license review before code is
written. Ozer is also currently unlicensed (no `LICENSE` file in this
repo), which is its own decision to make.

An additional non-obvious point: **pre-33.0.0 WebBrain is MIT.** If the
GPL is unacceptable for the team's goals, forking from the last MIT
release is a real option — at the cost of losing every feature added
since, and inheriting a maintenance burden with no upstream path.

## Options considered

### Option A — Fork WebBrain 33.x, add Ozer's privacy layer inside it
- **Seam quality**: best possible. Ozer's gate could sit directly in
  `BaseLLMProvider`, catching every provider call including images,
  before any network I/O.
- **Enforceability**: strongest. The privacy gate could be made
  structurally unavoidable inside the extension, the way Ozer's
  `egressEnforcement.test.js` already does for its own codebase.
- **License**: Ozer becomes GPL-3.0-or-later. Distribution of the
  combined extension carries full copyleft obligations.
- **Maintenance**: heaviest. WebBrain is actively developed (the
  inspected commit is from the same day as this analysis). A fork of a
  1.23 GB, fast-moving project means permanent merge burden on a
  hackathon timeline.
- **Verdict**: technically strongest, operationally worst. Not
  recommended as a starting point.

### Option B — Upstream-compatible patch to WebBrain
- Same seam quality and license outcome as A, but contributed upstream
  rather than maintained as a private fork.
- **Blocker**: depends entirely on upstream accepting a change that
  alters their privacy architecture. That is outside Ozer's control and
  cannot be scheduled against a deadline.
- **Verdict**: excellent long-term, unusable as the primary plan.

### Option C — Ozer as a local OpenAI-compatible privacy proxy (RECOMMENDED STARTING HYPOTHESIS)
WebBrain is configured (`config.baseUrl`) to point at Ozer running
locally. Ozer speaks the OpenAI-compatible protocol, receives the full
`messages` array — text *and* `image_url` screenshot blocks — runs
Tier 1/Tier 2/(later Tier 3) detection and redaction, applies
`assertSafeForEgress()`, and only then forwards to the real upstream
provider.

```
WebBrain extension (unmodified, GPL, stays upstream)
        |  OpenAI-compatible HTTP, config.baseUrl -> localhost
        v
Ozer privacy proxy  (separate process, separate program, own license)
        |  detection -> redaction -> assertSafeForEgress -> forward
        v
Real provider (cloud VLM) — or refuse to forward, fail-closed
```

- **Seam quality**: this *is* the "single narrowest seam" requirement.
  Every provider-bound request passes through one HTTP boundary,
  because that boundary is what WebBrain was configured to call. No
  per-provider integration, no dozens of ad-hoc hooks.
- **License**: cleanest available. Separate program, network protocol,
  no WebBrain code copied or modified. (Still worth confirming with
  review, per the caveat above.)
- **Maintenance**: near-zero coupling. WebBrain can update freely; the
  OpenAI-compatible wire format is a far more stable contract than
  WebBrain's internals.
- **Reuses existing Ozer work almost entirely**: `egressGate.js`,
  `domDetector.js`, `tier2Detector.js`, `regionTypes.js`,
  `redactor.js`, `logSanitizer.js` are all transport-agnostic pure
  functions. `OzerPrivacyClient` becomes the proxy's forwarding path.
  Commits `b266041` and `e7b24ae` survive as the core of the product.
- **Honest weaknesses** (these are real, not hedging):
  1. **Configuration-dependent, not enforced.** If a user points
     WebBrain straight at a cloud provider, Ozer is bypassed entirely.
     Option A's in-extension gate cannot be bypassed this way. This is
     the central trade-off of Option C and must be stated in any demo,
     not papered over.
  2. Ozer sees context *after* WebBrain assembled it — the credential
     or screenshot has already entered extension memory. It never
     leaves the **device** unsanitized (the proxy is local), which is
     what the SIH problem statement actually requires, but it is a
     weaker claim than "never captured at all."
  3. Ozer would need to parse/redact base64 images inside `image_url`
     blocks for Tier 3 — viable, but real work.
- **Verdict**: recommended starting point. Best ratio of seam quality
  to license and maintenance risk.

### Option D — Keep building Ozer's own extension (status quo)
- Retains full control and full enforceability, no GPL question at all.
- Rebuilds everything WebBrain already has (two browser extensions, AX
  tree, tools, permissions, WebGPU inference, traces) — the exact waste
  this pivot is meant to avoid.
- **Verdict**: not recommended, *except* that the existing Ozer
  extension remains useful as a reference implementation and test
  harness regardless of which option is chosen.

### Option E — Hybrid: Option C now, Option B in parallel
Ship the proxy (fast, license-clean, demonstrable), and separately
propose the in-extension gate upstream. If upstream accepts, the
enforceability weakness of Option C is fixed later without blocking
anything now.
- **Verdict**: the pragmatic sequencing. Recommended alongside C.

## Recommendation

**Option C as the implementation path, with Option E as the strategy** —
contingent on a human decision about the licensing question, which is
not mine to make.

This preserves every existing Ozer privacy commit, gives the genuinely
narrow single seam that was asked for, avoids a fork of a 1.23 GB
fast-moving GPL project, and produces exactly the pitch the user
described: *WebBrain handles agent intelligence and browser execution;
Ozer ensures the model never receives unsanitized sensitive context.*

The one thing that must not be oversold in a demo: with Option C the
guarantee is **"Ozer sanitizes everything routed through it"**, not
**"Ozer makes it impossible to route around it."** That distinction is
honest, defensible, and still directly addresses the problem statement —
but claiming the stronger version would be false.

## Non-goals of this phase
No implementation, no code import, no fork, no modification, no
dependency added. Nothing from WebBrain has entered `C:\Projects\Ozer`.

## Open questions (require a decision or further work)

1. **Licensing** — human decision + review. Does the team accept
   GPL-3.0-or-later for Ozer (opens A/B), require separation (locks in
   C), or want to evaluate the pre-33.0.0 MIT fork?
2. **Ozer's own license** — this repo currently has no `LICENSE` file.
3. Can `webbrain-vl-2-450M-onnx` be invoked independently of WebBrain's
   agent loop? If yes, Ozer's Tier 3 may be able to reuse WebBrain's
   WebGPU stack instead of building a parallel one.
4. Does WebBrain send `image_url` blocks to *custom* OpenAI-compatible
   endpoints the same way it does to first-party ones? Option C's Tier 3
   story depends on this and it was **not verified** this phase.
5. Is `chat()` called from one chokepoint or many? Only matters if
   A or B is chosen.

## Next step (not taken)
Do not implement until question 1 is answered. If Option C is
confirmed, the first implementable slice is a minimal OpenAI-compatible
`/v1/chat/completions` endpoint in Ozer's existing `server/` that
forwards upstream, with `assertSafeForEgress()` already in the path —
which reuses Phase 5–8 work directly and can be tested with the same
deterministic, no-model approach used throughout.
