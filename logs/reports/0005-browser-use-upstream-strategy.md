# Engineering Report

## Run
0005-browser-use-upstream-strategy

## Objective
Phase 4 only: determine, with source-level evidence, exactly how Ozer
should incorporate browser-use — extension compatibility, privacy-bypass
analysis, integration-option comparison, one explicit selected strategy,
explicit ownership/data-flow/privacy-gate-placement statements. No
implementation, no Phase 5.

## Starting Commit
`801df769961466844b25475d810906e2411f69d9` (`main`, matched local and
`origin/main`).

## Changes
- `docs/research/browser-use.md` — full source-level architecture
  analysis.
- `docs/architecture/upstream.md` — exact commit pin
  (`85ddbfedf609166b2d2c76c3d80506649fee82a9`) and update procedure.
- `docs/adr/0003-browser-use-integration-strategy.md` — option
  evaluation, mandatory privacy bypass table, selected approach.
- `CONTEXT.md` — corrected stale Playwright assumption, updated state.
- `logs/prompts/0005-*.md`, `logs/changes/0005-*.md`, this report.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `801df76`, confirmed before starting.
- **Upstream identification**: `git clone --depth 1
  https://github.com/browser-use/browser-use.git` into the session
  scratchpad (outside this repo) — first attempt timed out mid-clone
  (network/transfer, not a code issue), verified the partial clone was
  empty via `ls`, retried with the same shallow-clone command
  successfully. `git rev-parse HEAD` on the clone →
  `85ddbfedf609166b2d2c76c3d80506649fee82a9`. Not "latest" — an exact,
  recorded SHA.
- **License**: read `LICENSE` directly — MIT, Gregor Zunic, 2024.
- **Dependencies**: read `pyproject.toml` directly —
  `requires-python>=3.11,<4.0`, `cdp-use==1.4.5` (confirms CDP, not
  Playwright — this corrects an assumption previously left open in
  `CONTEXT.md`), `posthog==7.7.0` (default telemetry).
- **Architecture**: read `agent/service.py`, `browser/chrome.py`,
  `screenshots/service.py`, `tools/service.py`, `dom/service.py`,
  `llm/messages.py` directly (module listing via `ls`, not inferred from
  names — confirmed with actual content reads for the privacy-critical
  paths).
- **Extension compatibility**: confirmed via direct evidence, not
  assumption — `browser/chrome.py` locates/launches a Chrome/Chromium
  **executable** via `subprocess`; the package depends on `psutil`,
  `screeninfo`, `pyobjc` (OS-level runtime dependencies incompatible with
  a browser extension sandbox). This is what makes the extension-
  incompatibility claim evidence-based rather than an assumption.
- **Privacy bypass analysis**: traced the screenshot path end-to-end —
  `grep`-located every file referencing `image_url`/`screenshot_b64`,
  confirmed `screenshots/service.py` is pure storage (base64 encode/
  decode, no filtering) and that per-provider `llm/*/serializer.py`
  files are what actually construct the image content sent to each LLM.
  Confirmed the `extract` tool (`tools/service.py` line ~1059) sends raw
  page markdown to a `page_extraction_llm` parameter with no
  sanitization step in between.
- **No browser-use code was executed** (`Agent.run()` was never
  invoked in this session) and **no browser-use code was copied into
  Ozer** — the clone lives only in the session scratchpad, outside this
  repository, and nothing from it was pasted or vendored into any Ozer
  file. Recorded explicitly as an open risk in ADR 0003 (source-reading
  evidence, not execution evidence).

## Tests
None (architecture research/decision phase, no implementation).

## Metrics
Not applicable.

## Evidence
See "Verification" above for exact commands/results; full detail in the
three new/updated docs listed under "Changes."

## Failures
- First `git clone` attempt (non-shallow) timed out after 2 minutes with
  an empty partial directory left behind. Root cause: likely network
  transfer time for the full history of an actively-developed repo, not
  a code defect. Fixed by cleaning the empty partial clone and retrying
  with `--depth 1` (shallow clone), which succeeded. No lasting effect on
  the repository — the clone lives entirely in the session scratchpad,
  never touched Ozer's git state.

## Remaining Work
1. Whether to use browser-use's own `Agent` LLM reasoning loop, or only
   its execution/DOM layers under an Ozer-authored reasoning contract —
   explicitly deferred to a future server-reasoning design phase, not
   blocking.
2. An actual hands-on smoke test of browser-use (installing it, running
   `Agent.run()` against a controlled fixture with `use_vision=False`
   and `extract` excluded) has not been performed — this phase was
   source-inspection only. Recommended before Phase 5 (reproducible
   running baseline) treats any of these behavioral claims as
   operationally confirmed.
3. Per user instruction: stop here. Do not proceed to Graphify
   installation or Phase 5 without further direction.

## Final Status
VERIFIED (as a research/decision phase). The exact upstream source and
commit are identified and pinned, the relevant architecture was
inspected directly from source, the screenshot/`extract` privacy-bypass
paths were explicitly traced and graded, extension incompatibility is
evidence-based (subprocess/OS-dependency evidence, not assumption), all
five integration options were compared against explicit criteria, one
strategy (Option D, adapter/companion) was explicitly selected with full
ownership/data-flow/privacy-gate-placement statements, no production
Ozer code was added, and all documentation is ready to commit and push
with independent post-push verification to follow.
