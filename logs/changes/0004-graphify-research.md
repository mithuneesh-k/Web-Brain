# Change Record

## Change ID
0004-graphify-research

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
Phase 3 of the bootstrap sequence: Graphify research and integration
decision, following the VERIFIED-at-file-level Matt Pocock skill install
(commit `f19080d`).

## Files changed
- `docs/research/graphify.md` (full rewrite — product identification,
  architecture, agent compatibility, privacy analysis, integration
  options, recommendation, exclusion policy)
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` (new)
- `logs/prompts/0004-graphify-research.md` (new)
- `logs/reports/0004-graphify-research.md` (new — see below)

## Reason
Determine, with evidence, whether Graphify should become part of Ozer's
cross-agent memory architecture, without letting it displace git+Markdown
as the source of truth, and without creating a privacy hole in the
tooling layer of a project whose product purpose is preventing exactly
that class of leak.

## Tests added / run / result
None (research/documentation only — no code, no installation performed).

## Known impact
None on running systems — no installation occurred. Establishes the
integration boundary (Option A now, Option B later, Options C/D rejected)
and the mandatory `.graphifyignore` precondition that any future actual
`graphify install`/`graphify extract` task must satisfy before running.

## Unresolved concerns
- Actual installation/live testing of graphify's Claude Code/Codex
  integration claims not performed — deferred to a future task if the
  team decides to act on this RECOMMENDED decision.
- `.graphifyignore` not yet created (nothing to extract yet — no source
  code exists in this repo).
- No secrets in any new file (all plain Markdown analysis/decision
  documents, reviewed before staging).
