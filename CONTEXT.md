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
- Graphify (Graphify Labs, PyPI `graphifyy`) researched and RECOMMENDED as
  a local, code-only index layer only — not installed yet. See
  `docs/research/graphify.md`, `docs/adr/0002-*.md`.
- browser-use (`browser-use/browser-use`, MIT, commit
  `85ddbfedf609166b2d2c76c3d80506649fee82a9`) inspected at source level.
  **Confirmed**: it is a Python process that drives a real Chrome/Chromium
  binary over CDP — it cannot run inside a browser extension, and its
  default screenshot/`extract` paths send raw page content to an LLM with
  no sanitization. Integration strategy decided: adapter/companion
  architecture (browser-use as a pinned dependency of a separate local
  process, downstream of Ozer's own privacy gate — never given raw
  screenshots). See `docs/research/browser-use.md`,
  `docs/adr/0003-browser-use-integration-strategy.md`,
  `docs/architecture/upstream.md`. **No browser-use code has been
  installed or copied into Ozer yet** — decision only, no implementation.
- No privacy architecture has been implemented yet. No local model has
  been selected.
- GitHub remote push access: VERIFIED as of this session (collaborator
  access granted; local HEAD and `origin/main` independently confirmed
  equal after every phase).

## Open questions (unresolved)

- Whether to use browser-use's own `Agent`/LLM reasoning loop, or only
  its lower-level execution/DOM layers under an Ozer-authored reasoning
  contract — deferred to server-reasoning design (later phase), not
  blocking the upstream-boundary decision already made.
- Target browsers confirmed as Chrome + Firefox; extension API differences not
  yet investigated.
- Local inference stack (WebGPU/WASM/ONNX Runtime Web/Transformers.js/model
  choice) not yet evaluated against fixtures.

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
