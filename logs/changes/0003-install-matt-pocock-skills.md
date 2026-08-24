# Change Record

## Change ID
0003-install-matt-pocock-skills

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Branch
main

## Originating spec/issue
Follow-up to `logs/reports/0002-agent-workflow-verification.md`
(BLOCKED: Matt Pocock skill source never supplied). User supplied the
real install command and closed the gap.

## Files changed
- `.agents/skills/**` (new — 36 skills, real content from
  `mattpocock/skills`)
- `.claude/skills/**` (new — symlinks into `.agents/skills/**`)
- `skills-lock.json` (new — installer-generated version/hash pin)
- `docs/research/matt-pocock-skills.md` (updated — install evidence)
- `docs/architecture/agent-workflow.md` (updated — status/evidence)
- `docs/adr/0001-matt-pocock-skills-install-mechanism.md` (new)
- `logs/prompts/0003-install-matt-pocock-skills.md` (new)
- `logs/reports/0003-install-matt-pocock-skills.md` (new — see below)

## Reason
Install the actual Matt Pocock skill package via its official mechanism,
closing the gap left BLOCKED in change 0002, without fabricating skill
content from the aihero.dev documentation that was pasted alongside the
real install command.

## Tests added / run / result
No automated tests (skill package installation + documentation). Manual
verification performed: installer exit code, file/symlink existence,
`skills-lock.json` content, direct `Skill` tool invocation test (returned
`Unknown skill: to-spec`, confirming session-lifecycle behavior rather
than an install defect).

## Known impact
Any future Claude Code session (and, per the installer's own agent
targeting, Codex/Cursor/etc. — untested here) started fresh in this repo
should have the 36 Matt Pocock skills available, including all 14 named
in the original bootstrap contract.

## Unresolved concerns
- Live discovery from a fresh session not tested (this session can't
  start one).
- Codex/other-harness live testing not available.
- `skills-lock.json` pins content hashes, not a source commit SHA (see
  ADR 0001 for why this is an accepted limitation of the tool, not an
  oversight here).
- Secret-scan performed over installed content before commit; all matches
  were benign generic tooling prose/code (e.g. a GitHub Actions secret-
  setting helper script with no actual credentials), not real
  credentials.
