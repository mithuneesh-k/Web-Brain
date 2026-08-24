# ADR 0003: browser-use integration strategy — adapter/companion architecture

## Status
Accepted (architecture/decision only — no implementation performed in
this phase)

## Date
2026-08-24

## Context

Ozer's core requirement (`CONTEXT.md`) is a client-side browser
extension that performs local visual perception, PII/secret detection,
and redaction *before* any context reaches a server-side reasoning
component, which then returns typed actions for local execution.
browser-use (`https://github.com/browser-use/browser-use`, MIT license,
commit `85ddbfedf609166b2d2c76c3d80506649fee82a9` — see
`docs/architecture/upstream.md` and `docs/research/browser-use.md`) was
proposed as the automation foundation. This ADR decides exactly how it
integrates, based on source-level inspection rather than assumption.

## Evidence

Full detail in `docs/research/browser-use.md`. Summary of the two facts
that drive this decision:

1. **browser-use is a Python process** that locates/launches a real
   Chrome/Chromium binary and drives it over Chrome DevTools Protocol
   (`cdp-use`). It is not JavaScript/WASM, and nothing in its dependency
   tree (`psutil`, `screeninfo`, `pyobjc`, subprocess-based Chrome
   discovery) is compatible with a browser extension's sandboxed
   execution context. **It cannot run inside a Chrome or Firefox
   extension.**
2. **browser-use's default vision/extraction paths send raw, unredacted
   content to whatever LLM is configured**, with no sanitization layer
   anywhere in that path (`screenshots/service.py` → `llm/*/serializer.py`
   for images; the `extract` tool sends raw page markdown/text to a
   configured `page_extraction_llm`). This is architecturally the exact
   opposite of Ozer's required data flow if used unmodified.

## Options considered

### Option A — Hard fork
Ozer becomes a fork of browser-use.
- Upstream sync cost: high — every upstream commit must be manually
  diffed and merged; browser-use is an actively developed project
  (commit inspected is from 2026-08-19, i.e. very recent).
- Merge conflicts: likely, especially in `agent/service.py` and
  `screenshots/service.py`, which are exactly the files Ozer would need
  to modify most.
- Ability to modify internals: highest of any option.
- License: MIT permits forking freely; only requires retaining copyright
  notice.
- Maintenance burden: highest of any option — Ozer would own the entire
  Chrome/CDP driving layer, LLM provider serializers, etc., none of which
  are Ozer's actual differentiator.
- **Rejected**: the maintenance burden is disproportionate to the value.
  Ozer's differentiator (per `CONTEXT.md`) is the privacy gate, not
  browser automation internals — a fork means maintaining a large,
  fast-moving codebase for capability Ozer doesn't need to modify at its
  core (CDP driving, tool execution), only at two narrow seams
  (screenshot sourcing, extract-tool input).

### Option B — Vendor source
Copy selected browser-use code into Ozer.
- Attribution: straightforward (MIT), copy `LICENSE`/notice alongside
  vendored files.
- Synchronization: manual, same problem as Option A but scoped to fewer
  files — still requires tracking upstream changes to whatever was
  copied and re-vendoring by hand.
- Maintenance/security update burden: Ozer becomes responsible for
  pulling in upstream security fixes manually; no automated dependency
  update path.
- **Rejected**: doesn't meaningfully reduce Option A's core problem
  (bespoke sync burden) while also not getting the parts of browser-use
  Ozer actually wants to keep current (CDP protocol handling, provider
  API compatibility) via normal dependency updates.

### Option C — Package dependency
Ozer depends on browser-use as a normal upstream Python package.
- Extension capability: **irrelevant to this option specifically** —
  browser-use as a dependency still only runs where Python runs (a
  companion process/server), never inside the extension itself, same as
  every other option except a full reimplementation in JS/WASM.
- API boundaries: clean — `Agent`, `Browser`, `Tools` are the public
  surface; the two risky paths (vision, `extract`) are both
  configurable/excludable via documented parameters
  (`use_vision=False`, `Tools(exclude_actions=['extract'])`) without
  needing to touch browser-use's source at all.
- Customization limits: real but narrow — Ozer cannot change browser-
  use's internal screenshot-capture mechanics without either forking or
  supplying its own already-sanitized image externally (which the
  architecture requires anyway, per the privacy gate design).
- Version pinning: normal (`browser-use==0.13.8` or similar), gets
  security/CDP-protocol updates for free via routine dependency bumps.
- **Selected as the mechanism** for how Ozer consumes browser-use (see
  Selected Approach) — but the *placement* of that dependency in Ozer's
  overall architecture is what Option D below actually decides.

### Option D — Adapter / companion architecture
Keep browser-use as a separate local Python execution component; build
Ozer's extension and privacy layers separately, with browser-use invoked
downstream of Ozer's own privacy gate and reasoning decision.
- Architecture fit: strong — matches the already-established
  conceptual architecture in `CONTEXT.md` (browser extension →
  privacy gate → sanitized context → server reasoning → typed action →
  local execution). browser-use's `Agent`/`tools`/`browser` layers map
  cleanly onto "typed action → local execution," which is exactly the
  piece that must run outside the extension sandbox anyway (browser-use
  requires a full Chrome/Chromium process, which an extension cannot
  spawn from within itself — confirming this placement is not just
  preferred but effectively required by the runtime constraint itself).
