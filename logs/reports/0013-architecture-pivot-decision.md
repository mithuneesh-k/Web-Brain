# Engineering Report

## Run
0013-architecture-pivot-decision

## Objective
Record the architecture pivot decided by the user after reviewing the
Phase 8A feasibility analysis: WebBrain becomes the browser-agent
foundation, Ozer becomes the local privacy layer, with the local gate as
PRIMARY protection and the OpenAI-compatible proxy as defense in depth.
Documentation and decision-recording only — no implementation, no code
imported.

## Starting Commit
`73e2077e8afea45f8ff439845c367682b7af4947`

## Changes
- `docs/adr/0005-webbrain-as-agent-ozer-as-privacy-layer.md` (new) — the
  pivot decision, evidence, alternatives, consequences, open risks.
- `docs/adr/0003-browser-use-integration-strategy.md` — status changed
  to SUPERSEDED IN PART, with an explicit split between what is
  superseded (browser-use as the execution engine) and what remains in
  force (the privacy-bypass principle, which carries over to WebBrain).
- `docs/specs/phase8a-webbrain-feasibility.md` — status changed to
  DECISION MADE, with the correction to its own recommendation recorded
  prominently rather than quietly.
- `CONTEXT.md` — current state and open questions brought up to date.
- This report.

## Verification
- Pre-work: `git status` clean, HEAD == `origin/main` == `73e2077`.
- **The decision corrects my own Phase 8A recommendation, and the
  correction is recorded, not buried.** Phase 8A recommended Option C
  (the proxy) as the *primary* privacy mechanism while simultaneously
  listing, in that same document's Option C weakness section,
  "configuration-dependent, not enforced — if a user points WebBrain
  straight at a cloud provider, Ozer is bypassed entirely." Recommending
  a bypassable mechanism as primary contradicted the SIH requirement to
  sanitize before *any* network request. The user caught this. ADR 0005
  makes the local gate primary and the proxy defense in depth, and both
  ADR 0005 and the Phase 8A spec header state the correction explicitly
  so a future reader doesn't follow the superseded recommendation.
- **ADR 0003 consistency handled rather than left stale.** ADR 0003 was
  an Accepted decision selecting browser-use as the execution engine —
  directly contradicted by ADR 0005. Rather than leaving two conflicting
  Accepted ADRs, 0003 is marked SUPERSEDED IN PART with a precise split
  of what carries over. browser-use was never installed or imported, so
  nothing needed unwinding.
- **CONTEXT.md was materially stale and is now corrected.** It still
  claimed "No privacy architecture has been implemented yet (Phase
  6/7)" — false, since Phases 6, 7, and 8 are complete and committed.
  It now records the completed privacy pipeline, the pivot, and the
  refreshed open questions.
- **Test suite re-verified healthy**: 63 JS tests (`node --test
  "extension/test/**/*.test.js"`) + 21 Python tests (`pytest`) = **84
  passing, 0 failing**. Note: `node --test extension/test/` (directory
  argument) fails on this Node version with a module-resolution error —
  a known invocation quirk first hit in Phase 5, not a test failure. The
  glob form is correct.
- **No WebBrain code imported, forked, modified, or added as a
  dependency.** The only WebBrain artifacts are the scratchpad clone
  (outside the repo) and quoted excerpts in `docs/research/webbrain.md`.

## Tests
84 total (63 JS + 21 Python), all passing. No test changes this run —
documentation and decision-recording only.

## Metrics
Unchanged. Detection remains 100% recall/precision on the 17-case
synthetic fixture set — restated in CONTEXT.md and ADR 0005 as a
deterministic self-check, explicitly **not** a real-world benchmark, to
stop that number being cited as more than it is.

## Failures
None.

## Remaining Work
1. **Distribution licensing (blocker).** WebBrain 33.0.0+ is
   GPL-3.0-or-later. The chosen separate-program architecture is the
   shape most likely to avoid derivative-work obligations, but that is a
   legal question and remains unresolved. Ozer also has no `LICENSE`
   file of its own.
2. **Design how the primary local gate attaches to an unmodified
   WebBrain.** ADR 0005 decided it is primary; the mechanism is
   undesigned, and if it requires modifying WebBrain it reopens (1).
   This is the next real design question.
3. Verify whether `webbrain-vl-2-450M-onnx` is independently invocable
   (Tier 3 reuse).
4. Proxy precondition test: Ozer's endpoint must advertise a
   vision-matching model identity or WebBrain strips screenshots before
   they arrive — a silent-failure mode that needs coverage.

## Final Status
VERIFIED (as a decision-recording run). The pivot is recorded as ADR
0005, the superseded ADR is marked rather than left contradicting it,
the feasibility spec's own incorrect recommendation is corrected in
place with the reasoning retained, CONTEXT.md is no longer stale, and
the full 84-test suite is confirmed green. No implementation was
performed and no WebBrain code entered the repository — consistent with
the instruction not to merge WebBrain before the licensing decision is
made.
