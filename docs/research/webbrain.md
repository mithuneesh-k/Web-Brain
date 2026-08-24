# Research: WebBrain (Phase 8A source-level inspection)

## Status: VERIFIED for the claims below (each cites a specific file at a pinned commit) — nothing imported, copied, forked, or modified into Ozer.

## Upstream identity

- **Repository:** `https://github.com/webbrain-one/webbrain`
- **Default branch:** `main`
- **Exact commit inspected:** `692cdf25e883b528f0e37e88b644705b54c3635e`
- **Commit date:** 2026-08-24 12:27:23 +0300
- **Inspection date:** 2026-08-24
- **Version:** `33.2.1` (`package.json`)
- **Declared license:** `GPL-3.0-or-later` (`package.json` `"license"` field)
- **Repository size:** ~1.23 GB (per GitHub API `size` field)

### Method note (stated precisely, not overclaimed)

A `git clone --depth 1` was attempted three times into a scratchpad
directory outside `C:\Projects\Ozer`. All three failed or stalled: the
first two timed out, the third completed the object download but its
working-tree checkout did not finish within the available window
(`--filter=blob:limit=512k` makes checkout fetch blobs on demand, which
was slow against a 1.23 GB repository). **The findings below therefore
come from reading actual file contents at the pinned commit via the
authenticated GitHub API (`gh api .../contents/<path>`), not from a
completed local working tree.** This is still primary-source evidence —
the real file bytes at a known SHA — but it is a different retrieval
method than the browser-use inspection in Phase 4, and is recorded as
such rather than glossed over. No file over 512k was read.

## Licensing (the gating constraint)

`LICENSE` at the pinned commit states verbatim:

> WebBrain 33.0.0 and later is free software: you may redistribute it
> and/or modify it under the terms of the GNU General Public License as
> published by the Free Software Foundation, either version 3 of the
> License, or (at your option) any later version.
>
> WebBrain releases before 33.0.0 remain available under the MIT License
> that applied when they were published. That historical license text is
> retained at LICENSES/MIT.txt.
>
> The 33.0.0 extension packages include the vendored Xapian/libzim
> WebAssembly runtime and are conveyed as combined works under
> GPL-3.0-or-later.

Copyright holder: Emre Sokullu, 2026. `LICENSES/` contains only
`MIT.txt` (the retained historical text). GitHub's own license detector
reports `NOASSERTION`, consistent with this conditional/dual situation
rather than a single clean SPDX identifier.

**This confirms the user's flag independently and from primary source.**
It is the single most consequential finding of this phase, because it
constrains which integration options are viable — see
`docs/specs/phase8a-webbrain-feasibility.md`.

## Architecture (observed from source, not inferred from names)

Top-level: `.github`, `LICENSES`, `assets`, `ci`, `dist`, `docs`,
`lmstudio-plugin`, `mcp-server`, `scripts`, `src`, `test`, `web`.

`src/` contains exactly two subtrees: `chrome/` and `firefox/` —
confirming the Chrome/Firefox parity claim structurally.

`src/chrome/src/` modules: `agent/`, `cdp/`, `content/`, `network/`,
`offscreen/`, `providers/`, `recorder/`, `trace/`, `ui/`, plus
top-level files including `background.js`.

### Provider layer — the key finding for Ozer

`src/chrome/src/providers/` contains a common base plus per-provider
adapters: `base.js`, `manager.js` (88 KB), `provider-catalog.js`,
`provider-compatibility.js`, `fetch-with-fallback.js`, and adapters
`anthropic.js`, `openai.js`, `azure-openai.js`, `aws-bedrock.js`,
`vertex-anthropic.js`, `llamacpp.js`, `webgpu.js`.

`base.js` defines `class BaseLLMProvider` with a genuinely common
interface — quoting its own docstrings:

```js
/**
 * Base LLM Provider — all providers implement this interface.
 */
async chat(messages, options = {}) { ... }
async *chatStream(messages, options = {}) { ... }
```

**Critically**, `base.js` also contains:

```js
_messagesContainImage(messages) {
  return messages.some((msg) => Array.isArray(msg?.content) && msg.content.some((block) => {
    return block && (block.type === 'image_url' || block.type === 'image');
  }));
}
```

This establishes that **screenshots travel inside the same `messages`
array as text**, as content blocks of type `image_url`/`image` — i.e.
there is one payload structure carrying *all* provider-bound context,
visual and textual. This is materially better than browser-use's
situation (Phase 4), where image serialization was duplicated across
per-provider serializer files with no single carrier.

