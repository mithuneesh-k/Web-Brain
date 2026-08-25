# Upstream Identity

**Official repository:** `https://github.com/browser-use/browser-use`
**License:** MIT (`LICENSE`, copyright Gregor Zunic, 2024)
**Branch inspected:** `main`
**Exact commit SHA inspected:** `85ddbfedf609166b2d2c76c3d80506649fee82a9`
**Commit date:** 2026-08-19 10:35:20 -0700
**Date inspected:** 2026-08-24 (this session)
**Package version at this commit:** `0.13.8` (`pyproject.toml`)
**Method:** shallow clone (`git clone --depth 1`) into a throwaway scratch
directory outside this repository; inspected directly, nothing copied into
Ozer.

---

# Architecture

Observed by reading actual source (`browser_use/` package), not inferred
from names alone.

- **Agent loop** — `agent/service.py`. Owns the `Agent` class: task loop,
  `use_vision` setting (default `True`/`"auto"`), `sensitive_data` handling,
  step/action orchestration, calls into `llm/`, `tools/`, `browser/`.
- **LLM interface** — `llm/`. Provider-specific packages (`anthropic/`,
  `google/`, `openai/`, `groq/`, `ollama/`, `deepseek/`, `azure/`, `aws/`,
  `browser_use/` [their own hosted `ChatBrowserUse`], `litellm/`, etc.),
  each with a `serializer.py` that converts internal message objects
  (`llm/messages.py`) — including image content — into that provider's
  wire format.
- **Browser/session layer** — `browser/`. `session.py` (`BrowserSession`,
  aliased as `Browser`), `chrome.py` (locates/launches a real Chrome/
  Chromium **executable** on the host OS), `profile.py`, `watchdogs/`
  (background monitors), `cloud/` (Browser Use's own hosted cloud-browser
  option). Connects via **Chrome DevTools Protocol** (`cdp-use==1.4.5`
  dependency) — not Playwright, not an in-browser extension API.
- **DOM/state extraction** — `dom/service.py`, `dom/enhanced_snapshot.py`,
  `dom/serializer/`. Builds a structured accessibility/DOM snapshot of the
  page for the agent to reason over.
- **Screenshot/vision handling** — `screenshots/service.py`. A thin
  storage service: takes a base64 PNG, writes it to
  `<agent_dir>/screenshots/step_N.png`, and can reload it as base64 later.
  **No redaction, filtering, or sensitivity check of any kind** — it is
  pure storage/retrieval.
- **Action generation** — the `Agent` loop asks the configured LLM (via
  `llm/`) for the next action(s), constrained by the registered tool
  schema.
- **Action execution** — `tools/service.py` (the default action
  registry) + `actor/` (lower-level page/mouse/element primitives used by
  actions internally).
- **Tool/action registry** — `tools/registry/`, `tools/service.py`.
  Decorator-based (`@registry.action(...)`), extensible via user code
  (`Tools(exclude_actions=[...])`, custom `@tools.action`).
- **Configuration** — `config.py`, environment variables (`.env`,
  `ANONYMIZED_TELEMETRY`, provider API keys), `Browser`/`Agent`
  constructor parameters.
- **Tests** — `tests/` at repo root: `agent_tasks/`, `ci/`,
  `mind2web_data/`, `scripts/` — task-based agent evaluation plus CI unit
  tests. Not deeply inspected beyond directory listing (out of scope for
  this integration-strategy phase).

---

# Dependencies

From `pyproject.toml` (pinned exact versions at this commit) — the ones
that matter for Ozer's evaluation:

- **`cdp-use==1.4.5`** — Chrome DevTools Protocol client. Confirms
  browser-use talks to a real browser process over CDP, not an in-page
  extension API.
- **No Playwright dependency** in the core `dependencies` list (contrary
  to this project's earlier assumption in `CONTEXT.md`'s open questions —
  worth correcting there). CDP is used directly.
- **`browser-harness==0.1.9`**, **`browser-use-sdk==3.4.2`** — first-party
  Browser Use packages for their own harness/cloud SDK.
- LLM provider SDKs pinned directly: `anthropic==0.76.0`,
  `openai==2.16.0`, `google-genai==1.65.0`, `groq==1.0.0`,
  `ollama==0.6.1`, etc. — i.e. browser-use itself talks to LLM APIs
  directly per-provider, there is no single abstracted "send to whatever
  model" boundary Ozer could trivially intercept without touching
  provider-specific serializer code.
- **`posthog==7.7.0`** — telemetry client. Enabled by default
  (`ANONYMIZED_TELEMETRY` env var, default true per
  `telemetry/service.py`), posts to `https://eu.i.posthog.com`. Anonymized
  per their docs, but still a default third-party network call from a
  tool that would sit inside Ozer's trust boundary — worth disabling
  explicitly (`ANONYMIZED_TELEMETRY=false`) in any integration.
- `requires-python = ">=3.11,<4.0"`.

---

# Extension Compatibility