- Privacy boundary enforcement: strongest of any option — because
  browser-use only ever receives what Ozer's privacy gate has already
  approved (never its own raw screenshot capture, never raw `extract`
  input), the boundary is enforced by *not feeding it raw data*, which
  is simpler and more auditable than trying to patch sanitization into
  browser-use's internals.
- Extension compatibility: correct by construction — the extension does
  its own local perception/redaction in-browser (JS/WASM), and never
  needs to run Python at all. browser-use runs as a companion process
  the extension/server architecture talks to, not as extension code.
- Maintainability: normal dependency-update maintenance (Option C's
  properties), no fork/vendor burden.
- Demo feasibility: good — browser-use already does clean action
  execution and DOM extraction, which is real, working functionality
  Ozer can point to early rather than reimplementing action execution
  from scratch.
- **Selected.**

### Option E — Selective reimplementation
Reuse architectural ideas, implement independently (e.g. in
TypeScript/JS for the extension, or a smaller custom Python/other
execution layer).
- Effort: high — action execution, CDP handling, and DOM extraction are
  non-trivial and already solved by browser-use.
- Novelty: low value — Ozer's actual innovation is the privacy gate, not
  browser automation mechanics; reimplementing the latter doesn't serve
  the judging metrics in `CONTEXT.md`.
- Licensing: no constraint either way (MIT permits both reuse and
  independent reimplementation).
- Hackathon/SIH feasibility: reimplementing a mature automation engine
  from scratch is a poor use of limited time against a judged deadline.
- **Rejected** for the execution-engine role. Not rejected as a concept
  entirely — Ozer's *privacy gate itself* (local vision, PII detection,
  redaction) is, by definition, being built independently, since nothing
  in browser-use provides it. That's not "reimplementing browser-use,"
  it's building the actual novel component of the project.

## Decision criteria (evaluated across options above)

SIH problem-statement alignment, local browser-side vision requirement,
privacy boundary strength, Chrome/Firefox compatibility, WebGPU/WASM/
ONNX Runtime Web/Transformers.js compatibility (all require the
extension to be JS/WASM — none of these run inside a Python process,
reinforcing that browser-use cannot be the extension itself under any
option), browser-use reuse, development speed, maintenance burden,
upstream synchronization, licensing, and evaluation-metric alignment
were all considered per-option above. Option D dominates on privacy
boundary strength, extension compatibility, and maintenance burden
simultaneously, without meaningfully sacrificing development speed or
browser-use reuse — the other options trade one of those for another
without a matching gain.

## Privacy Bypass Analysis (mandatory)

Every path through which browser-use may move data, evaluated:

| Path | Verdict | Notes |
|---|---|---|
| Screenshot capture (`screenshots/service.py`) | **REQUIRES WRAPPING** | Pure storage, no redaction. Never let browser-use capture its own screenshot of a live page when the source might be sensitive — Ozer's privacy gate must produce any image browser-use is allowed to store/forward. |
| Screenshot → LLM (`llm/*/serializer.py`, `use_vision`) | **REQUIRES MODIFICATION (config)** | Set `use_vision=False` by default in any Ozer-invoked `Agent`, or ensure the only image ever available at this point is already-sanitized. No code change needed in browser-use itself — this is a documented constructor parameter. |
| Page-state/DOM serialization (`dom/service.py`) sent to agent's own LLM reasoning | **REQUIRES WRAPPING** | If Ozer uses browser-use's own `Agent` LLM loop at all (undecided — see Open Risks), the DOM text it feeds that LLM must be Ozer-sanitized DOM, not raw. |
| `extract` tool (LLM extracts from raw page markdown) | **REQUIRES MODIFICATION (config)** | Exclude via `Tools(exclude_actions=['extract'])` unless/until it can be proven to only ever run on already-approved content. |
| Typed browser actions (click/scroll/navigate/input/etc., `tools/service.py`) | **SAFE FOR OZER** | These execute a server-approved typed action against the live page — they don't send page content anywhere; they're the "local execution" half of Ozer's architecture, exactly as intended. |
| Telemetry (PostHog, `telemetry/service.py`) | **REQUIRES MODIFICATION (config)** | Set `ANONYMIZED_TELEMETRY=false`. Not page-content exfiltration, but an unreviewed default third-party network call from inside Ozer's trust boundary. |
| `sensitive_data` credential injection (`agent/service.py`) | **SAFE FOR OZER, DIFFERENT PURPOSE** | This existing browser-use feature keeps credential *values* out of LLM context during typing actions — a different, narrower concern than Ozer's page-content privacy gate, but compatible with it and worth reusing if Ozer ever needs to inject credentials during typed actions. |
| Cloud browser option (`browser/cloud/`, `Browser(use_cloud=True)`) | **NOT REUSABLE** | Sends the entire browsing session to Browser Use's own cloud infrastructure — directly contradicts Ozer's local-execution requirement. Must never be enabled. |

## Selected Approach

