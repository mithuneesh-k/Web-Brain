# Agent Workflow — Canonical Instruction Hierarchy

## Status: PARTIALLY_VERIFIED

Verified: the canonical instruction hierarchy exists, is discoverable, and
was actually followed by an agent in this session. Not verified: the Matt
Pocock skill/workflow layer itself — see
[`docs/research/matt-pocock-skills.md`](../research/matt-pocock-skills.md)
for why, and what's needed to close that gap.

## Canonical instruction hierarchy (as implemented)

```
AGENTS.md   <- canonical cross-agent engineering rules (source of truth)
CLAUDE.md   <- thin pointer to AGENTS.md (Claude-specific notes only, if any)
CONTEXT.md  <- shared project/domain vocabulary and current state
```

This matches the structure specified in the bootstrap contract: one set of
rules in `AGENTS.md`, `CLAUDE.md` as a compatibility pointer rather than a
duplicate, `CONTEXT.md` kept separate from agent-behavior rules. No
deviation from the preferred structure was needed — recorded here per the
"any deviation must be documented" instruction, i.e. there is none to
document yet.

## Supported agents

| Agent | Instruction discovery | Status |
|---|---|---|
| Claude Code | Auto-loads `CLAUDE.md` from the working directory at session start (built-in harness behavior, not repo-specific config). `CLAUDE.md` in this repo points to `AGENTS.md`, which points to `CONTEXT.md`. | **VERIFIED** — see evidence below |
| OpenAI Codex | Reads `AGENTS.md` from the repository root by convention (per Codex/agents.md ecosystem convention). No Codex environment was available in this session to actually execute a Codex run against this repo. | **UNVERIFIED** — file exists and is positioned correctly, but no live Codex invocation was performed |
| Generic AGENTS.md-consuming harness | Any harness that reads `AGENTS.md` at repo root will find the same canonical rules Claude Code and Codex use. | **UNVERIFIED** — no such harness was available to test in this session |

## Evidence — Claude Code discovery (this session)

This session is itself a Claude Code instance operating in this repository.
Concretely, in this same session, the agent:

1. Cloned the repo, wrote `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md`.
2. In all subsequent turns, correctly followed the rules stated in
   `AGENTS.md` without being re-told them — e.g. asked for explicit
   permission before pushing to the shared remote, used
   `VERIFIED`/`BLOCKED` status vocabulary, independently verified the
   remote SHA after push rather than trusting the push command's exit
   code, and preserved (rather than deleted) a prior failed-push log entry.

This is real behavioral evidence of discovery + adherence, not merely "the
file exists." It does not, on its own, prove Claude Code has a *general*
auto-load mechanism for `CLAUDE.md` independent of this specific session's
instructions — that claim is a property of the Claude Code product, not
something this session can benchmark against a second, independent Claude
Code process. Treat "auto-loads CLAUDE.md" above as consistent with
observed behavior, not independently re-verified from a cold start here.

## Skill/workflow layer (Matt Pocock skills)

**Not installed in this repository or in this session's environment.**
Checked:
- `find . -iname "*matt*" -o -iname "*pocock*"` (excluding `.git`) → no
  results.
- `.claude/` directory → does not exist in this repo.
- This session's own list of invocable skills (via the `Skill` tool) does
  **not** include any of: `setup-matt-pocock-skills`, `grill-with-docs`,
  `to-spec`, `to-tickets`, `implement`, `tdd`, `diagnosing-bugs`,
  `codebase-design`, `domain-modeling`, `writing-for-agents`, `handoff`,
  `wayfinder`. (It does include an unrelated `code-review` skill, which is
  a different, pre-existing Claude Code skill — not part of the Matt
  Pocock set, and not to be confused with it.)

The Matt Pocock skills referenced in the bootstrap contract were described
conversationally (workflow names, general philosophy, version `1.2.3`
mentioned) but their actual source repository/package was never supplied
as files or a verifiable URL in this session. Per the no-assumption rule,
this is marked `UNVERIFIED`/`BLOCKED` rather than guessed at. See
`docs/research/matt-pocock-skills.md` for exactly what's missing to close
this out.

## Failure behavior

If an agent enters this repo and the skill/workflow layer is unavailable
(current state), it must:
- still find and follow `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` (these do not
  depend on the skill layer),
- fall back to the spec/ADR/log templates already defined in `AGENTS.md`
  rather than blocking entirely,
- explicitly mark any skill-dependent step as `UNVERIFIED` rather than
  simulate the workflow without the actual skill definitions.

## Update procedure

- Changes to canonical rules go in `AGENTS.md` only; `CLAUDE.md` is not
  edited to duplicate them.
- Once the Matt Pocock skill source is identified and supplied, add its
  install location and pinned version to
  `docs/research/matt-pocock-skills.md`, then re-run the verification
  exercise in the next section before marking this document `VERIFIED`.

## Minimal verification exercise (infrastructure only, no product code)

A test spec artifact was created at
[`docs/specs/agent-entry-verification.md`](../specs/agent-entry-verification.md)
to prove an agent can: discover the canonical instructions, discover
project context, follow the spec template from `AGENTS.md`, and produce an
artifact without touching implementation code (there is no implementation
code yet to touch). See that file for the artifact itself.