**Not suitable for direct execution inside a Chrome or Firefox browser
extension**, based on direct evidence, not assumption:

1. **It is a Python application**, not JavaScript/TypeScript. Browser
   extensions (Manifest V3 for Chrome, WebExtensions for Firefox) run
   content scripts, background service workers, and popup pages in the
   browser's own JS/WASM sandbox. There is no supported way to run an
   arbitrary Python process (`browser_use/browser/chrome.py` shells out to
   locate/launch a Chrome/Chromium **binary** via `subprocess`) from
   inside that sandbox.
2. **It launches or connects to an external, full Chrome/Chromium
   process** via CDP (`cdp-use`), rather than running *as* a page/
   extension context. An extension cannot spawn or CDP-connect to a
   sibling browser process from within its own sandbox — that capability
   belongs to a host application (e.g. a native Python process, or a
   dedicated automation/debugging surface), not to extension code.
3. **Dependencies assume a full OS-level runtime**: `psutil`,
   `screeninfo` (non-macOS), `pyobjc` (macOS-only), filesystem access for
   screenshots/downloads/profiles — none of this is available inside a
   browser extension's restricted execution context.
4. This confirms the constraint the user already suspected before this
   phase ran: **a Python-based browser-automation framework and a
   client-side browser extension are fundamentally different runtimes**,
   and browser-use is unambiguously the former.

**What Codex would need to change nothing about**: browser-use running as
a **separate local process** (invoked by a companion service, not by the
extension itself) is architecturally normal and exactly how it's designed
to run today (`Agent(...).run()` from a Python script). This is the
Option D shape (see below).

---

# Reusable Components

- **Agent loop architecture and prompting patterns** (`agent/service.py`,
  `agent/prompts.py`) — conceptually reusable as reference for how to
  structure a server-side reasoning loop over a sanitized-context input,
  even if not reused as literal code, since it currently assumes raw
  screenshots as its vision input.
- **Action/tool registry pattern** (`tools/registry/`,
  `@registry.action`) — a clean, typed pattern (Pydantic-validated action
  params, structured `ActionResult`) worth mirroring for Ozer's own
  typed-action contract between server reasoning and local execution.
- **DOM/state extraction approach** (`dom/service.py`,
  `dom/enhanced_snapshot.py`) — useful reference for what a structured,
  non-visual page representation looks like, which is directly relevant
  to Ozer's "sanitized DOM structure" concept in `CONTEXT.md`.
- **As a standalone companion process**: browser-use itself (the whole
  package, unmodified or lightly wrapped) is reusable as the actual
  browser-driving component *after* Ozer's own privacy gate and sanitized
  reasoning have decided what action to take — see Option D.

# Non-Reusable Components

- **The screenshot service and its default LLM wiring**
  (`screenshots/service.py` + `use_vision` path through
  `llm/*/serializer.py`) — sends raw, unredacted screenshots to whatever
  LLM is configured, by default. This is the exact opposite of Ozer's
  required data flow and cannot be reused as-is; it can only be reused if
  wrapped so that Ozer's privacy gate substitutes sanitized images before
  this path ever runs (see Privacy Bypass Analysis).
- **The `extract` tool** (`tools/service.py`, "LLM extracts structured
  data from page markdown") — sends raw page markdown/text directly to a
  configured `page_extraction_llm`. Same issue: no sanitization step.
- **Anything requiring a full local Chrome/Chromium install and Python
  runtime** — cannot run inside the browser-extension client Ozer's
  problem statement requires (see Extension Compatibility above).
- **Default telemetry** (PostHog) — not a hard blocker, but must be
  explicitly disabled (`ANONYMIZED_TELEMETRY=false`) in any Ozer
  integration to avoid an unreviewed default network call.

# Modification Seams

Smallest technically justified seams, if browser-use is used as a
companion execution engine (Option D, see ADR 0003):

1. **Never call `Agent.run()` with `use_vision=True`/`"auto"` pointed at
   raw page screenshots.** Either set `use_vision=False` entirely (text/
   DOM-only reasoning) or, if visual context is needed, substitute
   Ozer's own already-redacted image before it reaches browser-use's
   `screenshots/service.py` — i.e. Ozer's privacy gate produces the
   image, browser-use never captures its own.
2. **Do not use the `extract` tool as shipped** if it would run against
   raw page content — either exclude it (`Tools(exclude_actions=
   ['extract'])`) or ensure it only ever runs against content Ozer's
   privacy gate has already approved.
3. **Treat browser-use as the action-execution and DOM-observation
   engine only**, downstream of Ozer's own reasoning decision — i.e.
   browser-use's own `Agent` LLM loop is not necessarily the reasoning
   component Ozer's architecture needs; browser-use's lower-level pieces
   (`browser/`, `dom/`, `tools/` action execution) are the reusable seam,
   not necessarily its top-level `Agent`.
4. **Disable telemetry explicitly** (`ANONYMIZED_TELEMETRY=false`) at
   the process boundary where browser-use is invoked.
