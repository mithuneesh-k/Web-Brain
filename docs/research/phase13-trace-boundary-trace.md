# Phase 13: tracing the observability boundary

## Status: source trace COMPLETE, no implementation. Evidence at pinned commit `52fb7914611717f2e9774dc137036a074b293b1d`.

> **READ THE CORRECTION AT THE END OF THIS FILE FIRST.** The sink table
> and priority ordering below are **wrong**: `recordLLMRequest` is
> content-free by design (verified in Phase 13B), and the real
> trace-side surface is `recordLLMResponse`, which this pass missed.
> The `_pruneOldImages` analysis and the restated one-policy rule still
> stand.

## The headline, which contradicts the working assumption

The architectural rule going in was:

> There must be **one sanitization result**, reused by both provider
> dispatch and observability.

**That is not achievable by interception, because no single point exists
upstream of both.** The promising candidate does not hold up.

## Why `_pruneOldImages` is not the shared seam

It looked like the answer. On the main paths, one array feeds
everything:

```js
const prunedMessages = this._pruneOldImages(contextMessages, provider);
this._logDebug({ ..., messages: prunedMessages, ... });      // 12306
trace.recordLLMRequest(runId, step, {...}, { messages: prunedMessages }); // 12313
await this._chatWithCostAllowance(provider, prunedMessages, ...);        // 12326
```

But `_chatWithCostAllowance` has many callers, and they pass **different,
un-pruned arrays**:

| Call site | messages argument |
|---|---|
| 8523 | `messages` (vision sub-call) |
| 11338 | `messages` |
| 11407 | `repairMessages` |
| 11516 | `plannerMessages` |
| 11722 | `plannerMessages` |

`_pruneOldImages` is called on only 6 paths; provider dispatch happens on
many more. **It is not universal**, so gating it would leave most
provider traffic ungated while creating a false sense of coverage — the
same mistake as gating `_chatStreamWithCostAllowance` would have been in
12D.

## The actual shape: three sinks, each a single function

The pattern that solved the provider path applies again. Rather than
chasing a common *source*, gate each *sink* — and each sink is one
function with many callers:

| Sink | Definition | Callers | Status |
|---|---|---|---|
| Provider | `BaseLLMProvider.chat` / `chatStream` | 3 dispatch sites | **GATED** (patch 0002) |
| Debug log | `agent.js:25799` `_logDebug(entry)` | 24 calls, ~4 carrying `messages` | not gated |
| Trace recorder | `trace/recorder.js:187` `recordLLMRequest(runId, step, payload, provenanceInput)` | 5 sites (10870, 11319, 11391, 12312, 26568) | not gated |

Both remaining sinks are **single functions**, which is the same
favourable shape the provider had.

## The rule, restated so it is actually satisfiable

Not *one sanitization invocation* — that would require a chokepoint
that does not exist. Instead:

> **One sanitization POLICY, applied at every sink.**

```
raw messages
   |-- _logDebug              -> gate -> \
   |-- trace.recordLLMRequest -> gate ->  |-- same policy module
   \-- provider.chat/Stream   -> gate -> /
```

This preserves the property that actually matters — the two-pipeline
drift that 12B eliminated on the image side cannot recur, because there
is one policy implementation — while accepting that it is evaluated more
than once.

Cost of the compromise, stated plainly: the policy runs up to three
times per request. That is wasted work, and if the policy is ever
non-deterministic the surfaces could disagree. Both are manageable
(memoise on array identity; require the policy to be pure), but they are
real and should be design constraints on whatever policy is written,
not discovered later.

## Severity differs between the two remaining sinks

They should not be treated as equally urgent:

- **`_logDebug`** pushes onto `this._debugLog`, an **in-memory** array
  capped by `this._debugLogMax`. It is process memory, exposed via
  `getDebugLog()`, cleared by `clearDebugLog()`. Sensitive text lives
  there only until eviction or reload — unless something exports it.
- **`trace.recordLLMRequest`** is in `trace/recorder.js` and takes a
  `provenanceInput` argument alongside the payload. Phase 11B saw the
  trace subsystem's byte-accounting, lossless caps, and repair logic —
  strongly implying **persistence**. Persisted sensitive text is the
  materially worse outcome and is the higher priority of the two.

**Not verified:** whether `recordLLMRequest` writes to disk/IndexedDB and
under what retention. That should be established before the gate is
designed, because it determines whether the correct behaviour is
*sanitise* or *refuse to record at all*.

## What this means for the current claim

Ozer's provider boundary is enforced. Observability is not. So the
accurate statement remains:

> A blocked request can still leave sensitive text in a debug log or a
> stored trace.

Ozer must not claim "the secret never leaves the device" while this
holds. The claim is bounded to the provider egress path.

