# Skill-Layer Entry Verification Exercise

## Problem
Prove that an agent entering this repository can discover `AGENTS.md`,
`CONTEXT.md`, and the installed Matt Pocock skill layer, and follow the
documented spec workflow — without modifying any Ozer implementation code
(none exists yet).

## Evidence
- `AGENTS.md` at repo root, `CONTEXT.md` for project state/vocabulary
  (both pre-date this exercise — see `logs/reports/0001-*.md`).
- `.claude/skills/to-spec -> .agents/skills/to-spec` (symlink, confirmed
  via `ls -la`), containing a real `SKILL.md` with frontmatter
  `name: to-spec`, `disable-model-invocation: true` — matching the
  documented behavior that this skill is invoked explicitly, not
  auto-triggered.
- This file itself: produced by following the same spec-template
  structure defined in `AGENTS.md`, the pattern `to-spec`'s own `SKILL.md`
  also uses (`<spec-template>` block with `Problem Statement`,
  `Solution`, etc. — see `.agents/skills/to-spec/SKILL.md`).

## Goal
Show that discovery of the skill layer is a file-existence fact any agent
can check (`ls .claude/skills` or `.agents/skills`), and that this
session, at least, correctly identified the difference between "files
exist on disk" and "this running session's tool registry includes them" —
recording both as distinct, separately-evidenced claims rather than
conflating them.

## Non-goals
- Does not test Codex or any non-Claude-Code harness.
- Does not test live invocation of `to-spec` (or any Matt Pocock skill)
  from a fresh session — that requires a session this one cannot start.
- Does not touch Ozer product code.

## Constraints
Documentation/process artifact only, per `AGENTS.md`'s own rules for this
kind of infrastructure work.

## Architecture
N/A.

## Interfaces
N/A.

## Acceptance Criteria
- This file exists and is discoverable purely by an agent that reads
  `AGENTS.md`'s spec template and looks under `docs/specs/`.
- `docs/research/matt-pocock-skills.md` and
  `docs/architecture/agent-workflow.md` both reference this file (or its
  sibling `docs/specs/agent-entry-verification.md`) as evidence.

## Test Plan
No automated test. Re-verification procedure for a future session: run
`ls .claude/skills` and confirm the 14 bootstrap-named skills are listed;
attempt `Skill({skill: "to-spec"})` (or equivalent) and record whether it
succeeds — if it does, that closes the "fresh session discovery" item
left open in `logs/reports/0003-install-matt-pocock-skills.md`.

## Performance Targets
N/A.

## Risks
None beyond the ones already recorded in ADR 0001.

## Open Questions
- Whether a genuinely fresh Claude Code session (not this one) discovers
  the installed skills live. Left explicitly open, not assumed.
