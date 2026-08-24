# Agent Entry Verification Exercise

## Problem
Prove that an agent entering this repository cold (no prior conversation
context) can discover the canonical instructions and project context, and
follow the spec workflow defined in `AGENTS.md`, without touching product
implementation code — infrastructure verification, not product work.

## Evidence
- `AGENTS.md` exists at repo root and names itself the canonical entry
  point, pointing to `CONTEXT.md` for vocabulary/state and to this spec
  template for feature work.
- `CLAUDE.md` exists and points to `AGENTS.md` rather than duplicating it.
- `CONTEXT.md` exists and states current project state, vocabulary, and
  open questions as of the last update.
- This file itself is the artifact produced by following the spec template
  defined in `AGENTS.md` → "Spec template" section.

## Goal
An agent (any harness) that reads `AGENTS.md` first should be able to:
1. locate `CONTEXT.md` and `CLAUDE.md`,
2. locate the spec/ADR/log template definitions,
3. produce a correctly-shaped spec file under `docs/specs/`
without additional instruction beyond what's in the repo.

## Non-goals
- Does not test the Matt Pocock skill layer (not installed — see
  `docs/research/matt-pocock-skills.md`).
- Does not modify or add Ozer product code (none exists yet).
- Does not test Codex or any harness other than Claude Code in this
  session, since no other harness was available to run live.

## Constraints
Must not touch implementation code (there is none). Must use only the
templates already defined in `AGENTS.md`.

## Architecture
N/A — infrastructure verification only.

## Interfaces
N/A.

## Acceptance Criteria
- This file exists, follows the exact section headings from the
  `AGENTS.md` spec template.
- `docs/architecture/agent-workflow.md` references this file as its
  verification evidence.
- The exercise is reproducible by a future agent: read `AGENTS.md` →
  `CONTEXT.md` → produce a spec matching this shape.

## Test Plan
No automated test — this is a documentation/process artifact, not code.
Manual re-verification: a future agent (or the next session) should be
able to locate this file's structure purely from `AGENTS.md`'s spec
template without being told where it is.

## Performance Targets
N/A.

## Risks
- If `AGENTS.md`'s spec template changes, this artifact should be
  regenerated to stay representative; it is not itself authoritative over
  the template in `AGENTS.md`.

## Open Questions
None — this exercise is self-contained.
