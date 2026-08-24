# Prompt 0006

## Timestamp
2026-08-24 (session-local)

## Agent
Claude Code (claude-sonnet-5)

## Session
Same session as 0001–0005.

## User Request
Implement the Phase 3 decision: install and validate the exact Graphify
implementation previously researched (not a new research phase). Use the
official documented installation mechanism — do not guess, do not
silently substitute another package. Create `.graphifyignore` before any
extraction, verified against the tool's actual (not assumed) ignore
syntax. Observe and document actual runtime network behavior rather than
trusting README claims — classify honestly as VERIFIED LOCAL /
PARTIALLY VERIFIED / UNVERIFIED / NETWORK EGRESS DETECTED. Initially
index only an approved allowlist (`AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`,
`docs/architecture/`, `docs/adr/`, `docs/research/`, `docs/specs/`,
approved source code) — explicitly not `logs/`. Perform an actual
end-to-end validation: index a known fact, retrieve it via a fresh
invocation, verify exclusions hold, verify canonical Markdown/source
files are never modified by graphify. Test cross-agent (Claude Code,
Codex) honestly. Document failure fallback. Update
`docs/research/graphify.md`, update the ADR if reality differs from the
Phase 3 assumptions, create `docs/architecture/graphify-integration.md`.
Do not touch Ozer implementation. Log prompt/change/report. Commit only
required files (config, ignore file, docs, evidence) — no secrets, no
temporary test artifacts, no large disposable generated data. Push,
verify sync.

## Relevant Context
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` (Phase 3
  decision: RECOMMENDED, Option A code-only-local now)
- `docs/research/graphify.md` (Phase 3 research, marked
  PARTIALLY_VERIFIED, install not yet performed)
- Commit `7ee6207` (prior verified baseline)

## Intended Outcome
A genuinely installed and runtime-tested Graphify integration, with
honest documentation of exactly what could and couldn't be validated in
this session — no fabricated "zero network egress" or "cross-agent
verified" claims without actual evidence.

## Result
Installed `graphifyy` via `uv tool install graphifyy` (the README's own
documented mechanism) — resolved version `0.4.20`, materially behind the
`0.9.48` latest on PyPI at install time, with a correspondingly narrower
feature set than the README describes (no `extract`/`--code-only`/MCP
server/`graphify prs` in this version). Created `.graphifyignore`
(excluding `logs/`, `.scratch/`, credential/secret-shaped files, raw
media, etc.) *before* running any extraction, and confirmed its
gitignore-compatible syntax works via a direct, deterministic test in an
isolated directory (excluded marker symbol absent from graph; allowed
marker symbol present and exactly retrievable via `graphify query`).
Discovered this installed version's only genuinely local/no-LLM path
(`graphify update`) is **code-file only** — cannot index Markdown at
all — so the originally planned "index a Markdown fact, retrieve it"
test was adapted to what this version can actually do (a code-symbol
index/exclude/retrieve test), performed, and passed. Confirmed
`graphify update .` against the real Ozer repo correctly reports "No
code files found" (Ozer has no source code yet) with no `graphify-out/`
created — a valid, verified-local result, not a failure. Registered the
`/graphify` skill (globally on this machine — this version has no
`--project` flag, another real difference from the README) and the
repo-scoped "always use the graph" wiring (`CLAUDE.md` section,
`.claude/settings.json` `PreToolUse` hook, inspected and confirmed
network-free). Tested live invocation directly in this session
(`Skill({skill: "graphify"})` → `Unknown skill: graphify`) — same
session-lifecycle limitation already documented for the Matt Pocock
skill install; genuinely UNVERIFIED for a fresh session, not assumed to
work. Codex: not touched (`graphify codex install` was not run, to avoid
modifying canonical `AGENTS.md` for an untestable integration) —
UNVERIFIED, documented as such.

## Evidence
- `uv tool install graphifyy` → success, `pip show graphifyy` → `0.4.20`
- `pip index versions graphifyy` → latest `0.9.48`
- `.graphifyignore` deterministic exclusion test (isolated scratchpad
  directory, not committed): excluded symbol → 0 matches in graph.json;
  allowed symbol → 1 match, retrieved exactly via `graphify query`
- `graphify update .` against real Ozer repo → `No code files found`,
  no `graphify-out/` created (confirmed via `ls`)
- `Skill({skill: "graphify"})` this session → `Unknown skill: graphify`
- `.claude/settings.json` hook content inspected directly — local shell
  conditional only, no network call
- New/updated: `.graphifyignore`, `CLAUDE.md` (graphify section
  appended), `.claude/settings.json`,
  `docs/research/graphify.md` (Installation and Runtime Evidence
  section), `docs/adr/0002-*.md` (Update section),
  `docs/architecture/graphify-integration.md`

## Open Issues
- Markdown-content indexing (the actual planned allowlist:
  `AGENTS.md`/`CONTEXT.md`/`docs/`) has not been performed — requires
  the in-session `/graphify` skill, which requires a fresh Claude Code
  session to discover, which this session cannot start.
- Codex compatibility genuinely untested — `graphify codex install` not
  run, to avoid modifying `AGENTS.md` for something unverifiable here.
- **A pre-existing, unrelated `GROQ_API_KEY` value was found already
  present in this shell's environment** while checking for LLM provider
  keys before the network-behavior test. Not set by graphify or this
  session's actions. The value itself was not written to any file, log,
  or committed artifact — flagged to the user directly in-conversation
  instead. Worth the user rotating/securing it as a precaution, since its
  presence in a general-purpose shell environment is a real exposure
  surface regardless of this session's actions.