### Custom endpoints — enables a zero-modification integration

`providers/openai.js` self-describes as:

> Provider for OpenAI-compatible APIs (ChatGPT, OpenRouter, any
> OpenAI-compatible endpoint).

and resolves its target from configuration:

```js
get baseUrl() {
  let baseUrl = String(this.config.baseUrl || 'https://api.openai.com/v1').trim();
  ...
}
```

`this.config.baseUrl` is user-configurable. This means WebBrain can be
pointed at an arbitrary OpenAI-compatible HTTP endpoint **without
modifying WebBrain's source at all** — the basis of Integration Option C
in the feasibility spec.

### Local/on-device inference — directly relevant to the SIH problem statement

`providers/webgpu.js` — "In-browser WebGPU providers hosted by Chrome's
shared offscreen worker" — declares in-browser ONNX models including:

- `WEBGPU_VISION_MODEL_ID = 'webbrain-one/webbrain-vl-2-450M-onnx'` — an
  **in-browser vision-language model**
- `WEBGPU_MODEL_ID = 'LiquidAI/LFM2.5-2.6B-ONNX'` (text, 1.55 GB, q4f16)
- `WEBGPU_BONSAI27_MODEL_ID = 'prism-ml/Bonsai-27B-gguf'`

WebBrain therefore already ships on-device visual inference
infrastructure (WebGPU + ONNX, offscreen worker). This is directly
relevant to Ozer's deferred Tier 3 and to SIH judging metrics 1 (visual
context accuracy) and 4 (client resource utilization) — Ozer may be able
to reuse this rather than building a parallel WebGPU stack. **Not yet
verified**: whether this vision model is invocable independently of
WebBrain's agent loop, which matters for reuse.

### Credential handling — the gap Ozer exists to close

`src/chrome/src/agent/credential-fields.js` is the most important
privacy-relevant file found. Its own header docstring states:

> After set_field fills a field, agent.js asks this module whether the
> field was a credential/secret input. If yes, agent.js appends
> CREDENTIAL_NOTE to the tool result so the model is reminded — at the
> moment of relevance — not to quote the value back in any subsequent
> assistant text, tool args, or `done` summaries.

And in `CREDENTIAL_NOTE_LOOSE`:

> "The value is in the conversation history above if you need to
> reference it."

**This is decisive.** WebBrain's credential protection is a
**prompt-level instruction to the model not to repeat a value**, not an
**egress control preventing the value from being sent**. The credential
value reaches the configured LLM provider as part of conversation
history; the mitigation only asks the model not to echo it back into
summaries and traces. A `CREDENTIAL_NOTE_STRICT` opt-in exists
("Strict secret handling") but is still a prompt instruction, and its
own comment acknowledges the loose variant was disabled because small
local models handled the conditional instruction poorly.

WebBrain's detection regex (`SENSITIVE_NAME_RE`) covers
`password|secret|token|api_key|otp|2fa|mfa|credential|...` — notably
convergent with Ozer's own Tier 1/Tier 2 categories, and its comment
even shares Ozer's reasoning ("We tune for recall over precision"
because of cost asymmetry). This is independent corroboration that
Ozer's detector design is sound, but the two operate at **different
boundaries**: WebBrain's at the prompt, Ozer's at network egress.

### Other observed modules (listed, not deeply analyzed this phase)

`agent/` includes `image-budget.js`, `captcha-gate.js`,
`message-recipient-guard.js`, `loop-detector.js`,
`conversation-persistence.js`, and a large `offline-rag-*` family.
`trace/` includes `prompt-provenance.js`, `recorder.js`, `lineage.js`.
`network/network-tools.js` exists. These are recorded for future
reference; none was read in full this phase.

## What was NOT verified (stated plainly)

- Whether `chat()`/`chatStream()` is called from a single chokepoint in
  the agent loop or from many call sites — not traced. **This does not
  affect Option C** (a proxy sits below all call sites regardless) but
  would matter for Options A/B.
- Whether the WebGPU vision model can be invoked independently of the
  agent loop.
- Firefox parity at source level (only the directory's existence was
  confirmed, not its contents).
- `manager.js` (88 KB) was not read.
- Any file over 512 KB.
- No WebBrain code was executed, built, or run.
