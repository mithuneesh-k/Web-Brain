# Research: Matt Pocock Skills / Cross-Agent Workflow

## Status: PARTIALLY_VERIFIED — installed and evidenced; live in-session discovery not re-testable mid-session (see below)

## Update (post-install)

The actual source was supplied and installed via the skill package's own
official mechanism — not hand-recreated from the conversational
descriptions that were pasted earlier (those were aihero.dev documentation
*about* the skills, not the skill files themselves, and were explicitly
not used to author anything here).

- **Source**: `mattpocock/skills` on GitHub (`sourceType: "github"` per
  `skills-lock.json`)
- **Installer**: `npx skills@latest add mattpocock/skills`, installer CLI
  version `1.5.23` (`npx skills@latest --version`)
- **Install evidence**: exit code `0`; 36 skills discovered and installed;
  full raw installer output captured this session
- **Version pin**: `skills-lock.json` (repo root) — per-skill exact
  `skillPath` within the source repo and a `computedHash` of its content.
  This pins content, not a git commit SHA — the installer does not expose
  a commit SHA in its lock file or CLI output, so that specific claim is
  `UNVERIFIED` (the hash is the actual integrity mechanism it provides;
  recorded honestly rather than inferring a SHA that wasn't given).
- **Install layout**: real files under `.agents/skills/<name>/SKILL.md`
  (+ supporting files); `.claude/skills/<name>` are symlinks to those
  (confirmed via `ls -la`, e.g.
  `.claude/skills/ask-matt -> /c/Projects/Ozer/.agents/skills/ask-matt`).
  `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` were **not** touched by the
  installer (`git status` after install showed only new, untracked
  `.agents/`, `.claude/`, `skills-lock.json` — confirmed before staging).

## All 14 workflows named in the bootstrap contract — present

Verified by directory listing (`ls .agents/skills`), cross-checked one-for-one
against the bootstrap contract's list:

| Workflow | Present | SKILL.md path |
|---|---|---|
| setup-matt-pocock-skills | yes | `.agents/skills/setup-matt-pocock-skills/SKILL.md` |
| grill-with-docs | yes | `.agents/skills/grill-with-docs/SKILL.md` |
| to-spec | yes | `.agents/skills/to-spec/SKILL.md` |
| to-tickets | yes | `.agents/skills/to-tickets/SKILL.md` |
| implement | yes | `.agents/skills/implement/SKILL.md` |
| tdd | yes | `.agents/skills/tdd/SKILL.md` |
| code-review | yes | `.agents/skills/code-review/SKILL.md` |
| research | yes | `.agents/skills/research/SKILL.md` |
| diagnosing-bugs | yes | `.agents/skills/diagnosing-bugs/SKILL.md` |
| codebase-design | yes | `.agents/skills/codebase-design/SKILL.md` |
| domain-modeling | yes | `.agents/skills/domain-modeling/SKILL.md` |
| writing-for-agents | yes | `.agents/skills/writing-for-agents/SKILL.md` |
| handoff | yes | `.agents/skills/handoff/SKILL.md` |
| wayfinder | yes | `.agents/skills/wayfinder/SKILL.md` |

22 additional skills also installed as part of the `mattpocock/skills`
package (`ask-matt`, `grilling`, `grill-me`, `prototype`, `triage`, `tdd`,
`wizard`, `teach`, and others) — the package installs as a set, not
individually selectable per the bootstrap contract's list. Not a problem
per se, just recorded honestly as more than the 14 originally named.

## Discovery/invocation — what's actually verified vs. not

- **File-level discovery**: VERIFIED. `.claude/skills/<name>` symlinks
  exist and resolve to real `SKILL.md` files (spot-checked
  `to-spec/SKILL.md` — frontmatter confirms `name: to-spec`,
  `disable-model-invocation: true`, matching the documented behavior that
  these skills are invoked by explicit slash command, not model-initiated).
- **Live invocation in *this* session**: tested directly — calling the
  `Skill` tool with `to-spec` returned `Unknown skill: to-spec`. This
  confirms, rather than assumes, that Claude Code's skill registry for a
  running session is snapshotted at session start and does not pick up
  skills installed mid-session. This is expected harness behavior, not an
  installation failure — the files are correctly in place. **A fresh
  Claude Code session started in this repo after this point should
  discover them; that specific claim remains UNVERIFIED because it
  requires a session this one cannot start.**
- **Codex**: UNVERIFIED — no Codex environment available in this session.
  The installer's own output listed Codex among the agents it installed
  to (`.agents/skills` is the "universal" layout it symlinks into
  agent-specific locations for), which is evidence the package *targets*
  Codex, not evidence that Codex actually discovers/invokes it.

## Shared-instruction-layer boundary (unchanged, verified again post-install)

`AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` remain the single canonical
instruction set and were not modified or duplicated by this install — see
"Install layout" above. The skill layer is additive tooling on top of
that, consistent with the governing principle already stated below.

---

## Original status before install: UNVERIFIED / BLOCKED

## What was claimed (conversation only, not yet independent evidence)

The bootstrap contract references a "Matt Pocock" skill/workflow setup
supporting Claude Code, Codex, and other harnesses, with shared
`AGENTS.md`/`CLAUDE.md` behavior, a `CONTEXT.md` convention, and named
workflows: `setup-matt-pocock-skills`, `grill-with-docs`, `to-spec`,
`to-tickets`, `implement`, `tdd`, `code-review`, `research`,
`diagnosing-bugs`, `codebase-design`, `domain-modeling`,
`writing-for-agents`, `handoff`, `wayfinder`. A package version `1.2.3` was
mentioned.

None of this has been confirmed against an actual source in this session.

## What was checked (this session)

- Repository contents: no skill files, no `.claude/` directory, nothing
  matching `*matt*` or `*pocock*`.
- This Claude Code session's own available-skills list (queried via the
  `Skill` tool's system listing): contains unrelated built-in/anthropic
  skills (`code-review`, `simplify`, `tdd`-adjacent none, `init`,
  `security-review`, various `anthropic-skills:*`, etc.) but **none of the
  Matt Pocock workflow names above**. Note: this session's `code-review`
  skill is a distinct, pre-existing Claude Code feature, unrelated to the
  Matt Pocock set despite the name overlap with the requested
  `code-review` workflow — do not treat its presence as evidence the Matt
  Pocock set is installed.
- No `AGENTS.md`/`CLAUDE.md` content from this repo references an actual
  install source (npm package name, GitHub repo, or CLI installer) for
  these skills, because none has been supplied yet.

## What's missing to move this from UNVERIFIED to VERIFIED

Exactly one of the following, from the user, as a real artifact (not a
description):
1. A GitHub URL to the actual Matt Pocock skills repository, or
2. An npm package name/version to install, or
3. The actual skill definition files, supplied directly.

Once supplied, this document should record:
- exact source (URL/package) and pinned version or commit
- installation mechanism (e.g. `npx <installer>`, manual file copy into
  `.claude/skills/`, etc.)
- for each named workflow: confirmed discoverable and invocable in Claude
  Code (tested via the `Skill` tool in a live session) — yes/no with
  evidence
- for Codex and any other harness: whether it was actually tested, or
  explicitly marked `UNVERIFIED — no environment available`
- update/versioning procedure

## Governing principle (unchanged, already decided)

Even once installed, the skill layer is a workflow convenience on top of
the canonical instructions in `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md`, which
already work independently of it (see
`docs/architecture/agent-workflow.md`). The skill layer must not become a
second, divergent source of engineering rules — if a skill's own
instructions conflict with `AGENTS.md`, `AGENTS.md` wins, and the conflict
is recorded, not silently resolved.
