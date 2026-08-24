# Engineering Report

## Run
0003-install-matt-pocock-skills

## Objective
Close the Matt Pocock skill source gap left BLOCKED in report 0002: obtain
the real source, install via its official mechanism, verify per-workflow
discovery/invocation honestly, document, commit, push, verify sync. Then
stop — no Phase 3 (Graphify), browser-use, privacy implementation, or
model selection.

## Starting Commit
`db95c96fc5481bf0beddef52c2d0c1f31032a8ca` (`main`, matched local and
`origin/main` per report 0002).

## Changes
- Installed the Matt Pocock skill package via
  `npx skills@latest add mattpocock/skills` (36 skills, real files under
  `.agents/skills/`, symlinked into `.claude/skills/`,
  `skills-lock.json` written by the installer).
- Updated `docs/research/matt-pocock-skills.md` and
  `docs/architecture/agent-workflow.md` with install evidence, replacing
  the earlier BLOCKED status (original BLOCKED text preserved further
  down in the research doc as historical record, not deleted).
- Added `docs/adr/0001-matt-pocock-skills-install-mechanism.md`.
- Added `docs/specs/skill-layer-entry-verification.md`.
- Added `logs/prompts/0003-install-matt-pocock-skills.md`,
  `logs/changes/0003-install-matt-pocock-skills.md`, this report.

## Verification
- Pre-work: `git status` clean, `main` up to date with `origin/main` at
  `db95c96`; `git fetch origin` showed no new remote commits.
- Distinguished the two things the user supplied: (a) the real install
  command, and (b) a large block of aihero.dev documentation *describing*
  the skills. Only (a) was acted on. (b) was explicitly not used to
  author any skill files, per the "do not manually recreate skills from
  conversational descriptions" instruction — this is the correct
  interpretation of that instruction now that a real source did arrive.
- First install attempt was accidentally truncated by piping through
  `head -100`, which caused SIGPIPE and killed the installer mid-run
  (only 1 of 36 skills landed). Caught by inspecting the actual directory
  listing rather than trusting the truncated log, cleaned up
  (`rm -rf .agents .claude`), and re-ran capturing full output to a file.
  Recorded here rather than silently redone, per the failure-handling
  rule (reproduce, capture exact error, fix, rerun, document root cause).
- Second install: `npx skills@latest add mattpocock/skills` → exit code
  `0`. `ls .agents/skills` → 36 directories. Installer CLI version:
  `1.5.23` (`npx skills@latest --version`).
- Cross-checked all 14 workflow names from the bootstrap contract against
  the installed directory listing — all present.
- `skills-lock.json` inspected directly: per-skill `source`,
  `sourceType: "github"`, `skillPath` (exact path within
  `mattpocock/skills`), `computedHash`. No commit SHA is exposed by the
  installer or lock file — recorded as a real, accepted limitation in
  ADR 0001, not glossed over.
- `git status` immediately after install: only `.agents/`, `.claude/`,
  `skills-lock.json` untracked. `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md`
  unchanged — confirmed the install did not silently alter the canonical
  instruction files.
- Spot-checked `.agents/skills/to-spec/SKILL.md` directly: real YAML
  frontmatter (`name: to-spec`, `disable-model-invocation: true`) and
  process instructions matching the documented behavior.
- **Live invocation test, this session**: called
  `Skill({skill: "to-spec"})` directly → `Unknown skill: to-spec`. This
  is genuine evidence (not an assumption) that this session's own skill
  registry does not hot-reload mid-session. Documented as an open item,
  not swept under "installed = working."
- Secret scan before staging: `grep -rEil` for key/secret/token/password
  patterns across `.agents/skills/` → 10 files matched, all spot-checked;
  every match was benign (context-window "token" terminology, or a
  generic `gh secret set` helper script in `wizard/template.sh` with no
  actual credential values). No real secrets found or committed.

## Tests
None (documentation + third-party skill package install, no product code
exists to test).

## Metrics
Not applicable.

## Evidence
See "Verification" above for exact commands/results. Files listed under
"Changes." Raw installer output (293 lines) was captured to a local log
during the session (not committed — install-time console noise, not a
durable artifact; the durable, reproducible evidence is `skills-lock.json`
plus the file tree itself, both committed).

## Failures
- The `head -100`-truncated first install attempt (SIGPIPE killed the
  process early). Root cause: piping a long-running installer through a
  line-limiting command without accounting for backpressure. Fixed by
  redirecting to a file instead. No lasting effect — cleaned up before
  the real install.

## Remaining Work
1. Verify live skill discovery from an actual fresh Claude Code session
   (not this one) — open, cannot self-close.
2. Verify Codex (or another harness) actually discovers/invokes the
   installed skills — open, no environment available.
3. Per user instruction: stop here. Do not proceed to Phase 3 (Graphify),
   Phase 4 (browser-use import), privacy implementation, or model
   selection without further instruction.

## Final Status
PARTIALLY_VERIFIED — the skill package is genuinely installed from its
real, official source with reproducible hash-pinned evidence
(`skills-lock.json`), all 14 bootstrap-named workflows are present, and
the canonical `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md` layer was confirmed
untouched by the install. What remains unverified — live discovery from a
fresh Claude Code session, and any non-Claude-Code harness — is
unverified because this session structurally cannot test it, not because
the check was skipped.