## Next steps, in order

1. Establish whether `recordLLMRequest` persists, and its retention.
2. Gate `recordLLMRequest` (higher severity, likely persistent).
3. Gate `_logDebug` (in-memory, lower severity).
4. Both consume the **same policy module** as `providerGate` — enforced
   by test, the way `patchIntegrity` enforces the no-fork-the-transform
   rule.

## Note on ordering

Writing the text policy is now on the critical path for all three sinks
at once. It is the last genuinely hard design question left: the
plumbing is solved on every surface, and what remains is deciding what
"sensitive" means for prose, and how user-authored intent differs from
ambient page context.

---

# CORRECTION (Phase 13B): I got `recordLLMRequest` wrong

The section above listed `trace.recordLLMRequest` as an ungated egress
surface and the **higher-priority** of the two remaining sinks. That was
based on its call signature — `provenanceInput.messages` is passed in —
**not on its body**. Reading the body reverses the finding.

## What `recordLLMRequest` actually does

Its own first two lines:

```js
// Never persist full prompts, message text, tool schemas, or tool names here.
// The optional fourth argument is reduced to content-free provenance only.
```

It passes `provenanceInput.messages` to `buildPromptTraceProvenance()`,
which was read in full (`trace/prompt-provenance.js`, 109 lines). It
computes **only**:

- character *counts* (`content.length`, `block.text.length`)
- a prompt-kind label derived by prefix-matching **WebBrain's own system
  prompts** (`'ask'`, `'act_full'`, `'planner'`, …)

No page content is retained. **`recordLLMRequest` is content-free by
design, and the design is honoured.** My earlier claim was wrong.

## The surface I missed: `recordLLMResponse`

While `recordLLMRequest` is careful, its sibling is not:

```js
export function recordLLMResponse(runId, step, { content, toolCalls, ... }) {
  return _appendEvent(runId, 'llm_response', {
    content: content || null,                    // model output, verbatim
    toolCalls: toolCalls ? toolCalls.map(tc => ({
      id: tc.id,
      name: tc.function?.name,
      args: tc.function?.arguments,              // "string form, as received"
    })) : [],
```

Two concrete leak paths:

1. **`content`** — if the model echoes a secret back, it is persisted.
   WebBrain's own `credential-fields.js` exists precisely because models
   *do* echo credentials, and its mitigation is a prompt instruction,
   which is not a guarantee.
2. **`toolCalls[].args`** — verbatim tool arguments. A `set_field` call
   filling a password field carries the value in its arguments. This is
   the more direct of the two.

## Persistence: confirmed, not inferred

`_appendEvent` → `openDB()` → `indexedDB.open(DB_NAME, DB_VERSION)` →
`objectStore('events').put(ev)`. **IndexedDB — durable browser
storage**, surviving reloads and service-worker eviction (the code
explicitly recovers sequence state after eviction).

Screenshots are persisted too, as Blobs into an `objectStore('shots')`.

## The gate that limits all of it

```js
async function tracingEnabled() {
  const { tracingEnabled } = await chrome.storage.local.get(['tracingEnabled']);
  return tracingEnabled === true;
}
```

Strict `=== true`, so **tracing is OFF by default** — the opposite of
the screenshot-redaction default, and the safe direction here. Every
`_appendEvent` and screenshot write is gated behind it.

## Corrected sink table

| Sink | Persists | Retains content | Default |
|---|---|---|---|
| `recordLLMRequest` | IndexedDB | **No — content-free by design (verified)** | tracing off |
| `recordLLMResponse` | IndexedDB | **Yes — model output + tool args verbatim** | tracing off |
| screenshot recorder | IndexedDB (Blob) | full image | tracing off |
| `_logDebug` | in-memory only, capped | full messages | **always on** |

## What this changes

- **Priority reversed.** `recordLLMResponse` is the trace-side target,
  not `recordLLMRequest`. And because tracing is off by default, the
  *always-on* `_logDebug` may matter more in practice than either —
  though it is memory-only, so it does not survive a reload.
- **The lesson is the one that was requested.** I inferred persistence
  and exposure from byte-accounting and a call signature. Reading the
  bodies reversed one finding and surfaced a different, real one. The
  instruction not to infer was correct, and my first pass did infer.
- **Ozer's scope narrows again, correctly.** Upstream already solved
  request-side trace hygiene. Ozer's genuine contribution here is
  response-side content and tool arguments — a smaller, sharper target.

## Still not verified

- Which `dataUrl` the screenshot recorder receives — the raw capture or
  the redacted `modelDataUrl`. If raw, that is a real leak whenever
  tracing is enabled, and the highest-severity item on this page.
- Trace retention/eviction policy and whether traces are exportable.
