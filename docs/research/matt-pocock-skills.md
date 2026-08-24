# Research: Matt Pocock Skills / Cross-Agent Workflow

## Status: UNVERIFIED / BLOCKED

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
