# Prompt 0012

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-opus-5; model switched from claude-sonnet-5 mid-session)

## Session
Same session as 0001-0011.

## User Request
Major architecture pivot, framed explicitly as a composition pivot, not
a reset. Stop new Ozer feature work (do not build Tier 3 against the
current minimal extension). Perform Phase 8A: WebBrain Integration
Feasibility and Boundary Analysis. Clone `https://github.com/webbrain-one/webbrain`
default branch into a temporary inspection directory OUTSIDE
C:\Projects\Ozer. Do not import, copy, fork, modify, or commit any
WebBrain code into Ozer. Pin and record exact commit SHA, version, date,
and license before analysis. Determine from source-level evidence
whether Ozer should be a WebBrain fork, a thin privacy layer on top, an
upstream-compatible patch, or another architecture. Find the single
narrowest seam where all provider-bound context passes through. Keep
existing privacy commits (b266041, e7b24ae) intact. Do not implement
until the analysis is complete and documented.

## Relevant Context
- Commit `e7b24ae` (Phase 8 Tier 2 baseline, unchanged by this phase)
- `docs/adr/0003-browser-use-integration-strategy.md` — the Phase 4
  precedent for exactly this kind of upstream boundary analysis
- User's own flag that WebBrain 33.0.0+ is GPL-3.0-or-later

## Intended Outcome
An evidence-based feasibility analysis and recommendation, with the
licensing question treated as a first-class architectural constraint
rather than a footnote.

## Result
Confirmed all four decisive findings from primary source at pinned
commit `692cdf25e883b528f0e37e88b644705b54c3635e` (v33.2.1):

1. **License**: GPL-3.0-or-later confirmed from the actual `LICENSE`
   file and `package.json`, independently corroborating the user's flag.
   Pre-33.0.0 is MIT (`LICENSES/MIT.txt` retained).
2. **A genuine single seam exists**: `BaseLLMProvider.chat()/chatStream()`
   takes one `messages` array, and `_messagesContainImage()` proves
   screenshots ride inside that same array as `image_url`/`image`
   blocks. Materially better than browser-use's per-provider serializer
   duplication found in Phase 4.
3. **Custom endpoints supported**: `openai.js` resolves
   `this.config.baseUrl` and self-describes as supporting "any
   OpenAI-compatible endpoint" — enabling a zero-modification proxy.
4. **WebBrain's credential defense is prompt-level, not egress-level**:
   `credential-fields.js` appends a note asking the model not to quote
   credentials; its own comment states "The value is in the conversation
   history above if you need to reference it." The value reaches the
   provider. This is decisive validation of the project thesis.

Also found: WebBrain already ships an in-browser WebGPU vision-language
model (`webbrain-one/webbrain-vl-2-450M-onnx`), directly relevant to
Ozer's deferred Tier 3 and to SIH metrics 1 and 4.

Recommended **Option C** (Ozer as a local OpenAI-compatible privacy
proxy) with **Option E** sequencing (proxy now, upstream patch in
parallel), explicitly contingent on a human licensing decision that is
not mine to make.

## Evidence
- Pinned commit, version, and license read from `LICENSE` and
  `package.json` via authenticated `gh api`
- `providers/base.js`, `providers/openai.js`,
  `agent/credential-fields.js`, `providers/webgpu.js` read at that
  commit, quoted verbatim in `docs/research/webbrain.md`
- New files: `docs/research/webbrain.md`,
  `docs/specs/phase8a-webbrain-feasibility.md`

## Open Issues
- **Clone method deviation, recorded honestly**: three `git clone`
  attempts failed/stalled against the 1.23 GB repo; findings come from
  reading real file bytes at the pinned SHA via the GitHub API, not a
  completed local checkout. Different retrieval method than Phase 4's
  browser-use inspection; stated in the research doc rather than
  glossed over.
- Not verified: whether `chat()` has one call site or many; whether the
  WebGPU vision model is independently invocable; whether `image_url`
  blocks are sent to custom endpoints identically to first-party ones
  (Option C's Tier 3 story depends on this); Firefox parity at source
  level; `manager.js` (88 KB) unread.
- Licensing is a genuine legal question, flagged as requiring real
  review rather than answered with a fabricated legal opinion.
- No decision made, no implementation, nothing imported.
