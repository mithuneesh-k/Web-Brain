# Phase 11A: WebBrain v32.2.3 Privacy Boundary Audit

## Status: Q1, Q2 answered decisively. Q3 substantially answered. Q4 not attempted. Source-level evidence at pinned commit `52fb7914611717f2e9774dc137036a074b293b1d`.

## Headline

**WebBrain's screenshot redaction is OFF BY DEFAULT, and when ON it is
rigorous.** Ozer's opportunity is therefore *not* "build a better
redactor" — it is policy, defaults, the text path, and independent
verification.

---

## Q1 — Is screenshot redaction enabled by default?

**No. It is off by default.**

```js
agent.js:606   this.screenshotRedaction = false;
```

`background.js:426-427` only overrides it if the user has explicitly
set the value in storage:

```js
const stored = await chrome.storage.local.get('screenshotRedaction');
if (stored.screenshotRedaction != null) agent.screenshotRedaction = !!stored.screenshotRedaction;
```

And when disabled, redaction is a pass-through:

```js
agent.js:8438   if (!this.screenshotRedaction || !dataUrl) return dataUrl;
```

**Consequence: on a default install, raw screenshots — including any
visible passwords, tokens, OTPs, email addresses and faces — reach the
configured provider.** The machinery to prevent that exists and is
good; it is simply not on.

This is the single most consequential finding of the audit.

---

## Q2 — Does it fail open or fail closed?

**When enabled: fail-closed, and more rigorously than Ozer's own
pipeline.** From the `/screenshot` path (`agent.js:1742-1765`):

1. If the redaction collector cannot inspect the page (both before and
   after probes fail) → **refuses to produce a model-facing copy**:
   > "Screenshot redaction cannot inspect this page, so no private
   > model-facing copy can be made."
2. If the page **changed during capture** (`JSON.stringify(before.snapshot)
   !== JSON.stringify(after.snapshot)`) → **refuses**. This is a
   time-of-check/time-of-use guard against the page mutating mid-capture.
   **Ozer's threat model (Phase 6, T1–T15) does not contain this
   threat.** It should.
3. If regions were found but redaction produced a byte-identical image
   → **refuses**:
   > "Could not create the private model-facing screenshot copy"
   This catches the redaction-no-op failure mode directly.

**When disabled: open by design** — see Q1.

---

## Q3 — What reaches the provider besides the redacted image?

### Screenshot paths — consistently redacted (better than first assumed)

I initially suspected a bypass: `agent.js:7604` passes `shot.dataUrl`
(not `shot.modelDataUrl`) into `_describeScreenshot()`, whose
transcription is then pushed to the provider as text. **That suspicion
did not hold and is recorded here so it is not re-raised.**
`_captureAutoScreenshot` (8317–8437) applies
`_redactScreenshotDataUrl()` at *all three* of its return points, so
`shot.dataUrl` is already the redacted copy. The same is true of the
media-localisation path (~8705) and the full-page path (21309, which
uses `modelDataUrl` explicitly).

WebBrain's own docstring confirms the intent:

> "Optionally redact PII from a captured screenshot BEFORE it is ever
> sent to a Vision endpoint (issue #312) … the service worker
> **pixelates** those boxes with OffscreenCanvas."

### The text path — NOT redacted, only prompt-wrapped

Page-derived **text** enters provider messages through several routes,
and none of them is redacted. The mitigation is `_wrapUntrusted()`, a
nonce-delimited `<untrusted_page_content>` boundary:

| Path | Evidence | Protection |
|---|---|---|
| `get_interactive_elements` element labels | `agent.js:7599` `_formatElementsList()` → `_wrapUntrusted()` | prompt boundary only |
| Vision-model transcription of the screenshot | `7604-7611`, `desc.text` → `_wrapUntrusted('screenshot', …)` | prompt boundary only (image itself was redacted) |
| Accessibility tree | `accessibilityTreeMaxChars` (26330, 26538, 27349, 27403) | not audited in detail |
| Tool results | `_wrapUntrusted(<tool>, …)` | prompt boundary only |
| Conversation history incl. credential values | Phase 8A, `agent/credential-fields.js` | **prompt instruction only** |

`_wrapUntrusted()` is a **prompt-injection** defence — it stops page
text being read as *instructions*. It is **not** a privacy control: the
content still reaches the provider verbatim.

**This is the gap Ozer's Phase 8A finding already identified, now
confirmed to be the general shape of the text path, not a
credential-specific quirk.** A perfectly redacted screenshot can be
accompanied by a message containing the same value in plain text.

### Redaction strength

WebBrain **pixelates**. Ozer's `strict` mode **solid-masks**, and
Ozer's own ADR 0006 records why: pixelation and blur are not
irreversible. This is a genuine, defensible difference — but it is a
difference of *policy strength*, not of capability.

---

## Q4 — Can WebBrain's collector accept Ozer detection?

**Not attempted.** Requires reading
`content/redaction-regions.js` region-emission in full plus
`agent/screenshot-redaction.js`. This is the next thing to establish,
because it decides whether Ozer supplies detection into WebBrain's one
pipeline (the "one region list" outcome) or sits beside it.

---

## Classification table (the requested deliverable)

| Page-derived data reaching the provider | Status |
|---|---|
| Screenshot pixels, redaction **enabled** | **locally protected** (pixelated, fail-closed) |
| Screenshot pixels, redaction **disabled (DEFAULT)** | **unprotected** |
| Vision transcription of screenshot | derived from a redacted image when enabled; **unprotected by default** |
| Interactive-element labels | **prompt-protected only** |
| Accessibility tree | **unknown** — not audited |
| Tool results | **prompt-protected only** |
| Conversation history / credential values | **prompt-protected only** (Phase 8A) |
| Faces / non-text visual PII | **unknown** — no evidence WebBrain's collector detects faces; its regions are DOM-derived |

---

## What this means for Ozer

Ozer should **not** rebuild screenshot redaction. It should own:

1. **Policy and defaults** — redaction on, fail-closed, not opt-in.
   The single highest-impact change available, and it requires almost
   no new code.
2. **The text path** — the best-evidenced unprotected surface, and the
   one WebBrain explicitly does not cover.
3. **Independent egress verification** — `assertSafeForEgress()` at the
   provider boundary, asserting rather than transforming (per the
   synchronous-seam finding).
4. **Strict masking over pixelation** where the threat model demands a
   guarantee.
5. **Faces / non-DOM visual PII** — WebBrain's regions are DOM-derived,
   so a face in an `<img>` appears unprotected. Unverified, but this is
   where Tier 3 would genuinely add capability rather than duplicate it.

Ozer should **stop claiming** Tier 1 DOM-field detection and DOM→pixel
geometry as differentiators. They are duplicates of existing upstream
capability, better-specified in places, but not novel.

## Threat-model debt discovered

Ozer's Phase 6 threat model should gain WebBrain's TOCTOU threat: *the
page mutates between region collection and capture, so redaction boxes
no longer match the pixels.* WebBrain guards this with before/after
snapshot equality. Ozer has no equivalent and its `redactImageData()`
would happily mask stale coordinates.

## Corrections to earlier Ozer documents

- `docs/research/webbrain-existing-redaction.md` said the overlap made
  a "meaningful fraction" of Phases 7/9/10 duplicative. That stands,
  **but** it understated WebBrain's rigour (fail-closed, TOCTOU) and
  did not know redaction was off by default — which reframes the
  opportunity from "duplicate" to "policy and coverage".
