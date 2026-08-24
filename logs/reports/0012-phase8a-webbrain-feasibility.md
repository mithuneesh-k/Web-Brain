# Engineering Report

## Run
0012-phase8a-webbrain-feasibility

## Objective
Phase 8A: determine from source-level evidence whether Ozer should
integrate with WebBrain as a privacy layer, fork it, patch it upstream,
or use another architecture — and find the single narrowest seam where
all provider-bound context passes through. No implementation.

## Starting Commit
`e7b24ae0e9d82b447ba8185a40c5d34fb87f643d` (`main`, matched local and
`origin/main`).

## Changes
`docs/research/webbrain.md`, `docs/specs/phase8a-webbrain-feasibility.md`,
plus prompt/change/report logs. No source code touched.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `e7b24ae`, confirmed before starting.
- **Upstream pinned**: `webbrain-one/webbrain`, default branch `main`,
  commit `692cdf25e883b528f0e37e88b644705b54c3635e`, dated 2026-08-24
  12:27:23 +0300, version `33.2.1`.
- **License confirmed from primary source, not the README summary**:
  read the actual `LICENSE` file and `package.json` at that commit.
  `"license": "GPL-3.0-or-later"`; `LICENSE` states 33.0.0+ is
  GPL-3.0-or-later due to vendored Xapian/libzim WASM, pre-33.0.0
  remains MIT. This independently corroborates the user's own flag.
  GitHub's detector reports `NOASSERTION`, consistent with the
  conditional split.
- **Seam analysis**: read `providers/base.js` and found a genuine common
  interface (`BaseLLMProvider.chat()/chatStream()`), plus
  `_messagesContainImage()` proving screenshots travel inside the same
  `messages` array as text, as `image_url`/`image` content blocks. This
  is the "one structure carries everything" property the user asked me
  to look for, and it is materially better than the browser-use case in
  Phase 4, where image serialization was duplicated per provider.
- **Zero-modification path found**: `providers/openai.js` resolves
  `this.config.baseUrl` and self-describes as supporting "any
  OpenAI-compatible endpoint" — meaning WebBrain can be pointed at Ozer
  without touching WebBrain's source, which is the licensing-cleanest
  integration and also happens to be the narrowest possible seam.
- **The decisive privacy finding**: `agent/credential-fields.js`
  documents that WebBrain's credential protection is a prompt-level
  instruction not to *quote* a credential, with its own comment stating
  "The value is in the conversation history above if you need to
  reference it." The credential reaches the provider. WebBrain's
  detection regex is notably convergent with Ozer's Tier 1/Tier 2
  categories — same vocabulary, same stated recall-over-precision
  reasoning — but applies at a different boundary. This validates both
  the project thesis and Ozer's existing detector design.
- **Bonus finding**: `providers/webgpu.js` declares an in-browser
  vision-language ONNX model (`webbrain-one/webbrain-vl-2-450M-onnx`)
  alongside text models, meaning WebBrain already ships on-device visual
  inference — directly relevant to Ozer's deferred Tier 3 and SIH
  metrics 1 and 4.
- **Nothing imported**: confirmed via `git status` that no WebBrain file
  entered `C:\Projects\Ozer`. The clone lives only in the session
  scratchpad.

## Tests
None run — no code changed. The 84-test suite from Phase 8 is
unaffected.

## Metrics
Not applicable.

## Evidence
See `docs/research/webbrain.md` for file paths and verbatim quotes at
the pinned commit; `docs/specs/phase8a-webbrain-feasibility.md` for the
five-option analysis.

## Failures
Three `git clone` attempts against the 1.23 GB repository
failed or stalled (two tool timeouts; a third downloaded objects but did
not finish its blob-filtered checkout in the available window). Rather
than keep retrying, I switched to reading actual file contents at the
pinned SHA via the authenticated GitHub API. This is still primary-source
evidence — real file bytes at a known commit — but it is a different
retrieval method than Phase 4's browser-use inspection, and is recorded
as a stated deviation in the research doc rather than presented as an
equivalent local-clone analysis.

## Remaining Work
1. **Human decision required on licensing** before any implementation.
   GPL-3.0-or-later is the gating constraint; the fork/patch options
   make Ozer GPL, the proxy option likely does not. This is a genuine
   legal question and I explicitly declined to issue a legal opinion.
2. Ozer has no `LICENSE` file of its own — separate decision.
3. Unverified items listed in the research doc: `chat()` call-site
   count, independent invocability of the WebGPU vision model, whether
   `image_url` blocks reach custom endpoints identically (Option C's
   Tier 3 story depends on this), Firefox parity, `manager.js`.

## Final Status
VERIFIED as an analysis phase. The upstream is pinned, the license is
confirmed from primary source, a genuine single seam was found and
characterized, and the central privacy gap was located and quoted
verbatim from WebBrain's own source. A recommendation (Option C, with
Option E sequencing) is documented with its weaknesses stated plainly —
notably that a configured proxy sanitizes everything routed through it
but cannot prevent a user from routing around it, which is weaker than
an in-extension gate and must not be oversold in a demo. No decision was
made unilaterally, no ADR was written, and no code was imported or
implemented, per instruction.

## Addendum (same session): local clone completed, three open questions closed

The blob-filtered clone that had stalled finished after the initial
write-up was committed (`351018a`), yielding a real working tree at the
same pinned SHA. Because my own Option C recommendation rested on an
unverified assumption, I used the clone to close it rather than leave
the recommendation resting on a guess:

- **Q5 answered**: `chat()`/`chatStream()` has four call sites, all in
  `agent.js`. Not a single chokepoint, but one file — more tractable
  for Options A/B than feared.
- **Q4 answered, and it is load-bearing for the recommendation**:
  `openai.js` does forward `image_url` blocks to custom endpoints, but
  `agent.js:18609` strips all images when `provider.supportsVision` is
  false, and that flag is resolved for custom endpoints by model-name
  regex sniffing. **Ozer's proxy must advertise a vision-matching model
  identity or screenshots never reach it** — Tier 3 would silently have
  nothing to redact while text tiers kept working. This does not change
  the Option C recommendation, but it is a concrete implementation
  precondition that would have caused a confusing silent failure if
  found late.
- The "clone could not be completed" method limitation is superseded
  for these three items; earlier findings were not re-derived, as they
  were already read from real file bytes at the same commit.

Still unverified: Q3 (independent invocability of the WebGPU vision
model), Firefox source-level parity, `manager.js`. No decision made, no
code imported, no implementation performed.
