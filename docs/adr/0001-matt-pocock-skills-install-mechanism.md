# ADR 0001: Install Matt Pocock skills via official installer, commit the result

## Status
Accepted

## Date
2026-08-24

## Decision
Install the Matt Pocock skill package using its own official mechanism —
`npx skills@latest add mattpocock/skills` — rather than hand-authoring
`SKILL.md` files from conversational descriptions of them. Commit the
resulting `.agents/skills/` (real files), `.claude/skills/` (symlinks into
the agent-specific location), and `skills-lock.json` (version/hash pin)
into the Ozer repository.

## Context
Earlier in this bootstrap effort, an agent was asked to verify Matt
Pocock skill compatibility but found no actual source had been supplied —
only prose descriptions and workflow names from the planning conversation.
It correctly refused to fabricate skill files from that prose and marked
the layer `BLOCKED`. The real source was subsequently supplied as the
install command above, plus (separately) extensive aihero.dev
documentation *about* the skills — the documentation is not the skill
package itself and was deliberately not used to author anything.

## Evidence
- `npx skills@latest add mattpocock/skills` → exit code `0`, 36 skills
  installed from `mattpocock/skills` (GitHub), installer CLI `1.5.23`.
- `skills-lock.json` records, per skill, its exact path in the source
  repo and a content hash — the actual integrity/version mechanism the
  installer provides.
- `git status` immediately after install showed only new, untracked
  `.agents/`, `.claude/`, `skills-lock.json` — `AGENTS.md`/`CLAUDE.md`/
  `CONTEXT.md` were not touched.
- Full details: `docs/research/matt-pocock-skills.md`.

## Alternatives considered
1. **Hand-author `SKILL.md` files from the pasted documentation.**
   Rejected — the documentation describes behavior in prose; reproducing
   it as skill files would be indistinguishable from hallucination and
   would drift from the real package immediately on any upstream update.
2. **Reference the skills without committing them (rely on each
   developer/agent running the installer themselves).** Rejected for now
   — committing gives every future agent session a reproducible,
   hash-verifiable baseline without depending on network access or the
   installer being available at exactly this version. Revisit if
   `.agents/skills/` content becomes large enough to be a real repo-size
   concern (currently modest: 36 skills, mostly short Markdown).

## Consequences
- Any future agent cloning this repo gets the skill layer for free, no
  install step required — but updates require deliberately re-running the
  installer and re-committing, not automatic sync.
- `skills-lock.json` pins content hashes, not a source commit SHA — if
  `mattpocock/skills` force-pushes or rewrites history upstream, this repo
  cannot prove which historical commit the content came from, only that
  the content matches a specific hash captured at install time. Acceptable
  given the installer doesn't expose a stronger guarantee.
- Live skill invocation was confirmed unavailable *within the session that
  performed the install* (Claude Code's skill registry is snapshotted at
  session start). This is a session-lifecycle fact, not a defect in the
  install — a new session should discover the skills normally, but that
  specific claim is left `UNVERIFIED` here rather than assumed.
