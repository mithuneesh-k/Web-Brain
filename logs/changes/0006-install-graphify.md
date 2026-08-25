# Change Record

## Change ID
0006-install-graphify

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Note on numbering
Requested as `0004-install-graphify.md`, but `logs/changes/0004-*.md` is
already used by `0004-graphify-research.md` (Phase 3). Numbered `0006`
instead to continue this repo's existing sequential convention without
colliding with or overwriting a prior record.

## Originating spec/issue
Implementation of the Phase 3 decision
(`docs/adr/0002-graphify-as-index-not-source-of-truth.md`): install and
validate Graphify, following the VERIFIED Phase 4 baseline (commit
`7ee6207`).

## Files changed
- `.graphifyignore` (new — created before any extraction, per hard
  precondition in ADR 0002)
- `CLAUDE.md` (modified — `## graphify` section appended by
  `graphify claude install`, below the pre-existing "add notes here"
  marker)
- `.claude/settings.json` (new — `PreToolUse` hook from
  `graphify claude install`, local-only conditional, inspected)
- `docs/research/graphify.md` (updated — full installation/runtime
  evidence section)
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` (updated —
  correction noting real implementation gaps vs. original assumptions)
- `docs/architecture/graphify-integration.md` (new)
- `logs/prompts/0006-install-graphify.md` (new)
- `logs/reports/0006-graphify-installation-validation.md` (new — see
  below)

## Reason
Close the gap between the Phase 3 research/decision and an actually
installed, runtime-tested integration, per explicit user instruction to
proceed with installation now that the architecture decision (index-only,
never source of truth, `logs/` excluded) was already made.

## Tests added / run / result
- Deterministic `.graphifyignore` exclusion test (isolated scratchpad
  directory, not committed to this repo): PASSED — excluded symbol
  absent from graph, allowed symbol present and exactly retrieved.
- `graphify update .` against the real Ozer repo: PASSED as a
  verified-local, no-op result (`No code files found` — correct, since
  Ozer has no source code yet).
- Live in-session skill invocation test: performed, result documented
  honestly as currently unavailable (session-lifecycle limitation, not a
  defect) — see prompt log and research doc.

## Known impact
- `/graphify` skill is now available **globally** on this machine (not
  repo-scoped — a real limitation of the installed version, documented).
- This repo now has a `.claude/settings.json` `PreToolUse` hook that
  nudges toward `graphify query` once a graph exists — currently inert,
  since no `graphify-out/graph.json` exists in this repo.
- No canonical file (`AGENTS.md`, source code, specs, ADRs other than
  0002's own update) was modified by graphify itself — confirmed via
  `git status`/`git diff` review before staging.

## Unresolved concerns
- Markdown indexing (the actual approved allowlist) not yet performed —
  requires a fresh Claude Code session, deferred.
- Codex compatibility untested — `graphify codex install` deliberately
  not run, to avoid modifying canonical `AGENTS.md` for an
  integration that can't be verified in this session.
- A pre-existing, unrelated `GROQ_API_KEY` was found in the shell
  environment during this task — not caused by this session, not written
  to any file here, flagged directly to the user in-conversation instead
  of in a committed document.
- No secrets, temporary test artifacts, or generated `graphify-out/`
  data were committed — reviewed `git status`/`git diff --cached` before
  staging; the deterministic test ran entirely in the session scratchpad,
  outside this repository, and was not copied in.
