# Engineering Report

## Run
0007-graphify-closure

## Objective
Graphify Closure and Version Reconciliation only — resolve the
`0.4.20`/`0.9.48` discrepancy with primary evidence, test the newer
version's capabilities directly rather than trust documentation, attempt
a fresh-session test where the environment permits, either demonstrate
Markdown retrieval or explicitly rule it out and narrow scope, choose one
final decision (A–E), protect secrets, ensure reproducibility. Stop
before Phase 5.

## Starting Commit
`f656477b90fb7d63f2a7ab00d933eba0f3c835e0` (`main`, matched local and
`origin/main`).

## Changes
- `docs/research/graphify.md` — "Closure and Version Reconciliation"
  section: version-discrepancy root-cause analysis, capability-by-
  capability test table, reproducibility fix, fresh-session test result,
  Markdown-retrieval ruling, final decision.
- `docs/architecture/graphify-integration.md` — rewritten around the
  final, decided architecture (code-graph indexing only; Markdown/docs
  remain direct-read).
- `docs/adr/0002-graphify-as-index-not-source-of-truth.md` — "Closure"
  section.
- `CLAUDE.md` — graphify section corrected for accuracy (no active graph,
  code-only scope, explicit "do not assume the skill works" note).
- `.claude/skills/graphify/`, `.claude/CLAUDE.md` — new, project-scoped,
  portable skill installation (`0.9.48`).
- `logs/prompts/0007-*.md`, `logs/changes/0007-*.md`, this report.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `f656477`, confirmed before starting.
- **Version discrepancy root cause**: re-ran the exact original
  unversioned command (`uv tool install graphifyy`) — resolved to
  `0.9.48` in under 4 seconds. The original install (same command,
  earlier session) took 5 minutes 11 seconds and resolved to `0.4.20`.
  Explicitly installed `graphifyy==0.9.48` directly — succeeded cleanly
  with the same Python 3.14.3 already in use, ruling out a Python-
  version compatibility explanation. Conclusion: the original result was
  most likely caused by a transient (60x slower than normal) network/
  index condition, not a real version constraint. Documented as the most
  evidence-consistent explanation available, with the caveat that a
  definitive root cause (specific mirror/cache state) cannot be proven
  retroactively — not overclaimed as certain.
- **Same package lineage**: confirmed via `pip show`/install metadata —
  same PyPI project (`graphifyy`), same upstream homepage
  (`github.com/safishamsi/graphify`), same license, consistent between
  versions.
- **Capability claims tested directly, not inferred from README**:
  - `extract --code-only`: run in an isolated test directory containing
    an allowed Python file and an excluded one (under `logs/`, with a
    `.graphifyignore` containing `logs/`). Result: "found 1 code, 0
    docs, 0 papers, 0 images" (correctly found only the allowed file),
    graph built with 3 nodes/2 edges/1 community, excluded symbol
    confirmed absent (`grep -c` → 0), allowed symbol confirmed present
    and exactly retrieved via `graphify query`.
  - MCP server: `graphify-mcp --help` (a real installed executable,
    absent in `0.4.20`) returned genuine usage text for
    `--transport {stdio,http}`, `--api-key`, etc. Not run as a live
    server (out of scope for this closure) but confirmed to exist and
    respond correctly.
  - `--project` flag: `graphify install --project`, run directly in this
    repo, correctly wrote `.claude/skills/graphify/` (project-scoped)
    instead of the global location the bare `graphify install` uses —
    tested by direct execution and `git status` inspection of the
    result, not just help-text presence (it isn't even documented in
    `--help`, only in the README prose and confirmed by trying it).
- **Reproducibility problem found and fixed**: the same test run also
  regenerated `.claude/settings.json` with a `PreToolUse` hook
  containing a hardcoded absolute path
  (`C:/Users/nitis/.local/bin/graphify.EXE`) — inspected via `git diff`
  before staging anything, recognized as non-portable (would break on
  any other machine), and **reverted** via `git checkout --
  .claude/settings.json` rather than committed. The leftover
  `.claude/settings.json.graphify-bak` file was deleted, not committed.
  The skill files themselves (`.claude/skills/graphify/`) were separately
  scanned and confirmed to contain no absolute paths — the portability
  problem was isolated to the generated hook, not the skill content.