**Option D (adapter/companion architecture)**, using browser-use as a
**pinned Python package dependency** (Option C's mechanism) invoked only
by a separate local companion process/server — never inside the browser
extension itself, and never given raw page content browser-use might
otherwise capture on its own.

### WHAT OZER OWNS
- The browser extension itself (JS/WASM runtime): DOM/state extraction
  for the privacy gate's own purposes, local vision inference, local
  PII/secret/face detection, redaction, sanitized-context construction,
  and — critically — the decision of what image/text data, if any, is
  ever handed to the companion process.
- The privacy gate and its enforcement boundary.
- The sanitized-context schema and the typed-action schema (the two
  contracts crossing every boundary in the system).
- The server-side reasoning integration (a separate future decision —
  not necessarily browser-use's own `Agent` LLM loop; browser-use's
  action/tool execution layer can be driven by a typed action Ozer's own
  reasoning produced, without using browser-use's `Agent` as the
  reasoning component at all).

### WHAT BROWSER-USE OWNS
- Chrome/Chromium process discovery, launch, and CDP session management.
- Low-level DOM/state extraction primitives and typed action execution
  (click, scroll, navigate, input, etc.) against the live page, once
  handed an already-decided action.
- Optionally, its own `Agent`/LLM loop and screenshot/extract tooling —
  **only if explicitly reconfigured** per the Privacy Bypass Analysis
  table above (vision off or externally supplied, `extract` excluded,
  telemetry off). Using browser-use's own reasoning loop at all remains
  an open question (see Open Risks) — Ozer may instead drive browser-use
  purely as an action-execution engine under its own typed-action
  contract.

### WHAT DATA CROSSES BETWEEN THEM
Only Ozer-approved typed actions flow from Ozer's reasoning/decision
layer into browser-use's execution layer. Only structured, non-sensitive
execution results (action success/failure, resulting DOM delta) flow
back. Raw screenshots and raw page text are never handed to browser-use
except as content Ozer's own privacy gate has already sanitized, if ever.

### WHERE THE PRIVACY GATE SITS
Entirely inside the browser extension, upstream of everything described
in this ADR. browser-use sits **downstream** of the privacy gate and the
server's typed-action decision — it never sits between raw page content
and the privacy gate.

### WHETHER RAW SCREENSHOTS CAN EVER ENTER BROWSER-USE
**No.** browser-use's own screenshot capture (`screenshots/service.py`)
and vision-enabled LLM path must not be the mechanism by which visual
context reaches any reasoning component in Ozer's architecture. If
browser-use is used at all for anything screenshot-adjacent, it is only
ever given an image Ozer's privacy gate already produced and approved —
never asked to capture and forward its own.

## Why alternatives were rejected
See the per-option evaluations above (Options A, B, E). Summary: A and B
trade unnecessary maintenance burden for internals-modification power
Ozer doesn't need (the two risky paths are both configurable, not
requiring source modification); E discards working, non-differentiating
functionality for no benefit to Ozer's actual judged criteria.

## Consequences
- Ozer's server/companion process gains a pinned `browser-use` package
  dependency once implementation begins (not yet added — this ADR is a
  decision record, not an implementation).
- Every future use of browser-use's `Agent`/`Tools`/`Browser` in Ozer
  code must be checked against the Privacy Bypass Analysis table above;
  a code reviewer should treat `use_vision=True`, an un-excluded
  `extract` action, or `Browser(use_cloud=True)` as an automatic red
  flag in any Ozer PR touching this integration.
- Whether Ozer uses browser-use's own `Agent` LLM loop as its reasoning
  component, or only its lower-level execution/DOM layers under Ozer's
  own reasoning contract, remains open — see Open Risks. This ADR
  decides the *boundary*, not that specific sub-question.

## Upstream synchronization policy
Normal dependency version bumps (`browser-use==<version>` pin in Ozer's
future Python dependency file), re-checked against the Privacy Bypass
Analysis table after every bump — an upstream change to `use_vision`
defaults, the `extract` tool, or telemetry behavior is exactly the kind
of change that could silently reopen a closed bypass path. Record the
pinned version and any resulting changes in
`docs/architecture/upstream.md`'s divergence log going forward.

## License/attribution considerations
MIT — permits use as a dependency with no special obligation beyond
retaining the upstream license notice, which is satisfied automatically
by depending on the published package rather than vendoring source.

## Open Risks
- Whether to use browser-use's own `Agent` LLM reasoning loop at all, or
  only its execution/DOM layers under an Ozer-authored reasoning
  contract, is not decided here — it affects Server Requirements (Phase
  9) more than the upstream-integration boundary this ADR is scoped to.
- browser-use is under active development (commit inspected is from
  2026-08-19); the specific line numbers and function names cited in
  `docs/research/browser-use.md` will drift — treat that document as a
  snapshot at the pinned commit, not a permanently accurate map.
- No hands-on installation or execution of browser-use was performed in
  this phase (research/inspection of cloned source only, no `Agent.run()`
  was executed) — runtime behavior claims are based on source reading,
  not observed execution. Should be validated with an actual smoke test
  once Phase 5 (reproducible running baseline) begins.
