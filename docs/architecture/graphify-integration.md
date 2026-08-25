# Graphify Integration Architecture

## Status: VERIFIED (code-graphing role) — GRAPHIFY CODE INDEX ONLY

Installed, version-reconciled, and locally-runtime-tested across two
versions (`0.4.20` then `0.9.48`); full evidence in
[`docs/research/graphify.md`](../research/graphify.md) ("Installation and
Runtime Evidence" and "Closure and Version Reconciliation") and
[ADR 0002](../adr/0002-graphify-as-index-not-source-of-truth.md). This
document describes the final, decided architecture: **graphify's role in
Ozer is code-graph indexing only.** Markdown/spec/ADR/doc retrieval is
**direct reading**, not graphify — see "Why not Markdown too" below.

## Flow

```
                    OZER MEMORY

        +-----------------------------------+
        | Canonical Project Knowledge        |
        |                                     |
        | Git history                         |
        | AGENTS.md / CLAUDE.md / CONTEXT.md  |
        | docs/ (specs, ADRs, research, arch) |
        | Source code (once it exists)        |
        +------------------+------------------+
                           |
              +------------+------------+
              |                         |
              v                         v
       graphify (code only)      Direct reading/search
       extract --code-only       Read / Grep / git,
       -> graphify-out/graph.json  for everything else
       local, no LLM, no network  (docs, specs, ADRs,
       tested end-to-end          CONTEXT.md, logs)
              |
              v
       graphify query / path / explain
       (CLI, local, reads graph.json only)
              |
              v
       Agent retrieval (Claude Code, code-structure
       questions only, once a graph exists)
```

Graphify never becomes the retrieval path for Markdown/spec/ADR content.
Those remain direct-read, exactly as they have been throughout every
phase of this project. This is a deliberate narrowing from the broader
role assumed during Phase 3 research — see "Why not Markdown too" below.

## Why not Markdown too

Two things were tested and neither currently supports it:

1. **Headless `graphify extract` (full, not `--code-only`)** requires an
   LLM provider API key (Anthropic/OpenAI/Gemini/DeepSeek/Kimi/Ollama).
   None is configured in this environment, and deliberately not adding
   one just to run a validation test — every decision to send Ozer
   content to a third-party API deserves the same deliberateness as any
   other privacy-relevant choice in this project.
2. **The in-session `/graphify` skill** (uses the invoking IDE session's
   own model, no separate key) cannot be invoked in any session tested
   so far — confirmed directly (`Skill({skill: "graphify"})` →
   `Unknown skill: graphify`), both in the installing session and in a
   subagent spawned via the `Agent` tool. This is a session-lifecycle
   limitation (skill registries are snapshotted at session start), not
   proof the skill is broken — but until a genuinely fresh,
   independently-launched session confirms it works, it is not an active
   capability.

If a future session demonstrates the skill path working, this document
should be updated and the "Why not Markdown too" section revised — not
silently assumed to now work.

## Installation architecture

- **Package:** `graphifyy` (PyPI), installed via `uv tool install
  graphifyy`.
- **Installed version:** `0.9.48` — upgraded from an initial `0.4.20`
  after version reconciliation determined the original resolution was a
  transient anomaly (a 5-minute install vs. a reproducible <4-second
  install on retry), not a real compatibility constraint. Both versions
  are the same package lineage (same PyPI project, same upstream repo,
  same license). See `docs/research/graphify.md`, "Closure and Version
  Reconciliation," for the full evidence trail.
- **Skill registration:** `graphify install --project` (0.9.48; the
  `--project` flag works but is undocumented in this version's
  `--help`) registered the `/graphify` skill **project-scoped**:
  `.claude/skills/graphify/` — portable file content, no absolute paths,
  confirmed by direct inspection. A separate global install
  (`~/.claude/skills/graphify/`, this machine only, not part of this
  repo) was also refreshed to `0.9.48` for local consistency.
- **A reproducibility problem was found and fixed**: running the
  "always use the graph" wiring under 0.9.48 generated a
  `.claude/settings.json` `PreToolUse` hook with a **hardcoded,
  machine-specific absolute path**
  (`C:/Users/nitis/.local/bin/graphify.EXE`) — a portability regression
  from `0.4.20`'s relative-shell-conditional hook. **This was not
  committed.** `.claude/settings.json` remains the earlier, portable,
  version-agnostic hook. Any future session that re-runs
  `graphify install --project` or `graphify claude install` should
  inspect the resulting `.claude/settings.json` for absolute paths
  before committing it.

## Storage location

`graphify-out/` at the repository root, once populated. Not yet populated
in Ozer — no source code exists yet.

## Indexing scope (final, decided)

**Indexed:** source code only, once it exists, via
`graphify extract . --code-only` (local, no LLM, no network — verified by
direct test, see below). **Never indexed by this integration:**
Markdown, docs, specs, ADRs, `CONTEXT.md`, `AGENTS.md` — those are
direct-read, not graphify's job.

**Explicitly and permanently excluded even from the code-only path**
(enforced by [`.graphifyignore`](../../.graphifyignore) at repo root,
confirmed effective by two independent direct tests, on both `0.4.20`'s
`update` and `0.9.48`'s `extract --code-only`): `logs/` (all of it,
including `logs/prompts/`), `.scratch/`, `.env`/keys/certs,
credential/secret/token-shaped filenames, `node_modules/`,
`__pycache__/`, `.git/`, raw image/video file extensions, `downloads/`,
`recordings/`.

## Exclusion mechanism

`.graphifyignore`, gitignore-compatible syntax, merges with `.gitignore`
(only ever excludes more). Confirmed effective twice: a marker symbol
under an ignored path was completely absent from the resulting graph in
both the `0.4.20` and `0.9.48` deterministic tests, while a sibling
marker outside the ignored path was correctly indexed and exactly
retrieved via `graphify query` both times.

## Retrieval flow

`graphify query "<question>"` / `graphify path A B` / `graphify explain
X` — all read-only against `graphify-out/graph.json`, no mutation of any
canonical source file. Confirmed by direct test on both versions.

## Stale-index handling

Not automatic. `graphify extract`/`update` re-extracts code files on
demand; there is no enforced "must be fresh before query" gate. Per ADR
0002: if the graph ever disagrees with current code, **the graph is
wrong**, full stop — regenerate, never hand-edit `graph.json`.

## Rebuild procedure

`graphify extract . --code-only` (or `graphify update .` for an
incremental refresh) from the repo root, once source code exists.
`graphify hook install` (not yet run) would add post-commit/post-checkout
hooks to auto-rebuild — deferred until there is code worth rebuilding on
every commit.

## Failure fallback

Demonstrated by construction across two separate sessions now, not
simulated: no `graphify-out/` exists in this repo, and every phase of
this project's work (Phases 0–4, the installation task, and this closure
task) has proceeded entirely on git + Markdown + code, with zero
functional dependency on graphify. If graphify is ever uninstalled,
broken, or its graph goes stale, nothing about Ozer's actual engineering
workflow changes.

