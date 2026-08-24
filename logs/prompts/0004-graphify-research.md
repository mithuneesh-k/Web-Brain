# Prompt 0004

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0003.

## User Request
Proceed to Phase 3 only: research and decide whether Graphify should be
integrated into Ozer as a persistent cross-agent memory/retrieval layer.
Identify the exact product (do not guess — multiple similarly-named
projects may exist), its official source, architecture, agent
compatibility, security/privacy implications, integration options, and
failure modes, using primary sources. Preserve git+Markdown as canonical
memory; Graphify (if used) is index/retrieval only, never source of
truth. Produce an explicit indexing exclusion policy — `logs/`
specifically must never be blindly indexed given it may contain pasted
secrets/PII. Reach one of RECOMMENDED / NOT RECOMMENDED / INSUFFICIENT
EVIDENCE, with full justification if RECOMMENDED. Update
`docs/research/graphify.md`, create an ADR if a decision is made, log
prompt/change/report, commit, push, verify sync. Stop — do not install
Graphify automatically, do not proceed to Phase 4.

The user then supplied the actual `graphify` project's README
(Graphify-Labs/graphify, PyPI package `graphifyy`) directly in the
conversation.

## Relevant Context
- `CONTEXT.md`, `AGENTS.md` (canonical memory principle already stated)
- `docs/research/graphify.md` (prior placeholder, marked UNVERIFIED —
  product identity unknown)
- `logs/reports/0003-install-matt-pocock-skills.md` (established pattern
  of installing real tooling from verified sources, not guessing)

## Intended Outcome
An evidence-based integration decision that keeps git+Markdown
authoritative and explicitly protects `logs/prompts/` and other sensitive
artifacts from being sent to a third-party LLM via graphify's semantic
extraction pass.

## Result
Identified the product precisely: `graphify` CLI by Graphify Labs
(PyPI `graphifyy`), distinct from the separately-advertised hosted
"graphify Enterprise" (`app.graphify.com`). Documented architecture
(local tree-sitter AST for code — no network; LLM-backed semantic pass
for docs/PDF/image — network, using IDE session or a configured key;
local faster-whisper for video/audio), agent compatibility per the
README's own claims (marked appropriately VERIFIED/PARTIALLY_VERIFIED/
UNVERIFIED based on what could and couldn't be cross-checked from inside
this session), and a full security/privacy analysis. Reached
**RECOMMENDED**, scoped to Option A (code-only, local, zero network
egress) now, Option B (Markdown indexing) deferred, Option C (full-repo
including logs/) and Option D (hosted Enterprise product) explicitly not
recommended. Wrote a mandatory `.graphifyignore` exclusion policy
(logs/, .scratch/, credential-shaped files) as a precondition for any
future actual installation — not yet performed in this phase.

## Evidence
- `docs/research/graphify.md` (full rewrite)
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` (new)
- Pre-work: `git status` clean, `git fetch origin` no new commits,
  local HEAD == origin/main == `f19080d` before starting

## Open Issues
- No actual installation/extraction was performed — this phase is
  research and decision only, per instruction.
- `.graphifyignore` file itself was documented as required but not yet
  created in the repo, since there's nothing to extract yet (no source
  code exists) — noted as a precondition for the next actual integration
  task, not deferred silently.
- Org-vs-personal-repo canonicity (`Graphify-Labs/graphify` vs.
  `safishamsi/graphify`) not resolved — noted as non-blocking.
