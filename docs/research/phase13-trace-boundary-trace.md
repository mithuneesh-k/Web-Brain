# Phase 13: tracing the observability boundary

## Status: source trace COMPLETE, no implementation. Evidence at pinned commit `52fb7914611717f2e9774dc137036a074b293b1d`.

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