## Reproducing this setup

1. `uv tool install graphifyy` (pin `>=0.9` explicitly if reproducing
   fresh, to avoid any repeat of the version-resolution anomaly
   documented in `docs/research/graphify.md`).
2. `graphify install --project` from the repo root — writes
   `.claude/skills/graphify/`.
3. **Inspect** any resulting `.claude/settings.json` changes for
   hardcoded absolute paths before committing — see "A reproducibility
   problem was found and fixed" above. Do not commit a machine-specific
   hook.
4. `.graphifyignore` already exists at repo root — do not extract before
   confirming it's still present and unchanged.
5. Once source code exists: `graphify extract . --code-only`.

## Removal procedure

`graphify uninstall --project` (repo-scoped skill), delete
`graphify-out/` if present, remove the `## graphify` section from
`CLAUDE.md` and `.claude/CLAUDE.md` if no longer wanted, delete
`.graphifyignore`. Ozer's engineering workflow requires no changes
elsewhere — nothing else depends on graphify's presence.

## Security boundaries

- The only active capability (`graphify extract --code-only`) never
  sends anything over the network — confirmed by direct test, twice,
  with no LLM provider keys configured. This is behavioral evidence
  (no key configured, sub-second local-AST-shaped execution), not
  packet-capture proof, since no network-traffic interception was
  available in this sandboxed environment.
- `.graphifyignore` is the enforced technical boundary preventing
  `logs/` and credential-shaped paths from ever being indexed — verified
  effective on both tested versions.
- The Markdown-indexing path remains entirely unexercised and is not an
  active part of this architecture — see "Why not Markdown too."
- No secrets were exposed in this closure task: the previously-flagged
  `GROQ_API_KEY` was not inspected, displayed, or referenced again.
