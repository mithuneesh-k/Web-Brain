# Engineering Report

## Run
0004-graphify-research

## Objective
Phase 3 only: identify the exact Graphify product with evidence, document
its architecture/privacy/agent-compatibility, reach an explicit
RECOMMENDED / NOT RECOMMENDED / INSUFFICIENT EVIDENCE decision, define a
mandatory indexing exclusion policy protecting `logs/`, and stop — no
installation, no Phase 4.

## Starting Commit
`f19080d7754abb27ce033be37f911e46a8d1bfca` (`main`, matched local and
`origin/main`).

## Changes
- `docs/research/graphify.md` — full identification, architecture,
  agent-compatibility table, security/privacy analysis, four integration
  options, recommendation, exclusion policy, open questions.
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` — records the
  decision and its boundaries.
- `logs/prompts/0004-graphify-research.md`,
  `logs/changes/0004-graphify-research.md`, this report.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new remote commits,
  local HEAD == `origin/main` == `f19080d`, confirmed before any writing.
- Product identification: the user supplied the actual `graphify` README
  (Graphify-Labs/graphify, PyPI `graphifyy`) directly. This is treated as
  primary-source evidence because of its internal specificity (exact
  package-name collision warning, exact CLI flags, exact env var names, a
  real CI/contributing section, dated troubleshooting notes referencing
  specific past bugs) — but it was **not independently fetched by this
  agent** (no `WebFetch` call made this session), and that distinction is
  recorded explicitly in the research doc rather than presented as
  independently confirmed.
- Distinguished the OSS local-first CLI tool from the separately
  advertised hosted "graphify Enterprise" (`app.graphify.com`) —
  important because the user's stated concern (a cloud memory service
  becoming the *only* place project knowledge exists) applies far more to
  the hosted product than to the local CLI, and conflating the two would
  have produced a wrong recommendation.
- Verified the concrete privacy-relevant architecture claims against
  internal consistency: code indexing is stated as local/no-network in
  three separate places in the README (feature bullet, file-type table,
  and the dedicated Privacy section), which agree with each other —
  treated as reasonably reliable. Docs/PDF/image indexing requiring an
  LLM call is likewise stated consistently across the same three places.
- Cross-checked the generic-agent-skill claim against something this
  session *can* verify directly: `graphify install --platform agents`
  targets `.agents/skills/` — the same directory structure the Matt
  Pocock skill installer used in this repo (`docs/adr/0001-*.md`),
  confirmed by this session's own prior install. That structural overlap
  is real, first-hand evidence, not just a README claim.
- No installation, extraction, or `graphify` CLI invocation was performed
  — correctly scoped as research/decision only per instruction.

## Tests
None (research and architecture-decision documents only).

## Metrics
Not applicable — no code was written or measured.

## Evidence
See "Verification" above. Full detail in
`docs/research/graphify.md` and `docs/adr/0002-*.md`.

## Failures
None.

## Remaining Work
1. If the team acts on the RECOMMENDED decision: create
   `.graphifyignore` (excluding `logs/`, `.scratch/`, credential-shaped
   files) **before** running `graphify install`/`graphify extract` for
   the first time — this is a hard precondition, not a nice-to-have.
2. Actual installation and live-testing of graphify's Claude Code/Codex
   integration claims (not done this phase, research only).
3. Per user instruction: stop here. Do not proceed to Phase 4
   (browser-use upstream strategy) without further direction.

## Final Status
VERIFIED (as a research/decision phase — no implementation claims are
made, so nothing here can be "partially" verified in the way
installation work can). The product is correctly identified with
evidence, its architecture and privacy implications are documented, an
explicit RECOMMENDED decision was reached with clear scope boundaries
(Option A now, B later, C/D rejected), the canonical git+Markdown
precedence is preserved and explicitly reaffirmed in ADR 0002, and a
concrete exclusion policy protecting `logs/` exists. What remains open —
live installation testing — is correctly out of scope for this phase, not
an unfinished verification.
