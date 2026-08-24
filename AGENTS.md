# Agent Instructions — Ozer

This file is the canonical entry point for **any** coding agent working in this
repository (Claude Code, Codex, Cursor, or otherwise).

Read, in order, before doing anything else:

1. [`CONTEXT.md`](./CONTEXT.md) — project vocabulary, architecture constraint,
   current state, open questions.
2. This file — engineering rules and workflow.
3. Relevant docs under `docs/specs/`, `docs/adr/`, `docs/architecture/` for the
   task at hand.

`CLAUDE.md` in this repo is a pointer to this same file — there is exactly one
set of engineering rules, not one per harness. Do not create harness-specific
forks of these instructions.

## Operating principles

- Specification-driven, test-driven, evidence-driven. No unsupported
  assumptions, no "should work," no silent architectural decisions.
- Every implementation claim needs evidence: source, test, command output,
  official doc, benchmark, or measured experiment. Missing evidence → say
  `UNVERIFIED`, don't infer-then-assert.
- Do not optimize for code volume. Optimize for: compliance with the problem
  statement → privacy guarantees → detection/redaction quality → client
  resource efficiency → latency → architectural correctness → maintainability.
- The privacy gate (see `CONTEXT.md`) is a security boundary. Never build a
  path where raw sensitive visual context could reach the network before
  redaction.

## Required workflow per feature

1. Check for an existing spec in `docs/specs/`; write one first if missing
   (template below).
2. TDD loop: RED (failing test) → GREEN (smallest passing change) → VERIFY
   (focused test, type check, lint, broader regression).
3. Record architectural decisions that affect boundaries as an ADR in
   `docs/adr/`.
4. Log the engineering interaction under `logs/prompts/`, `logs/changes/`,
   `logs/reports/` (see templates below). Redact secrets as `<REDACTED>`.
5. Commit with a message answering: what changed / why / how verified.

## Spec template (`docs/specs/<slug>.md`)

```
# Title
## Problem
## Evidence
## Goal
## Non-goals
## Constraints
## Architecture
## Interfaces
## Acceptance Criteria
## Test Plan
## Performance Targets
## Risks
## Open Questions
```

## ADR template (`docs/adr/NNNN-<slug>.md`)

Decision / Context / Evidence / Alternatives considered / Consequences /
Status / Date.

## Log templates

- `logs/prompts/<id>.md`: Timestamp, Agent, Session, User Request (secrets
  redacted), Relevant Context, Intended Outcome, Result, Evidence, Open Issues.
- `logs/changes/<id>.md`: change ID, timestamp, agent, branch, commit,
  originating spec/issue, files changed, reason, tests added/run/result,
  known impact, unresolved concerns.
- `logs/reports/<id>.md`: Run, Objective, Starting Commit, Changes,
  Verification, Tests, Metrics, Evidence, Failures, Remaining Work, Final
  Status (`VERIFIED` | `PARTIALLY_VERIFIED` | `BLOCKED` | `UNVERIFIED`).

## Git discipline

- Remote: `https://github.com/mithuneesh-k/Ozer`, canonical branch `main`.
- Flow: inspect → sync with remote → focused branch → spec → tests →
  implement → verify → review → commit → push → PR if applicable → verify
  remote SHA.
- No force-push, no rewriting published history, unless explicitly
  authorized. No unrelated changes bundled into a feature commit.
- If push/credentials are unavailable, report `BLOCKED` with the local commit
  SHA — never claim a push happened without verifying it remotely.

## Forbidden claims without evidence

"works", "fixed", "production ready", "secure", "private", "cross-browser",
"low latency", "accurate", "up to date", "synced" — use `VERIFIED` /
`PARTIALLY_VERIFIED` / `UNVERIFIED` / `BLOCKED` instead, with evidence.

## Upstream (browser-use) discipline

Track upstream repo, pinned revision, local modifications and why, and a
sync strategy in `docs/architecture/upstream.md`. Prefer extension/adapter
seams over rewriting upstream code. Preserve required license/attribution
notices.

## Memory

The repository (git + Markdown) is the durable memory system, not model
conversation memory or any external graph-memory augmentation layer. If a
graph-memory tool is later adopted, it is an index over this repo, never a
replacement source of truth — on conflict, Markdown + executable repo state
win.
