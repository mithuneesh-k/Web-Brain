# Phase 12D (task 1–2): tracing the provider-bound text path

## Status: source trace COMPLETE. No implementation — deliberately, per the "trace first" instruction. Evidence at pinned commit `52fb7914611717f2e9774dc137036a074b293b1d` (v32.2.3).

## The number that decides the design

| | count |
|---|---|
| Places that **build** provider-bound messages (`messages.push(...)`) | **129** |
| Places that **dispatch** to a provider (`provider.chat` / `chatStream`) | **3** |

Sanitising at construction would mean touching 129 sites and getting all
of them right forever. **The gate belongs at dispatch.** This is the text
equivalent of the `pixelateDataUrl` insight from 12B.

## Task 1 — enumerated provider-bound text sources

All reach the provider as message content; none is redacted. Each is
wrapped by `_wrapUntrusted()`, which is a *prompt-injection* boundary,
not a privacy control.

| Source | Evidence (v32.2.3) |
|---|---|
| Conversation history (incl. credential values typed by the user) | Phase 8A, `agent/credential-fields.js` |
| Interactive element labels / `get_interactive_elements` | `agent.js:7599` via `_formatElementsList()` |
| Vision-model transcription of the screenshot | `agent.js:7604-7611`, `desc.text` |
| Accessibility tree | `accessibilityTreeMaxChars` (26330, 26538, 27349, 27403) |
| Tool results | `_wrapUntrusted(<tool>, …)` throughout |
| System-generated notes / capture metadata | e.g. `screenshotNote` at 4210 |
| Selection-scoped page text | `selectionScopeSystemNote(...)`, 12290 |

## Task 2 — where they converge

### The three dispatch sites, and why the two wrappers are NOT the seam

```
_chatWithCostAllowance      (2089)  -> provider.chat       (2092)    many callers
_chatStreamWithCostAllowance(2194)  -> provider.chatStream (2244)    ONE caller (26413)
_processMessageStreamInner  (27164) -> provider.chatStream (27453)   DIRECT — bypasses the wrapper
```

**The main streaming path bypasses its own wrapper.** At 27444 it
inlines the cost-allowance check (`_checkCostAllowance`) and then calls
`provider.chatStream(prunedMessages, streamOpts)` directly at 27453.
`_chatStreamWithCostAllowance` has exactly one caller.

So a gate placed on the two `*WithCostAllowance` wrappers — the obvious
choice — **would miss the primary interactive path**. This is not a
hypothetical: it is the concrete instance of the risk that a new context
source silently bypasses enforcement, and it already exists upstream.

### The actual narrowest seam: wrap the provider, not the call sites

`providers/base.js` declares the interface every provider implements:

```js
async chat(messages, options)
async *chatStream(messages, options)
```

and `providers/manager.js:872-886` is a **single construction point** —
one switch returning `LlamaCppProvider`, `WebGPUProvider`,
`OpenAICompatibleProvider`, `AzureOpenAIProvider`, `AwsBedrockProvider`,
`AnthropicProvider`, `AnthropicOAuthProvider`, `VertexAnthropicProvider`.

**Recommendation: Ozer wraps the provider instance at construction** — a
decorator implementing the same two methods, gating `messages` before
delegating.

Why this and not the call sites:

- The 3 call sites and the 129 build sites both stop mattering.
- **A future call site is covered automatically.** Nothing can be added
  to `agent.js` that reaches a provider without passing the gate,
  because the gate is inside the object being called.
- It survives upstream refactors of `agent.js`, which is 27,849 lines
  and changes often.
- It is the smallest possible patch: one wrap at one factory.
- It matches the 12B split exactly — WebBrain transforms and dispatches,
  Ozer verifies at the boundary.

This is the "sanitize early where useful, verify late where it matters"
rule applied to text: WebBrain's `_wrapUntrusted` stays where it is
(it solves a different problem), and Ozer's gate sits at the last point
before the network.

## A separate leak the trace surfaced: traces and debug logs

Before dispatch, the **full unsanitised message array** is handed to:

```js
this._logDebug({ type: 'llm_request', ..., messages: prunedMessages, ... });   // 12306, 26566, 27443
trace.recordLLMRequest(runId, step, { ... }, { messages: prunedMessages, ... }); // 12313-12322
```

**A provider-level gate is too late for these.** They receive the raw
payload regardless of whether egress is subsequently blocked — so a
blocked request can still leave sensitive text in a stored trace.

This is Ozer's own threats T12/T13 (logs and telemetry) appearing in
upstream, and it means the text-path work needs **two** interventions,
not one:

1. the provider decorator (blocks egress), and
2. something at the trace/debug boundary (prevents persistence).

`sanitizeForLogging()` already exists in Ozer for exactly this shape of
problem, though it is currently written for `SanitizedContext`, not for
a provider message array.

## Explicitly NOT decided here

- Whether the gate **sanitises** (rewrites messages) or **verifies**
  (blocks). 12B's lesson says verification is the stronger role, but the
  text path has no upstream transformer to verify — so unlike the image
  path, Ozer may have to do both. That is a real asymmetry and deserves
  its own decision, not an assumption.
- What "sensitive" means for free-form conversation text, where the
  user may have *deliberately* typed a secret and may legitimately want
  the model to use it. Redacting it may break the task. This is a
  genuine policy question the image path never had to answer.
- Whether Tier 1/Tier 2 detectors are appropriate for prose at all —
  they were designed for DOM fields, not sentences.

## Next concrete step

Write the provider decorator plus its gate, with tests, against the
`BaseLLMProvider` interface — not against `agent.js`. Nothing requires
importing WebBrain to build and test it: the interface is two methods.