- **Fresh-session test**: no independent, freshly-launched Claude Code
  process was available in this environment. Used the `Agent` tool to
  spawn a subagent as the closest approximation, instructing it to
  attempt `Skill({skill:"graphify"})`, list its own visible skills, and
  summarize `AGENTS.md`/`CONTEXT.md` (read-only, no file modification).
  Result: subagent also got `Unknown skill: graphify`, and its skill
  listing showed none of the skills already confirmed present on disk in
  this repo (including the Phase 2 Matt Pocock skills). This was
  explicitly **not** treated as proof a real fresh terminal session would
  also fail — documented as inconclusive, since `Agent`-tool subagents
  share the parent session's static skill registry rather than performing
  independent from-disk discovery. This distinction is recorded plainly
  in `docs/research/graphify.md` rather than glossed over.
- **Markdown retrieval ruling**: checked the environment for every
  documented `extract` backend's API key
  (`ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GEMINI_API_KEY`/
  `GOOGLE_API_KEY`/`DEEPSEEK_API_KEY`/`MOONSHOT_API_KEY`) — none
  configured. Deliberately did not add one to force a test, since
  provisioning a new external-API credential specifically to validate a
  tool is a decision that deserves the same deliberateness as any other
  privacy-relevant choice in this project, not an ad hoc addition mid-
  task. Combined with the inconclusive-but-unavailable skill path, ruled
  Markdown indexing out of the active architecture per the user's own
  explicit fallback instruction: documented as "GRAPHIFY CODE INDEX
  ONLY."
- **Security**: the previously-flagged `GROQ_API_KEY` was not inspected,
  printed, or referenced again anywhere in this closure task — confirmed
  by reviewing this task's own command history before writing this
  report. No global `~/.claude/` file was staged or committed — confirmed
  via `git status` showing only repo-scoped paths before every commit.

## Tests
See "Verification" above — the deterministic exclusion/retrieval test on
`0.9.48` is the closest equivalent to a formal regression test this
closure produced; both runs (test directory and the earlier `0.4.20`
test from report 0006) passed identically.

## Metrics
Install time: original unversioned command 5m11s → 0.4.20; reproduced
unversioned command <4s → 0.9.48. Not a formal benchmark, but a concrete,
recorded data point supporting the "transient anomaly" conclusion.

## Evidence
See "Verification" above for exact commands and results. Full detail in
`docs/research/graphify.md` ("Closure and Version Reconciliation"),
`docs/architecture/graphify-integration.md`, and
`docs/adr/0002-*.md` ("Closure").

## Failures
None as defects. The reproducibility problem (machine-specific hook path)
was a real finding, caught and corrected before commit rather than after.

## Remaining Work
1. If a future session can genuinely test the `/graphify` skill from an
   independently-launched process (not a subagent), that should update
   both `docs/research/graphify.md` and
   `docs/architecture/graphify-integration.md` deliberately — not be
   silently assumed to work because files exist on disk.
2. If Markdown indexing is ever wanted, it requires either a
   deliberately-provisioned LLM backend credential or a confirmed-working
   skill path — neither should be added without a dedicated decision.
3. Per user instruction: stop here. Phase 5 (reproducible Ozer baseline)
   and the privacy architecture are the next steps, not further
   infrastructure tooling.

## Final Status
VERIFIED for the version-reconciliation and scope-decision objectives of
this closure phase. The version discrepancy is explained with the best
available evidence (not proven beyond all doubt, and that limitation is
stated). The upgrade to `0.9.48` is evidence-supported (same lineage,
strictly more capability, no compatibility issue found, a real
reproducibility problem caught and fixed rather than shipped). Graphify's
final, active role in Ozer is narrowed to code-graph indexing only,
matching what could actually be demonstrated end-to-end; Markdown/spec/
ADR retrieval remains direct reading, exactly as the user's own proposed
architecture suggested. Canonical git+Markdown precedence, the `logs/`
exclusion, and secret protection all remain intact and re-verified.
