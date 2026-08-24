# Prompt 0003

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001/0002.

## User Request
Do not proceed to Phase 3. Close the Matt Pocock skill source gap: the
user will provide the actual source. When available, inspect it before
installing, record exact source/version, determine the official
installation mechanism, install via that mechanism (not by manually
recreating skills from conversational descriptions), and verify per-
workflow discovery/invocation with real evidence (VERIFIED /
PARTIALLY_VERIFIED / BLOCKED per workflow). Preserve the historical
BLOCKED record at commit `db95c96` rather than rewriting it. Run a
non-production repo-entry verification exercise proving discovery of
AGENTS.md, CONTEXT.md, and the installed skill layer without touching
implementation code. Commit, push, independently verify sync. Stop after
the skill layer is installed and documented — do not proceed to Graphify,
browser-use, privacy implementation, or model selection.

The user then supplied: the install command
(`npx skills@latest add mattpocock/skills`) and, separately, a large body
of aihero.dev documentation describing each skill's behavior.

## Relevant Context
- `logs/reports/0002-agent-workflow-verification.md` (prior BLOCKED status
  for this exact gap)
- `docs/research/matt-pocock-skills.md`, `docs/architecture/agent-workflow.md`

## Intended Outcome
Genuine installation of the skill package, evidenced honestly — including
the limits of what a single running session can self-verify (e.g. live
skill discovery from a fresh session).

## Result
Recognized that the pasted aihero.dev documentation was prose *about* the
skills, not the installable package, and explicitly did not use it to
author any `SKILL.md` files. Ran the actual installer instead
(`npx skills@latest add mattpocock/skills`), which succeeded (exit `0`,
36 skills, all 14 bootstrap-named workflows present). Recorded the real
version-pin mechanism the tool provides (`skills-lock.json`, content
hashes — no commit SHA available, noted as a limitation rather than
inferred). Tested live invocation in this session directly (`Skill` tool
call for `to-spec`) and got `Unknown skill: to-spec`, confirming — not
assuming — that Claude Code's skill registry doesn't hot-reload mid-
session; recorded as an honest open item rather than glossed over.

## Evidence
- `npx skills@latest add mattpocock/skills` full output (293 lines,
  captured this session), exit code `0`
- `skills-lock.json` (repo root)
- `ls .agents/skills` → 36 directories
- `git status` post-install → only `.agents/`, `.claude/`,
  `skills-lock.json` untracked; `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md`
  unchanged
- Direct `Skill` tool call for `to-spec` → `Unknown skill: to-spec`
- New/updated files: `docs/research/matt-pocock-skills.md`,
  `docs/architecture/agent-workflow.md`,
  `docs/adr/0001-matt-pocock-skills-install-mechanism.md`

## Open Issues
- Live skill discovery from a *fresh* Claude Code session (started after
  this install) is not tested — this session cannot start another one.
- Codex/other-harness live testing still unavailable.
- No secrets in installed skill content — spot-checked several `SKILL.md`
  files, all plain instructional Markdown/YAML, no credentials.
