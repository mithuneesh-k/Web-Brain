# Engineering Report

## Run
0006-graphify-installation-validation

## Objective
Implement the Phase 3 Graphify decision: install via the documented
official mechanism, create `.graphifyignore` before any extraction,
observe and honestly classify runtime network behavior, validate
exclusion + retrieval end-to-end, document real architecture (correcting
any gap from the Phase 3 assumptions), test cross-agent honestly, commit
only what's required. Do not touch Ozer implementation.

## Starting Commit
`7ee620728fa2fe98f225d898ad8ecc1587ca8172` (`main`, matched local and
`origin/main`).

## Changes
- `.graphifyignore` — created first, before any extraction.
- `docs/research/graphify.md` — "Installation and Runtime Evidence"
  section appended with full test results.
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` — "Update"
  section correcting two assumptions that didn't hold at the version
  that actually installed.
- `docs/architecture/graphify-integration.md` — new, full integration
  architecture doc.
- `CLAUDE.md` — `## graphify` section appended by `graphify claude
  install` (below the pre-existing extension marker).
- `.claude/settings.json` — new, local-only `PreToolUse` hook.
- `logs/prompts/0006-*.md`, `logs/changes/0006-*.md`, this report.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `7ee6207`, confirmed before starting.
- **Installation mechanism**: used the exact documented command,
  `uv tool install graphifyy` — `uv` was already present but not on
  `PATH`; located and used directly rather than reinstalling or
  substituting a different tool. Installed version confirmed via
  `pip show graphifyy` → `0.4.20`. Checked against PyPI's actual latest
  (`pip index versions graphifyy` → `0.9.48`) — a real, material version
  gap, documented rather than glossed over, since it explains every
  feature difference found below.
- **Feature-gap discovery**: `graphify --help` enumerated; cross-checked
  against the README's documented commands. Confirmed by direct
  invocation (not absence-from-help-text alone) that `python -m
  graphify.serve` is not a real subcommand in this version
  (`error: Graph path must be a .json file, got: '--help'`).
- **`.graphifyignore` created before any extraction** — hard precondition
  from ADR 0002, satisfied first, before any `graphify update` command
  was run anywhere, including the isolated test directories.
- **Deterministic exclusion + retrieval test**: performed in an isolated
  scratchpad directory (outside this repo, never committed) with two
  Python files, one under `logs/`, one not, and a `.graphifyignore`
  containing `logs/`. `graphify update .` → real local extraction (3
  nodes, 2 edges, 1 community, sub-second). `grep -c` against the
  resulting `graph.json` confirmed the `logs/`-nested symbol → 0
  occurrences, the sibling symbol → 1 occurrence.
  `graphify query "<sibling symbol name>"` returned the exact node, its
  file, and its docstring. This is the mandatory end-to-end validation,
  adapted to what this installed version can actually do (code-file
  extraction only — see below) rather than the originally-envisioned
  Markdown-fact test.
- **Real-repo test**: `graphify update .` run against the actual Ozer
  repository → `No code files found - nothing to rebuild` (Ozer has no
  source code yet). Confirmed no `graphify-out/` was created in the repo
  (`ls` before and after). This is a true, valid, verified-local result.
- **Network status classification**: **VERIFIED LOCAL**, scoped
  explicitly to the `graphify update` code-only path only — not a
  blanket claim about the tool. Evidence: no LLM provider API key was
  configured in the environment during the test, and the run's
  near-instant completion and output shape are consistent with a pure
  local tree-sitter AST parse. Explicitly documented as behavioral
  evidence, not packet-capture proof, since no network-traffic
  interception tool was available in this sandboxed session.
- **Incidental finding**: while checking the environment for LLM
  provider keys, a pre-existing, unrelated `GROQ_API_KEY` was found
  already set in this shell's environment. Not caused by graphify or
  this session. The value was displayed once in raw tool output (which
  is ephemeral, not a committed artifact) and was **not** written into
  any file, log, or document in this repository. Flagged to the user
  directly in the conversation, with a recommendation to rotate/secure
  it, since a general-purpose shell environment is not a safe place for
  a live API key regardless of this session's actions.
- **Skill installation**: `graphify install` (bare) registered the skill
  **globally** (`~/.claude/skills/graphify/`, `~/.claude/CLAUDE.md`) —
  this version's `install` command has no `--project` flag (confirmed via
  its own `--help`), unlike what the README describes. Documented as a
  real, material limitation rather than silently treated as repo-scoped.
  `graphify claude install` (the "always use the graph" step) correctly
  wrote repo-scoped files: appended to this repo's `CLAUDE.md` below the
  existing extension marker, and created `.claude/settings.json` with a
  `PreToolUse` hook — inspected directly, confirmed to be a pure local
  shell conditional (`[ -f graphify-out/graph.json ] && ... || true`),
  no network call, only fires if a graph already exists.
- **Cross-agent testing, Claude Code (this session)**: called
  `Skill({skill: "graphify"})` directly → `Unknown skill: graphify`.
  Confirms — does not assume — the same session-lifecycle limitation
  already documented for the Matt Pocock skill install: a running
  session's skill registry is snapshotted at start. Not treated as an
  installation failure; treated honestly as "a fresh session should work,
  this one cannot demonstrate it."
- **Cross-agent testing, Codex**: deliberately **not** attempted —
  `graphify codex install` would modify the canonical `AGENTS.md`, and
  doing so for an integration that cannot be tested in this session
  (no Codex environment available) would add unverified, untestable
  surface area to a file every future agent reads. Left UNVERIFIED with
  the reasoning documented, rather than run speculatively.
- **Markdown indexing (the actual planned allowlist)**: not performed.
  This installed version's only local/no-LLM path is code-only; indexing
  `AGENTS.md`/`CONTEXT.md`/`docs/` would require the in-session
  `/graphify` skill, which (per the cross-agent testing result above)
  cannot be invoked in this session. Documented as an open item for a
  future fresh session, not silently skipped.
- **Failure fallback**: not simulated — demonstrated by the actual,
  continuous state of this repository. No `graphify-out/` exists in Ozer
  before or after this task; every phase of work in this project (0
  through 4, plus this installation task itself) proceeded entirely on
  git + Markdown + code with zero dependency on graphify.

## Tests
See "Verification" above — the deterministic exclusion/retrieval test is
the closest equivalent to a formal test this task produced; it is not an
automated regression test (no product code exists to attach one to) but
a manual, reproducible validation with a clear pass/fail result, both of
which passed.

## Metrics
Not applicable — no product code exists to measure.

## Evidence
See "Verification" above for exact commands and results. All new/updated
files listed under "Changes."

## Failures
None encountered as defects. Two initial `--help` probes on `graphify
claude install` and `graphify install` did not support a `--help` flag
and instead executed the real install immediately — this was caught,
the resulting files were inspected before being accepted as correct and
safe (local-only, appended rather than overwritten, no secrets), and
documented as a real behavioral quirk of this CLI version rather than
treated as an error to hide.

## Remaining Work
1. Run the actual Markdown allowlist indexing (`AGENTS.md`, `CONTEXT.md`,
   `docs/architecture/`, `docs/adr/`, `docs/research/`, `docs/specs/`)
   via the `/graphify` skill in a **fresh** Claude Code session — this
   session cannot do it.
2. Test Codex compatibility with an actual Codex environment before
   running `graphify codex install` against canonical `AGENTS.md`.
3. Recommend the user rotate/secure the pre-existing `GROQ_API_KEY` found
   in the shell environment (unrelated to this task, flagged for
   awareness, not written to any file here).
4. Per user instruction: stop here. Do not begin browser extension
   implementation, privacy detection, PII redaction, browser-use
   integration code, or model selection.

## Final Status
PARTIALLY_VERIFIED. Graphify is genuinely installed (real package, real
version recorded, honestly compared against latest), the `.graphifyignore`
exclusion mechanism is verified effective by direct deterministic test,
the code-only local path is verified network-free by direct test (with
the appropriate caveat about the limits of in-session verification), the
repo-scoped "always use the graph" wiring is installed and inspected
safe, and the actual architecture (including where it differs from the
Phase 3 research assumptions and the README itself) is fully documented.
What remains open — Markdown-content indexing and cross-agent (Codex)
testing — is open because it genuinely requires a session/environment
this one does not have, not because it was skipped.
