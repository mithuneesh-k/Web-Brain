# Prompt 0005

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0004.

## User Request
Proceed to Phase 4 only: determine exactly how Ozer should incorporate
browser-use. Inspect the actual official upstream repository (exact
commit SHA, not "latest"), document real architecture from source (not
inferred from names), determine extension compatibility with evidence,
run a mandatory privacy-bypass analysis tracing every path browser-use
may use to capture/send screenshots or page state, evaluate fork/vendor/
dependency/adapter/reimplementation options against explicit criteria,
select one explicit strategy (no vague "use where appropriate"), state
exactly what Ozer owns vs. what browser-use owns, where data crosses,
where the privacy gate sits, and whether raw screenshots can ever enter
browser-use. Pin the commit in `docs/architecture/upstream.md`. Write
`docs/research/browser-use.md`, an ADR, a Phase 4 report, prompt/change
logs. Do not implement anything yet, do not copy upstream code into
Ozer, do not proceed to Phase 5 automatically. Commit, push, verify sync.

The user separately noted they would not yet treat Graphify's "100%
local / Claude Code compatible" claims as verified runtime facts (since
those came from supplied README material, not independent testing),
accepting Phase 3's PARTIALLY_VERIFIED status as-is rather than upgrading
it — no action needed from this agent on that point, noted for context
only.

## Relevant Context
- `CONTEXT.md` (privacy architecture constraint, open question re:
  browser-use vendor/depend/fork/adapter decision)
- `logs/reports/0004-graphify-research.md` (established evidence
  standard: primary sources, explicit RECOMMENDED/NOT/INSUFFICIENT
  gates)
- Commit `801df76` (prior verified baseline)

## Intended Outcome
A source-evidenced, explicit integration decision that correctly
identifies whether browser-use can run inside a browser extension, and
exactly where Ozer's privacy gate must sit relative to it.

## Result
Cloned browser-use (`https://github.com/browser-use/browser-use`) via
shallow clone into the session scratchpad (outside the Ozer repo),
inspected source directly. Confirmed at commit
`85ddbfedf609166b2d2c76c3d80506649fee82a9` (2026-08-19, package
`0.13.8`, MIT license): it drives a real Chrome/Chromium process over
CDP (`cdp-use`, no Playwright dependency — correcting a prior
`CONTEXT.md` open-question assumption), making it structurally
incompatible with running inside a browser extension. Traced the
screenshot path (`screenshots/service.py` → `llm/*/serializer.py`) and
the `extract` tool and confirmed both send raw content to an LLM with no
sanitization by default. Selected **Option D (adapter/companion
architecture)**: browser-use as a pinned dependency of a separate local
process, invoked only downstream of Ozer's own privacy gate, never given
raw screenshots. Wrote the full privacy-bypass table (8 paths, each
graded SAFE/REQUIRES WRAPPING/REQUIRES MODIFICATION/NOT REUSABLE).
Corrected `CONTEXT.md`'s stale Playwright assumption and browser-use
open question now that evidence exists.

## Evidence
- `git clone --depth 1 https://github.com/browser-use/browser-use.git`
  into scratchpad, `git rev-parse HEAD` → `85ddbfedf609166b2d2c76c3d80506649fee82a9`
- Direct source inspection: `agent/service.py`, `screenshots/service.py`,
  `browser/chrome.py`, `tools/service.py`, `llm/messages.py`,
  `pyproject.toml`, `LICENSE`, `telemetry/service.py`
- New/updated files: `docs/research/browser-use.md`,
  `docs/architecture/upstream.md`,
  `docs/adr/0003-browser-use-integration-strategy.md`, `CONTEXT.md`
  (open-questions correction)

## Open Issues
- No hands-on execution of browser-use (`Agent.run()`) was performed —
  source-reading only. Flagged as an open risk in ADR 0003, to be
  validated with an actual smoke test in a future reproducible-baseline
  phase.
- Whether Ozer uses browser-use's own `Agent` LLM loop vs. only its
  execution/DOM layers is explicitly left open (affects a later
  server-reasoning design phase, not this upstream-boundary decision).
- No secrets in any new file — all plain analysis/decision Markdown,
  reviewed before staging; no upstream browser-use code was copied into
  the repository.
