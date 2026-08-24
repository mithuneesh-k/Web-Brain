# Agent Workflow — Canonical Instruction Hierarchy

## Status: PARTIALLY_VERIFIED

Verified: the canonical instruction hierarchy exists, is discoverable, was
actually followed by an agent in this session, and the Matt Pocock skill
package is now genuinely installed (via its own official installer, with
hash-pinned evidence in `skills-lock.json`) rather than fabricated. Not
verified: live skill invocation from a fresh session, and any non-Claude-
Code harness — both require an environment/session this report cannot
create for itself. See
[`docs/research/matt-pocock-skills.md`](../research/matt-pocock-skills.md)
for the full evidence and exactly what remains open.

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

**Now installed**, via the package's own official installer:
`npx skills@latest add mattpocock/skills` (installer CLI `1.5.23`, exit
code `0`). Source: `mattpocock/skills` on GitHub. All 14 workflows named
in the bootstrap contract are present, plus 22 more that ship as part of
the same package. Full evidence, the version-pin mechanism actually
provided (`skills-lock.json`, content-hash based — no commit SHA is
exposed by the installer), and the honest limits of what could be tested
from inside a single running session are documented in
[`docs/research/matt-pocock-skills.md`](../research/matt-pocock-skills.md).

Earlier in this same effort, before the real source was supplied, this
layer was correctly marked `UNVERIFIED`/`BLOCKED` rather than guessed at —
that historical record is preserved in
`docs/research/matt-pocock-skills.md` and in `logs/reports/0002-*.md`, not
deleted, since it was accurate at the time.

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
