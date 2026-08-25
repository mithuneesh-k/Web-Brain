# ADR 0005: WebBrain is the browser agent; Ozer is the privacy layer

## Status
Accepted (architecture direction). **Distribution licensing remains an
open decision — see "Open risks".** No WebBrain code has been imported,
forked, or modified.

Supersedes the execution-layer half of
[ADR 0003](./0003-browser-use-integration-strategy.md) (browser-use as
the companion execution engine). ADR 0003's *privacy-bypass analysis*
remains valid and its reasoning carries over directly to WebBrain — see
"Relationship to ADR 0003".

## Date
2026-08-24

## Decision

Ozer stops building its own browser agent. **WebBrain
(`webbrain-one/webbrain`) becomes the browser-agent foundation** —
Chrome/Firefox extensions, agent loop, Ask/Act modes, accessibility-tree
reading, tool system, permission gates, site adapters, traces, UI, and
in-browser WebGPU inference. **Ozer becomes the local privacy and
security layer** that constrains what that agent is permitted to reveal.

Protection is layered, and the ordering is deliberate:

1. **Primary — the local privacy gate.** Ozer's existing
   detection → redaction → `assertSafeForEgress()` pipeline is the main
   protection. It runs before anything leaves the device.
2. **Defense in depth — the OpenAI-compatible local proxy.** Ozer also
   exposes an OpenAI-compatible endpoint that WebBrain can be pointed at
   via `config.baseUrl`, so all configured model traffic passes through
   a controllable boundary even if WebBrain's provider internals change.

```
WebBrain (agent, UI, browser control)
      |  page / DOM / screenshot context
      v
OZER LOCAL PRIVACY GATE          <-- PRIMARY
  Tier 1 DOM  +  Tier 2 semantic  +  Tier 3 visual (future)
  detect -> redact -> fail-closed
      |  sanitized context only
      v
OZER OPENAI-COMPATIBLE PROXY     <-- DEFENSE IN DEPTH
      |
      v
Cloud LLM / VLM
      |  typed action
      v
WebBrain action layer (visible execution)
```

## Context

Ozer had been building an extension/server/companion baseline from
scratch (Phases 5–8). WebBrain already provides all of that
substrate and more. Rebuilding it is waste on a hackathon timeline.

The decisive finding from Phase 8A
([`docs/research/webbrain.md`](../research/webbrain.md)) is that
WebBrain's own credential protection is **prompt-level, not
egress-level**. From `src/chrome/src/agent/credential-fields.js` at
pinned commit `692cdf25e883b528f0e37e88b644705b54c3635e`, WebBrain
appends a note asking the model not to quote a credential back, and its
own comment states:

> "The value is in the conversation history above if you need to
> reference it."

So the current shape is:

```
sensitive value -> sent to LLM -> LLM told "don't reveal this"
```

Ozer changes it to:

```
sensitive value -> detected locally -> redacted -> only sanitized context leaves the device
```

That difference is the project's actual contribution, and it is exactly
what the SIH problem statement asks for. It is also a claim we can
demonstrate against a real, working, well-engineered agent rather than a
strawman.

## Evidence

All from Phase 8A source inspection at pinned commit
`692cdf25e883b528f0e37e88b644705b54c3635e` (v33.2.1); full quotes and
file paths in `docs/research/webbrain.md`:

- `BaseLLMProvider.chat()/chatStream()` is a genuine common interface;
  `_messagesContainImage()` shows screenshots ride inside the same
  `messages` array as `image_url`/`image` blocks — one structure carries
  all provider-bound context.
- `providers/openai.js` resolves `this.config.baseUrl` and self-describes
  as supporting "any OpenAI-compatible endpoint" — the proxy layer is
  possible with **zero** WebBrain modification.
- `chat()`/`chatStream()` has four call sites, all inside `agent.js`.
- `openai.js` forwards `image_url` blocks, **but** `agent.js:18609`
  strips all images when `provider.supportsVision` is false, and for
  custom endpoints that flag is decided by model-name regex sniffing
  (`openai.js:135`). This is a hard precondition on the proxy layer —
  see "Consequences".
- `providers/webgpu.js` declares an in-browser vision-language model
  (`webbrain-one/webbrain-vl-2-450M-onnx`) — a Tier 3 candidate.

