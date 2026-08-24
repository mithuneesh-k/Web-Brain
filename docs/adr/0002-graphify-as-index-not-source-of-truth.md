# ADR 0002: Graphify as an optional index layer, never a source of truth

## Status
Accepted (research/decision only — no installation performed in this
phase)

## Date
2026-08-24

## Decision
If/when integrated, `graphify` (Graphify Labs' local-first knowledge-graph
CLI, PyPI package `graphifyy`) is used **only** as a regenerable retrieval
index over Ozer's existing canonical sources (git history + Markdown +
code). It is never treated as authoritative, never manually edited, and
never allowed to index `logs/` (especially `logs/prompts/`), `.scratch/`,
credentials, or unsanitized fixtures/screenshots. Scope starts at
**Option A — code-only, local-only extraction** (see
`docs/research/graphify.md`); broader Markdown indexing (Option B) is
deferred; the separate hosted "graphify Enterprise" product
(`app.graphify.com`) is explicitly out of scope.

## Context
The user's stated goal is a shared, cross-agent memory system for Ozer.
The repository already establishes git + Markdown as canonical memory
(`CONTEXT.md`, `AGENTS.md`, ADRs, specs, logs). The risk being guarded
against is a second, divergent source of truth: an agent trusting a stale
or wrong graph over the actual current code/Markdown, or — specific to
this project — sensitive content in engineering logs being sent to a
third-party LLM API during graph extraction, which would be a real
privacy failure in the tooling layer of a project whose entire product
purpose is preventing exactly that kind of leak on the client side.

## Evidence
See `docs/research/graphify.md` for full detail. Key facts:
- Code indexing is local-only (tree-sitter AST), no network call, no API
  key.
- Docs/PDF/image indexing requires an LLM call (IDE session or configured
  API key) — this is the risk surface.
- Output is three local files (`graphify-out/graph.json` +
  `graph.html` + `GRAPH_REPORT.md`), meant to be committed to git,
  regenerable, git-mergeable via a provided merge driver.
- `.gitignore`/`.graphifyignore` are the only technical exclusion
  mechanism; there is no automatic sensitive-data redaction.
- No installation or extraction was actually run in this session — this
  is a research/decision ADR, not an implementation record.

## Alternatives considered
1. **Full-repo indexing including `logs/` from day one.** Rejected —
   `logs/prompts/` explicitly captures engineering conversation content
   with only human/agent redaction discipline (`<REDACTED>`) behind it,
   no technical guarantee. Sending that to a third-party LLM by default
   would be an unforced privacy risk in a project whose whole point is
   avoiding exactly that class of mistake.
2. **graphify Enterprise (hosted, always-on).** Rejected for now — a
   separate, still-early-access cloud product from the same vendor;
   continuous context upload to a third party is a materially different
   risk profile than a local, on-demand CLI, and wasn't asked for.
3. **No indexing tool at all, rely purely on grep/Read.** Not rejected,
   just not chosen yet — Option A costs nothing (no network, no
   credential) and provides real value once Ozer has actual source code
   to index; there's no current downside to allowing it, only to scoping
   it wrong.

## Consequences
- A `.graphifyignore` excluding `logs/`, `.scratch/`, and credential-
  shaped files must exist **before** `graphify extract` is ever run in
  this repo — this is a precondition for any future integration work, not
  optional cleanup.
- `graphify-out/graph.json` is git-committed once populated; if it ever
  contradicts current code or Markdown, the graph is wrong and must be
  regenerated — never hand-edited to "fix" a disagreement.
- No credentials or new dependencies are introduced by Option A. Option B,
  if pursued later, still introduces no new credential inside Claude Code
  (piggybacks on the IDE session's model) but would introduce one for
  headless/CI extraction if ever automated that way — revisit then.
- This ADR does not authorize installation. A future task that actually
  runs `graphify install`/`graphify extract` should reference this ADR
  and confirm the `.graphifyignore` precondition before doing anything
  else.

## Update (2026-08-24): installation completed, real implementation differs from assumptions above

Graphify was installed in a follow-up session (`uv tool install graphifyy`,
version `0.4.20` — well behind the `0.9.48` latest on PyPI at install
time). Full evidence in `docs/research/graphify.md`'s "Installation and
Runtime Evidence" section and `docs/architecture/graphify-integration.md`.
Two assumptions in this ADR's original text did not hold at the version
that actually installed, and are corrected here rather than silently:

1. **There is no `graphify extract`/`--code-only` command in this
   version.** The genuinely local, no-LLM path is `graphify update
   <path>`, and it is **code-file only** — it cannot index Markdown at
   all. Since Ozer currently has no source code, this path currently has
   nothing to do (`No code files found`), which is itself a valid,
   verified-local result, not a failure.
2. **Skill installation is global on this machine, not project-scoped**
   (`graphify install` has no `--project` flag in this version, unlike
   the README). Only the "always use the graph" wiring
   (`graphify claude install` → `CLAUDE.md` section + `.claude/settings.json`
   hook) is genuinely repo-scoped.

The core decision in this ADR is **unchanged**: graphify remains
index-only, git+Markdown remain canonical, `logs/` remains excluded. What
changed is *how* Option A is actually achievable with the installed
version — indexing Markdown (`AGENTS.md`, `CONTEXT.md`, `docs/`) requires
the in-session `/graphify` skill (an LLM-backed pass using the invoking
IDE session's own model), not a separate headless local command, since
this version has no such command. That specific step was not performed
in the installation session — it requires a fresh Claude Code session to
even discover the newly-installed skill (see
`docs/research/graphify.md`, "Cross-Agent Testing").
