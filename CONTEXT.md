# Ozer — Project Context

## What this is

Ozer: on-device visual perception for privacy-preserving browser agents. Sensitive
content (PII, passwords, faces, secrets) is detected and redacted **locally, in the
browser**, before any visual/context data crosses the network. A server-side
LLM/VLM reasons only over sanitized context and returns structured browser actions,
which are executed locally.

Upstream automation foundation: [browser-use/browser-use](https://github.com/browser-use/browser-use).
Ozer's differentiator is the local privacy gate, not the browser-control layer.

## Canonical vocabulary

- **Privacy gate** — the local subsystem (vision + PII detectors + DOM analysis +
  redaction) that sits between raw browser state and anything sent to a server. It
  is a security boundary, not a best-effort filter.
- **Sanitized context** — the only data structure allowed to cross the network
  boundary. Must be schema-validated.
- **Structured action** — typed browser command (click/scroll/navigate/type/etc.)
  returned by the server, validated locally before execution.
- **Sensitive category** — an explicitly modeled class of sensitive data (password
  field, email, phone, name, address, payment info, government ID, auth
  token/API key/session ID, face, free-text PII, hidden DOM secret, visually
  embedded PII). Never handled via ad-hoc conditionals.

## Non-negotiable architectural constraint

```
RAW DATA -> LOCAL DETECTION -> LOCAL REDACTION -> SANITIZATION ASSERTION -> NETWORK
```

Never: raw data to network, redacted afterward. Every outbound visual-context
request passes through one identifiable privacy-controlled interface.

## Judging metrics (weight)

1. Accuracy of visual context from screen — 25%
2. Recall/precision of sensitive-data detection — 20%
3. Precision of redaction — 20%
4. Client-side resource utilization — 20%
5. End-to-end latency — 15%

Every subsystem should state which metric it serves and how it's measured.

## Current state (2026-08-24)

- Repository cloned from `mithuneesh-k/Ozer` (public, GitHub). Prior contents:
  single empty `Ozer.txt` on `main` (commit `89c852a`). Effectively no existing
  implementation — treat as a bootstrap target, not a working codebase.
- Engineering operating system (this file, `AGENTS.md`, `CLAUDE.md`, `docs/`,
  `logs/`) is being established in this session, per `OZER-FOUNDATION-001`.
- Matt Pocock skill package installed (`mattpocock/skills`, 36 skills) —
  see `docs/research/matt-pocock-skills.md`, `docs/adr/0001-*.md`.
- Graphify (Graphify Labs, PyPI `graphifyy`) installed at version
  `0.9.48`, scoped to **code-graph indexing only** — Markdown/spec/ADR
  retrieval remains direct reading. See `docs/research/graphify.md`,
  `docs/architecture/graphify-integration.md`, `docs/adr/0002-*.md`.
- **ARCHITECTURE PIVOT (current direction, ADR 0005)**: WebBrain
  (`webbrain-one/webbrain`, v33.2.1, **GPL-3.0-or-later**, inspected at
  pinned commit `692cdf25e883b528f0e37e88b644705b54c3635e`) becomes the
  browser-agent foundation. **Ozer becomes the local privacy layer**,
  not a competing browser agent. Protection is layered: the local
  privacy gate is PRIMARY, an OpenAI-compatible local proxy is defense
  in depth. Decisive finding: WebBrain's credential protection is
  prompt-level, not egress-level — it tells the model not to quote a
  credential, but the credential still reaches the provider
  (`agent/credential-fields.js`: "The value is in the conversation
  history above if you need to reference it"). That gap is Ozer's
  contribution. See `docs/research/webbrain.md`,
  `docs/specs/phase8a-webbrain-feasibility.md`,
  `docs/adr/0005-webbrain-as-agent-ozer-as-privacy-layer.md`.
  **No WebBrain code has been imported, forked, or modified.**
- browser-use (`browser-use/browser-use`, MIT, commit
  `85ddbfedf609166b2d2c76c3d80506649fee82a9`) was inspected at source
  level in Phase 4 and selected as the execution engine — **now
  superseded in part by ADR 0005** (WebBrain fills that role instead).
  It was never installed or imported, so nothing needs unwinding. Its
  privacy-bypass analysis remains valid and carries over. See
  `docs/research/browser-use.md`,
  `docs/adr/0003-browser-use-integration-strategy.md`.
- **Phase 5 (reproducible baseline) complete**: `extension/` (Manifest
  V3 stub), `server/` (FastAPI reasoning stub), `companion/` (FastAPI
  execution stub), `schemas/` (shared JSON Schema contracts:
  `SanitizedContext`, `TypedAction`, `ExecutionResult`). A real,
  live end-to-end round trip was proven (not simulated) — see
  `docs/specs/phase5-reproducible-baseline.md` and
  `docs/adr/0004-phase5-monorepo-runtime-choice.md`. All stub logic is
  explicitly marked as such in code comments; no real reasoning,
  detection, or browser automation exists yet.
- **Phases 6–8 complete — the privacy pipeline is real, tested, and is
  the part of Ozer that survives the pivot unchanged** (it is
  transport-agnostic pure logic):
  - Phase 6: threat model (15 threats), privacy contract,
    trust boundaries, `SanitizedContext` v1.1.0 with privacy metadata,
    fail-closed `assertSafeForEgress()`, `sanitizeForLogging()`,
    `validate_typed_action()`, and the adapter boundary that structurally
    prevents raw screenshots reaching a downstream executor.
  - Phase 7: Tier 1 deterministic DOM/pattern detection (password, OTP,
    API key/token, email, phone, Luhn-validated card), redaction, and
    `OzerPrivacyClient` as the single enforced egress path.
  - Phase 8: Tier 2 semantic detection with additive confidence fusion,
    the normalized `SensitiveRegion` contract every detector emits, and
    an architecture test that scans `extension/src/` and fails on any
    direct `fetch()` outside `ozerPrivacyClient.js`.
  - Detection accuracy so far: 100% recall/precision on a **17-case
    synthetic fixture set of our own construction** — a deterministic
    self-check, *not* a real-world benchmark. Do not describe it as one.
- **Tier 3 (local visual detection) not started.** WebBrain ships an
  in-browser WebGPU VLM (`webbrain-one/webbrain-vl-2-450M-onnx`) that is
  a reuse candidate — unverified whether it is invocable independently
  of WebBrain's agent loop.
- GitHub remote push access: VERIFIED as of this session (collaborator
  access granted; local HEAD and `origin/main` independently confirmed
  equal after every phase).

## Current Privacy Verification Status

**Real browser geometry. Synthetic image capture. No extension
integration yet.**

Keep those three clauses together. They state, in order, exactly what
has and has not been proven, and they are the guard against this claim
being quietly upgraded in a later phase.

Tier 1 and Tier 2 region geometry is verified against real
browser-rendered geometry, including fractional DPR (`1.25`) and
viewport-overflow cases.

The verification uses real `getBoundingClientRect()` output from a
browser-rendered fixture. **The image buffer used in the integration
test is synthetic**, and Ozer is **not yet integrated into a loaded
browser extension**. This is therefore evidence that the DOM-to-pixel
coordinate boundary is correct for the tested cases — **not** a claim of
full browser-extension end-to-end verification.

On the project-authored fixture, Tier 1 and Tier 2 detected all 5
intended sensitive fields with 0 observed false positives. **This is a
deterministic integration check, not an independent benchmark** — the
fixture was written by this project, so the number measures internal
consistency, not real-world recall.

The next major privacy gap is Tier 3 visual detection and real
screenshot capture through the WebBrain integration path.

### Phrases that would be false if written today

Listed explicitly so nobody has to re-derive the boundary:

- "end-to-end verified in the browser" — the extension integration does
  not exist.
- "verified on real screenshots" — the integration test redacts a
  synthetic pixel buffer, not a captured image.
- "N% recall/precision" quoted without "on our own fixture".
- "Tier 3 works" / "faces are redacted" — no face detector exists; the
  demo images use hand-supplied boxes.
- "blur is irreversible" — it is not; solid masking (the default) is
  the only guarantee.

Evidence for everything above: `docs/specs/phase10-region-production.md`,
`extension/test/integration/realPagePipeline.test.js`.

## Open questions (unresolved)

- **Distribution licensing — the real blocker.** WebBrain 33.0.0+ is
  GPL-3.0-or-later (pre-33.0.0 is MIT). Keeping Ozer a separate program
  communicating over a network protocol is the shape most likely to
  avoid derivative-work obligations, but that is a legal question, not
  an engineering one, and is **unresolved**. Evaluating/prototyping
  against GPL code differs materially from distributing a modified
  combined extension. Ozer also has no `LICENSE` file of its own yet.
- **How the local gate (primary protection) attaches to an unmodified
  WebBrain.** ADR 0005 decided the gate is primary; the mechanism is not
  yet designed, and if it requires modifying WebBrain it reopens the
  licensing question above. This is the next real design question.
- Whether `webbrain-one/webbrain-vl-2-450M-onnx` is invocable
  independently of WebBrain's agent loop (Tier 3 reuse).
- Proxy precondition: Ozer's OpenAI-compatible endpoint must advertise a
  vision-matching model identity (or use WebBrain's `visionMode`
  override), or WebBrain strips screenshots before they reach Ozer —
  Tier 3 would silently have nothing to redact. Needs a test.
- Target browsers confirmed as Chrome + Firefox; WebBrain's Firefox
  source-level parity not yet verified.
- Graphify has still never been run against this repo — test fixtures
  contain synthetic secret-shaped strings that current
  `.graphifyignore` filename patterns would not exclude. Deferred
  deliberately since Phase 6.

## Source-of-truth order

1. Current repository state and executable code
2. Tests and measured outputs
3. Repository configuration
4. Architecture/spec/ADR markdown in `docs/`
5. Official upstream docs and source repos
6. External research from primary sources (recorded under `docs/research/`)
7. Conversation context

Conflicts between sources are recorded explicitly (in the relevant doc), never
silently reconciled.
