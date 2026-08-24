# Graphify Integration Architecture

## Status: PARTIALLY_VERIFIED

Installed and locally-runtime-tested; full evidence in
[`docs/research/graphify.md`](../research/graphify.md) ("Installation and
Runtime Evidence") and [ADR 0002](../adr/0002-graphify-as-index-not-source-of-truth.md)
("Update"). This document describes the resulting architecture.

## Flow

```
CANONICAL SOURCES
  git history + AGENTS.md + CLAUDE.md + CONTEXT.md + docs/ + code
        |
        v
  graphify update <path>            <-- code files only, local, no LLM,
        |                               genuinely tested this session
        v                          .graphifyignore filters logs/, .scratch/,
  graphify-out/graph.json               secrets, credentials, raw media
  graphify-out/graph.html
  graphify-out/GRAPH_REPORT.md
        |
        v
  graphify query / path / explain   <-- CLI, local, reads graph.json only
        |
        v
  Agent retrieval (Claude Code / future Codex / generic harness)
```

A second, **not-yet-exercised** path exists for non-code content
(Markdown/docs/PDFs/images): the in-session `/graphify` skill, which uses
whatever LLM the invoking IDE session already runs. That path is
documented here for completeness but was not run in this installation
session — see "Indexing Scope" below.

## Installation architecture

- **Package:** `graphifyy` (PyPI), installed via `uv tool install
  graphifyy` — isolates the tool in its own environment, per the
  project's own recommendation.
- **Installed version:** `0.4.20` (materially behind the `0.9.48` latest
  available at install time — see `docs/research/graphify.md` for the
  resulting feature gap).
- **Skill registration:** `graphify install` registered the `/graphify`
  skill **globally** on this machine (`~/.claude/skills/graphify/`), not
  scoped to this repository — this version has no `--project` flag.
  `graphify claude install` additionally wrote the repo-scoped "always
  use the graph" wiring (`CLAUDE.md` section, `.claude/settings.json`
  `PreToolUse` hook).

## Storage location

`graphify-out/` at the repository root, once actually populated (not yet
populated in Ozer — no source code exists yet, so `graphify update .`
against this repo currently produces "No code files found," which is
itself a correct, verified-local result).

## Indexing scope

**Currently indexed: nothing.** Ozer has no source code, and the
installed CLI's only genuinely local/no-LLM path (`graphify update`)
only handles code files.

**Planned allowlist, once meaningful:**
- Code, once it exists (via `graphify update .`, local, no LLM).
- `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/architecture/`,
  `docs/adr/`, `docs/research/`, `docs/specs/` — **only** via the
  in-session `/graphify` skill (LLM-backed, uses the invoking session's
  own model, no separate API key inside Claude Code). This has **not
  been run yet** — it requires a fresh session that can discover the
  newly-installed skill (this session cannot, per the Cross-Agent Testing
  evidence in `docs/research/graphify.md`).

**Explicitly and permanently excluded** (enforced by
[`.graphifyignore`](../../.graphifyignore) at repo root, confirmed
effective by direct test — see `docs/research/graphify.md`):
`logs/` (all of it, including `logs/prompts/`), `.scratch/`, `.env`/keys/
certs, credential/secret/token-shaped filenames, `node_modules/`,
`__pycache__/`, `.git/`, raw image/video file extensions, `downloads/`,
`recordings/`.

## Exclusion mechanism

`.graphifyignore`, gitignore-compatible syntax, merges with `.gitignore`
(only ever excludes more). Confirmed effective by a direct deterministic
test in an isolated directory: a marker symbol under an ignored path was
completely absent from the resulting graph, while a sibling marker
outside the ignored path was correctly indexed and retrieved.

## Retrieval flow

`graphify query "<question>"` / `graphify path A B` / `graphify explain
X` — all read-only against `graphify-out/graph.json`, no mutation of any
canonical source file. Confirmed by direct test (query returned the
exact indexed node/edges, nothing more).

## Stale-index handling

Not automatic in this installed version. `graphify update <path>`
re-extracts code files on demand; there is no watch-mode-by-default or
enforced "must be fresh before query" gate. Per ADR 0002: if the graph
ever disagrees with current code or Markdown, **the graph is wrong**,
full stop — regenerate via `graphify update`, never hand-edit
`graph.json`.

## Rebuild procedure

`graphify update .` from the repo root, once source code exists.
`graphify hook install` (not yet run in Ozer) would add post-commit/
post-checkout hooks to auto-rebuild — deferred until there is code worth
rebuilding on every commit.

## Failure fallback

Demonstrated by construction, not simulated: no `graphify-out/` exists in
this repo, and every phase of this project's work (Phases 0–4 plus this
installation task) has proceeded entirely on git + Markdown + code, with
zero functional dependency on graphify. If graphify is ever uninstalled,
broken, or its graph goes stale, nothing about Ozer's actual engineering
workflow changes — agents fall back to `Read`/`Grep`/`git`, exactly as
they've done throughout this project so far.

## Security boundaries

- The only genuinely local, tested-this-session capability
  (`graphify update`) never sends anything over the network — confirmed
  by direct test with no LLM provider keys configured (see
  `docs/research/graphify.md` for the important caveat: this is
  behavioral evidence, not packet-capture proof).
- `.graphifyignore` is the enforced technical boundary preventing
  `logs/` and credential-shaped paths from ever being considered for
  indexing by either path (code-only or skill-based) — the ignore file
  applies regardless of which extraction mechanism is used, since it's
  read by the underlying file-discovery step both paths share (per the
  README's own description of how `.gitignore`/`.graphifyignore` merging
  works, consistent with the direct exclusion test performed this
  session).
- The Markdown-indexing path (in-session `/graphify` skill) has **not
  been exercised**, so its actual network behavior against real Ozer
  content is genuinely unverified, not assumed safe. Before it is ever
  run against this repository's `docs/`/`AGENTS.md`/`CONTEXT.md`
  content, confirm in that future session that `.graphifyignore` is
  still respected by the skill-driven path specifically (the direct test
  performed this session only exercised the `graphify update` code path).