## Alternatives considered

Full option analysis is in
[`docs/specs/phase8a-webbrain-feasibility.md`](../specs/phase8a-webbrain-feasibility.md).
Summary of why this decision differs from that document's own
recommendation:

- **Option A (fork WebBrain)** — best seam, worst maintenance; a fork of
  a 1.23 GB actively-developed GPL project on a hackathon timeline.
  Rejected.
- **Option B (upstream patch)** — good long-term, unschedulable, depends
  on upstream acceptance. Rejected as a primary plan; retained as the
  Option E parallel track.
- **Option C alone (proxy as primary)** — this was the Phase 8A
  recommendation and it was **wrong on its own terms**. That analysis
  itself identified "configuration-dependent, not enforced — if a user
  points WebBrain straight at a cloud provider, Ozer is bypassed
  entirely" as the option's central weakness, then recommended it as the
  *primary* mechanism anyway. The SIH problem statement requires
  sanitization before any network request, which a bypassable proxy does
  not guarantee. Corrected here.
- **Option D (keep building Ozer's own agent)** — rebuilds everything
  WebBrain already has. Rejected, though the existing Ozer extension
  stays useful as a reference implementation and test harness.

## Consequences

**What survives unchanged.** All Phase 6–8 privacy work remains the core
of the product, because it is transport-agnostic pure logic:
`egressGate.js`, `domDetector.js`, `tier1Detector.js`,
`tier2Detector.js`, `combineDetectors.js`, `regionTypes.js`,
`redactor.js`, `logSanitizer.js`, plus the threat model, privacy
contract, and trust-boundary documents. Commits `b266041` and `e7b24ae`
are preserved, not discarded.

**What changes.** Ozer's `extension/`, `server/`, and `companion/` stop
being the target product architecture. They remain valuable as a
reference implementation, a deterministic test harness, and the
scaffolding the proxy will be built from.

**Hard precondition on the proxy layer.** Ozer's proxy must advertise a
vision-matching model identity (or use WebBrain's `visionMode`
override), or WebBrain strips screenshots before they ever reach Ozer —
Tier 3 would silently have nothing to redact while the text tiers kept
working normally. This is a configuration requirement, not a blocker,
but it is a silent-failure mode and must be covered by a test.

**Honesty constraint for any demo or writeup.** The layered design
strengthens the claim but does not make it absolute. What is true:
*Ozer sanitizes page-derived context before it leaves the device, across
both the local gate and the proxy boundary.* What is **not** true and
must not be claimed: that Ozer makes it impossible to route around it,
or that Ozer's detection has been validated against real-world data.
Detection accuracy so far is 100% on a 17-case synthetic fixture set of
our own construction — a deterministic self-check, not a benchmark
result.

## Relationship to ADR 0003

ADR 0003 selected browser-use as a downstream companion execution engine
and established that raw screenshots must never enter it. WebBrain
replaces browser-use in that role, so the *selection* is superseded. The
*principle* is not: ADR 0003's privacy-bypass analysis found that
browser-use's default vision path forwards raw screenshots to an LLM
with no sanitization, and Phase 8A found WebBrain does the functionally
equivalent thing for credentials via a prompt-level mitigation. The same
boundary discipline applies, now to a different upstream.

## Open risks

1. **Distribution licensing — unresolved, and the real blocker.**
   WebBrain 33.0.0+ is GPL-3.0-or-later (pre-33.0.0 is MIT). The
   architecture chosen here keeps Ozer a *separate program communicating
   over a network protocol*, which is the shape most likely to avoid
   derivative-work obligations — but that is a legal question, not an
   engineering one, and **this ADR does not resolve it**. Evaluating and
   prototyping against the current GPL code is a materially different
   act from distributing a modified combined extension. Get a real
   license review before distribution. Ozer also still has no `LICENSE`
   file of its own.
2. Whether `webbrain-vl-2-450M-onnx` is invocable independently of
   WebBrain's agent loop (Tier 3 reuse) — unverified.
3. Firefox source-level parity — unverified.
4. The local gate's placement relative to WebBrain is not yet designed.
   Making it *primary* rather than proxy-only is the decision recorded
   here; the mechanism by which it attaches to an unmodified WebBrain is
   the next real design question, and it may reopen the licensing
   question if it requires modifying WebBrain.
