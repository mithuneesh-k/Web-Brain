# Change Record

## Change ID
0005-browser-use-upstream-strategy

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
Phase 4 of the bootstrap sequence: browser-use upstream integration
strategy, following the VERIFIED Phase 3 research/decision baseline
(commit `801df76`).

## Files changed
- `docs/research/browser-use.md` (new — upstream identity, architecture,
  dependencies, extension compatibility, reusable/non-reusable
  components, modification seams)
- `docs/architecture/upstream.md` (rewritten — exact commit pin,
  license, dependency findings, compatibility risks)
- `docs/adr/0003-browser-use-integration-strategy.md` (new — full option
  evaluation, privacy bypass analysis table, selected approach,
  ownership boundaries)
- `CONTEXT.md` (corrected stale Playwright assumption; updated current
  state and open questions to reflect Phases 2–4 outcomes)
- `logs/prompts/0005-browser-use-upstream-strategy.md` (new)
- `logs/reports/0005-browser-use-upstream-strategy.md` (new — see below)

## Reason
Determine, with source-level evidence rather than assumption, how
browser-use should be incorporated into Ozer without letting its default
screenshot/extraction behavior bypass Ozer's privacy gate, and without
assuming a Python automation framework can run inside a browser
extension.

## Tests added / run / result
None (research/architecture-decision documents only). No browser-use
code was executed (`Agent.run()` was never invoked) — source was read,
not run. This is recorded as an explicit open risk in ADR 0003, not
presented as a tested runtime fact.

## Known impact
No implementation impact — no browser-use dependency was added, no code
was copied into Ozer. Establishes the integration boundary (adapter/
companion architecture, Option D) that any future implementation work
must follow, and the mandatory privacy-bypass configuration checklist
(`use_vision=False` or externally-supplied images, `extract` action
excluded, `ANONYMIZED_TELEMETRY=false`, `use_cloud` never enabled) that
a future code reviewer should check against.

## Unresolved concerns
- Whether to use browser-use's own `Agent` LLM loop vs. only its
  execution/DOM layers — deferred to a later server-reasoning design
  phase.
- browser-use is actively developed; the pinned commit
  (`85ddbfedf609166b2d2c76c3d80506649fee82a9`) will drift from `main`
  quickly — `docs/architecture/upstream.md` documents the update
  procedure.
- No secrets in any new file; no upstream code copied into the
  repository (only inspected in a throwaway scratchpad clone outside
  Ozer).
