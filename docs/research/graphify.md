# Graphify Identification

**Exact product/project name:** `graphify` — CLI/skill knowledge-graph tool
by **Graphify Labs** (YC S26).

**Official source:**
- GitHub: `https://github.com/Graphify-Labs/graphify` (org repo). The
  project's own contributing section also references
  `github.com/safishamsi/graphify` (`v8` branch) as the development clone
  URL — read as the founder's/maintainer's working repo for the same
  project, not a separate fork with independent authority. Recorded as-is
  rather than resolved further, since resolving org-vs-personal-repo
  canonicity isn't necessary for the integration decision below.
- PyPI package: **`graphifyy`** (double "y" — the README explicitly warns
  other `graphify*` PyPI packages are unaffiliated). CLI command remains
  `graphify`.
- Separately, **`graphify.com` / `app.graphify.com`** is advertised as
  "graphify Enterprise" — a hosted, always-on cloud product from the same
  company, in early access. This is a **different thing** from the local
  CLI tool and is treated separately below (see Security and Privacy).

**Evidence basis for this document:** the project's own README, supplied
directly by the user in this session (not independently fetched by this
agent via a live web request — no `WebFetch` call was made this session).
It is being treated as a primary source because its content is internally
detailed and consistent with a real, actively maintained OSS project
(specific PyPI package name with a naming caveat, exact CLI flags, exact
environment variable names, a CI/contributing section with real commands,
troubleshooting entries describing specific historical bugs). Where a
claim below could not be cross-verified independently, it is marked as
sourced from this README rather than independently confirmed.

**Version or commit:** Not pinned at research time. **Now installed** —
see the Installation and Runtime Evidence section at the end of this
document for the actual version, which turned out to differ materially
from what the README describes.

---

# Purpose

Parses a codebase (and optionally docs/PDFs/images/video) into a
**knowledge graph** (`graph.json` + `graph.html` + `GRAPH_REPORT.md`) that
an AI coding assistant can query (`graphify query`, `graphify path`,
`graphify explain`) instead of grepping/reading raw files. Positioned as a
faster, more structural alternative to both plain file search and
vector-embedding RAG ("not a vector index... a real graph you traverse").

---

# Architecture

**How it stores knowledge:** Code is parsed **locally** via tree-sitter
AST (~40 languages) — deterministic, no LLM call, nothing leaves the
machine for this part. Docs/PDFs/images/video go through a **semantic
pass** using an LLM (either the IDE assistant's own model session when run
as a `/graphify` skill, or an explicitly configured API key for headless
`graphify extract`). Video/audio is transcribed **locally** via
faster-whisper (README's Privacy section is explicit: "nothing leaves
your machine" for this).

**How it retrieves knowledge:** `graph.json` is queried via CLI
(`graphify query|path|explain`) or via an **MCP server**
(`python -m graphify.serve`, stdio by default or HTTP for a shared team
server) exposing structured tools: `query_graph`, `get_node`,
`get_neighbors`, `shortest_path`, plus PR-related tools.

**Persistence model:** Three local, plain files under `graphify-out/`:
`graph.json` (full graph, portable/relocatable — "keys are stored as
relative paths and re-anchored on load"), `graph.html` (interactive
viewer), `GRAPH_REPORT.md` (human-readable summary). The README explicitly
recommends **committing `graphify-out/` to git** so the whole team/every
agent starts from the same graph, with a git merge driver
(`graphify hook install`) to auto-union-merge `graph.json` on concurrent
commits. Optional, opt-in pushes to external graph databases (Neo4j,
FalkorDB) exist as extras but are not required.

**Local/cloud/hybrid classification:**
- **Code indexing: local-only**, no network calls, no API key required.
- **Docs/PDF/image indexing: hybrid** — requires a model call, either
  through the IDE assistant's existing session (no separate credential) or
  an explicitly configured third-party API key (Anthropic/Gemini/
  OpenAI/DeepSeek/Kimi/Bedrock/Ollama-local).
- **Storage: local** (committed to the Ozer git repo as plain files) unless
  the optional Neo4j/FalkorDB push or the separate hosted "graphify
  Enterprise" product is deliberately opted into — neither is proposed
  here.

---

# Agent Compatibility

**Claude Code:**
PARTIALLY_VERIFIED. The README documents a specific, detailed integration
(`graphify install`, `graphify claude install` writing a `CLAUDE.md`
section plus a `PreToolUse` hook, `--strict` mode blocking the first raw
file read) that is internally consistent with how Claude Code's skill/hook
system actually works (matches this session's own observed skill-loading
behavior from Phase 2). Not independently executed in this session — no
`graphify install` was run, so this is evidenced by README claims
consistent with known Claude Code mechanics, not by a live install/test
here.

**Codex:**
UNVERIFIED (as tooling; the README's own claim is more specific than a
guess but still not independently tested). The README states Codex uses
`AGENTS.md` as "the always-on mechanism" because Codex Desktop rejects the
`PreToolUse` hook's `additionalContext` output — a specific, plausible,
architecturally-detailed claim, but not something this session verified
against a real Codex instance.

**Generic agent (Agent-Skills / `AGENTS.md`-based):**
PARTIALLY_VERIFIED at the mechanism level. `graphify install --platform
agents` targets the generic cross-framework Agent-Skills convention
(`~/.agents/skills/` or project `.agents/skills/`) — the same convention
this repo's own Matt Pocock skill install already uses (see
`docs/adr/0001-matt-pocock-skills-install-mechanism.md`). That structural
compatibility is real and checkable right now (both tools target the same
`.agents/skills/` layout), but graphify itself was not installed or run in
this session, so "it actually works end-to-end for a generic harness" is
not independently confirmed.

---

# Security and Privacy

**What information leaves the local machine?**
- Code: nothing (local tree-sitter AST).
- Video/audio: nothing (local faster-whisper transcription).
- Docs/PDFs/images: sent to whatever model backend is in use for semantic
  extraction — either the IDE assistant's own session, or an explicitly
  configured API (Anthropic/Gemini/OpenAI/DeepSeek/Kimi/Bedrock) whose
  provider then processes that content. Kimi specifically routes to
  Moonshot AI servers in China, per the README — a concrete data-residency
  fact worth flagging given Ozer's own privacy mission.
- Query text: logged **locally only** to `~/.cache/graphify-queries.log`,
  and only if explicitly enabled (`GRAPHIFY_QUERY_LOG_ENABLE=1`) — off by
  default per the README. Full subgraph responses are not stored by
  default even when the log is on.
- The README states "no telemetry, no usage tracking, no analytics" for
  the CLI tool itself. Not independently verified (would require reading
  the package's actual source, not done this session).

**What credentials are required?**
None for code-only indexing. An LLM API key (or an already-authenticated
IDE session) is required only if docs/PDFs/images/video-transcription-
adjacent semantic extraction is used.

**Can repository context contain sensitive data?**
Yes — this is the central risk for Ozer specifically. Ozer's own
`logs/prompts/` directory is explicitly designed to capture engineering
prompts, and per `AGENTS.md` those are supposed to be pre-redacted
(`<REDACTED>`) by whoever writes them — but that's a human/agent
discipline, not a technical guarantee. If graphify's docs/PDF/image
semantic pass were pointed at `logs/`, `docs/`, or any test fixtures
containing real or synthetic credentials, screenshots, or PII (which is
exactly the kind of content Ozer's own product will generate once the
privacy-fixture work in later phases begins), that content could be sent
to a third-party model API. This is not a hypothetical for this specific
project — it's close to the actual failure mode Ozer's own privacy gate
is designed to prevent, applied to the *tooling* around Ozer instead of
the product itself.

**What data minimization controls exist?**
`.graphifyignore` (gitignore-syntax, merges with `.gitignore`), a
`--code-only` flag that skips the LLM-requiring doc/PDF/image pass
entirely, and per-backend routing (`--backend ollama` for fully local
inference instead of a cloud API).

---

# Integration Options

**Option A — Code-only, local-only indexing (recommended starting point).**
Run `graphify extract . --code-only` (or the `/graphify` skill scoped to
source directories only once any exist). No LLM call, no network egress,
no API key. `graphify-out/` committed to git as a plain retrieval index
on top of the canonical code/Markdown. Lowest risk, matches the "index
layer, not source of truth" architecture already decided.

**Option B — Option A plus selective Markdown indexing (docs/specs/adrs
only, explicitly excluding logs/).** Adds semantic linking across
`CONTEXT.md`, ADRs, and specs — useful once there's enough of that content
to be worth graphing. Requires an LLM call (IDE-session-provided, so no
separate key needed inside Claude Code) and an explicit `.graphifyignore`
that excludes `logs/` entirely (see Exclusion Policy below).

**Option C — Full-repo indexing including `logs/`.** Not recommended at
this stage. `logs/prompts/` in particular is exactly the kind of content
that must never be blindly fed to a third-party semantic-extraction pass
without a technical (not just procedural) redaction guarantee, which does
not currently exist.

**Option D — graphify Enterprise (`app.graphify.com`, hosted/always-on).**
Not evaluated and not recommended for consideration at this phase — it's
a separate hosted product from the same company, explicitly still in
early access, and would mean sending project context to a third-party
cloud service continuously. Out of scope unless a future, deliberate
decision revisits it with its own privacy review.

---

# Failure Modes

`graphify-out/` is a static, generated artifact set — if the `graphify`
tool becomes unavailable (uninstalled, network issue for the LLM-backed
parts, upstream project abandoned), the committed `graph.json`/
`GRAPH_REPORT.md`/`graph.html` still exist and remain readable as a
point-in-time snapshot; they simply stop being regenerated. Agents fall
back to their normal behavior (reading files, `grep`/`Grep`) exactly as
they did before graphify existed — the README's own "always-on" hook
mechanisms are described as *nudges* (Claude Code's default mode) or, at
most, a single soft-blocked first read in `--strict` mode, not a hard
dependency. This matches the required principle: Ozer does not depend on
graphify to function.

---

# Recommendation

**A — RECOMMENDED**, scoped narrowly: **Option A now (code-only, local,
zero network egress)**, with **Option B available later** once
`docs/`/`CONTEXT.md`/ADR content is substantial enough to be worth graphing
— gated on an explicit, committed `.graphifyignore` that excludes
`logs/` unconditionally (see below). Option C and D are explicitly not
recommended at this time.

## Exact integration architecture

```
                    CANONICAL MEMORY
                           |
          ---------------------------------
          |                               |
       Git history                  Markdown artifacts
          |                          (AGENTS.md, CLAUDE.md,
          |                           CONTEXT.md, docs/*)
          ---------------------------------
                           |
                           v
                  graphify-out/ (INDEX)
              graph.json / graph.html / GRAPH_REPORT.md
                  regenerated by `graphify extract`
                           |
                           v
                  Coding agent context
             (via `graphify query`/MCP, never authoritative)
```

## Exact data flow
1. `graphify extract . --code-only` reads source files (once Ozer has
   source code — currently none) via local tree-sitter AST. No network
   call.
2. Output written to `graphify-out/` (committed to git, same repo).
3. An agent session queries `graphify query "<question>"` for a scoped
   subgraph instead of grepping/reading raw files, when that's faster.
4. If Markdown indexing (Option B) is later enabled, the LLM call for
   that pass runs through whatever model the invoking IDE session already
   uses — no new credential is introduced into the repo or Ozer's own
   runtime.

## Exact canonical source of truth
Unchanged from `CONTEXT.md`/`AGENTS.md`: git history + Markdown +
executable code. `graphify-out/graph.json` is a derived, regenerable
index. If it disagrees with current code or Markdown, **the graph is
stale, full stop** — regenerate it, never edit it by hand, never treat a
graph query result as authoritative over reading the actual file it
points to for anything that matters (implementation correctness, spec
compliance, security review).

## Synchronization model
Regenerated on demand (`graphify extract --update` for incremental) or on
commit (`graphify hook install` sets up a post-commit hook plus a git
merge driver so concurrent updates to `graph.json` don't produce conflict
markers). Not real-time; agents should treat the graph as "as of last
regeneration," matching the "graph is stale, full stop" rule above.

## What is indexed
Initially (Option A): source code only, once Ozer has source code, via
local AST — no current effect since the repo has no implementation code
yet. `.gitignore` is respected automatically; an explicit
`.graphifyignore` will be added as soon as this is actually run (see
Exclusion Policy).

## What must never be indexed
See Exclusion Policy below — this is the load-bearing section per the
user's explicit instruction.

## How agents retrieve context
`graphify query "<question>"` / `graphify path A B` / `graphify explain
<node>` from the CLI, or the MCP server's `query_graph`/`get_node`/
`get_neighbors`/`shortest_path` tools, once graphify is actually installed
in a given session (not yet done — this phase is research/decision only).

## How stale context is handled
Not automatic. `graphify check-update` / `graphify update` detect and
apply changes; nothing currently enforces "regenerate before every
query." This is a real gap worth a follow-up spec once integration
actually happens (Phase 3 stops short of that spec, per instruction).

## How Graphify failure is handled
No special handling needed or proposed — see Failure Modes above. Agents
already default to reading files directly; graphify is additive.

---

# Indexing Exclusion Policy (required before any use)

**GRAPHIFY MUST NOT INDEX**, until each has explicit, documented, and
safe handling:

- `logs/` in its entirety — **especially `logs/prompts/`**, which is
  designed to capture engineering conversation content and, per
  `AGENTS.md`, relies on manual `<REDACTED>` discipline rather than a
  technical guarantee. `logs/changes/` and `logs/reports/` are lower-risk
  by construction (structured, agent-authored summaries) but are included
  in the blanket exclusion for now, since the cost of excluding them is
  zero and the cost of a future prompt log accidentally containing a
  pasted credential reaching a third-party LLM is not.
- `.env` files, any credentials, private keys, secrets, authentication
  tokens (should not exist in this repo at all per `AGENTS.md`, but
  excluded defense-in-depth).
- Raw/unsanitized screenshots, browser fixtures, or test data — directly
  relevant once Ozer's own privacy-gate test fixtures exist (Phase 6/7).
  These are exactly the artifacts Ozer's own product is designed to
  redact; graphify indexing them unsanitized would undermine that
  principle at the tooling layer even before the product layer is built.
- Any arbitrary user data.
- `.scratch/` — working/temporary content, no reason to index.

**Mechanism:** a `.graphifyignore` file at repo root, created *before* the
first `graphify extract` is ever run (not yet created — no extraction has
been run in this phase; this is a precondition for Phase 3+1, not
something to defer past it). Minimum required content once created:

```
# .graphifyignore — required before first `graphify extract`
logs/
.scratch/
.env
.env.*
*.pem
*.key
```

This list is a floor, not a ceiling — expand it as soon as Ozer starts
generating actual browser fixtures, screenshots, or test credentials in
later phases.

---

# Open Questions

- Exact `graphifyy` version to pin, if/when actually installed (not done
  this phase — research/decision only).
- Whether `Graphify-Labs/graphify` (org) and `safishamsi/graphify`
  (personal, `v8` branch, referenced in the Contributing section) are the
  same canonical source or diverge — not resolved, not blocking for the
  decision above since either points to the same package on PyPI.
- Whether Option B (Markdown indexing) is worth doing before Ozer has
  much Markdown beyond what already exists — revisit once `docs/specs/`
  and `docs/adr/` have meaningfully more content.
- Whether Claude Code's `PreToolUse` hook behavior and Codex's `AGENTS.md`
  fallback, as described in the README, hold up under an actual install —
  not tested this session; would need to be verified if/when Option A is
  actually executed (a follow-up task, not part of this research phase).

---

# Installation and Runtime Evidence (2026-08-24, this session)

## Status: PARTIALLY_VERIFIED — installed and runtime-tested; materially narrower feature set than the README describes at the version that actually installed.

## Installation

- **Mechanism used:** the README's own documented recommended path, `uv tool install graphifyy` — not guessed, not substituted for another package. `uv` itself was found already present but not on `PATH` (resolved via `C:\Users\nitis\AppData\Roaming\Python\Python314\Scripts\uv.exe`).
- **Installed version:** `graphifyy` **0.4.20** (`pip show graphifyy`).
- **Latest available on PyPI at install time:** `0.9.48` (`pip index versions graphifyy`). The installed version is **substantially behind latest** — this explains the feature gap documented below. Not pinned to a specific version in the install command (matches the README's own unversioned `uv tool install graphifyy`) — a future install intending parity with the README's documented feature set (`extract`, `--code-only`, MCP server, `graphify prs`, etc.) should pin `graphifyy>=0.9` explicitly.
- **Source commit:** not exposed by `pip show` or the CLI — same limitation already noted for the Matt Pocock skills installer.

## Material feature gap vs. the README

The installed CLI (`graphify --help`) exposes: `install`, `path`, `explain`, `add <url>`, `watch`, `update <path>` ("re-extract code files, no LLM needed"), `cluster-only`, `query`, `save-result`, `benchmark`, `hook install/uninstall/status`, and per-platform `install`/`uninstall` pairs (claude, codex, gemini, cursor, opencode, aider, claw, droid, trae, trae-cn, antigravity, hermes, kiro, copilot, vscode).

**It does not expose**: `extract`, `--code-only`, `--backend`, `--mode deep`, `graphify prs`, `python -m graphify.serve` (tested directly — `error: Graph path must be a .json file, got: '--help'`, i.e. no such subcommand exists), or any headless multi-backend extraction.

**What this means operationally:** in this installed version, the *only* way to build a graph over anything other than source code is the in-assistant `/graphify` skill (an LLM-backed semantic pass run inside the IDE session) — there is no headless, code-adjacent way to index Markdown docs locally without invoking that skill. The `update <path>` command is real, local, and genuinely LLM-free, but it is **code-file only** (confirmed by direct test below).

## Runtime Network Status: VERIFIED LOCAL (for the code-only `update` path only)

- `graphify update .` against an isolated test directory containing only a Markdown file → `[graphify watch] No code files found - nothing to rebuild.` (exit 1). Confirms the code-only path only looks at code files.
- `graphify update .` against an isolated test directory containing two Python files (one under `logs/`, one not) with a `.graphifyignore` containing `logs/` → completed in well under a second, produced `graph.json` with exactly 3 nodes / 2 edges / 1 community, **no LLM provider API key was configured**, and the run's speed/output shape is consistent with a pure local tree-sitter AST parse, not a network round-trip. This is behavioral evidence, not a packet-capture proof — genuine network interception wasn't available in this sandboxed session, so "VERIFIED LOCAL" here means "verified via the documented no-LLM code path plus consistent observed behavior," not "independently proven via network monitoring."
- `graphify update .` against the **real Ozer repository** → identical `No code files found` result (Ozer has no source code yet). **No `graphify-out/` directory was created in the Ozer repo** — confirmed via `ls`.
- The environment was checked for LLM provider keys before this test (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY` unset). This check surfaced an unrelated, **pre-existing `GROQ_API_KEY`** already present in this shell's environment — not set by graphify or this session, and not used by anything graphify did (Groq is not one of graphify's backends in this version). Flagged to the user directly in-conversation; the value itself is deliberately not reproduced in this file or any committed artifact.
- Anything requiring the `/graphify` skill's LLM-backed semantic pass (Markdown/PDF/image indexing) was **not exercised** in this session — see Cross-Agent Testing below. Treat its network behavior as genuinely untested, not "probably fine."

## `.graphifyignore` — syntax and effectiveness

**Syntax confirmed gitignore-compatible by direct test**, not assumed from the README: a `.graphifyignore` containing `logs/` correctly caused a Python file under `logs/` to be completely absent from the resulting `graph.json` (its unique symbol name → 0 matches), while a sibling file outside `logs/` was correctly indexed (1 match) and successfully retrieved via `graphify query "<unique symbol name>"`, returning the exact node, its containing file, and its docstring — a genuine, deterministic exclusion + retrieval test.

Ozer's own `.graphifyignore` (repo root) is modeled on this confirmed syntax — see the file itself for the full exclusion list (`logs/`, `.scratch/`, `.env*`, key/cert files, credential/secret/token-shaped filenames, `node_modules/`, `__pycache__/`, `.git/`, raw image/video extensions, `downloads/`, `recordings/`).

## Storage location

`graphify-out/graph.json` + `graph.html` + `GRAPH_REPORT.md`, relative to wherever `graphify update`/the `/graphify` skill is invoked from — confirmed by the test-directory runs, which created `graphify-out/` exactly where invoked, not in some global location.

## Installed skill/integration layout (differs from README)

- `graphify install` (bare, no `--project` flag available in this version's `install` command per its own `--help`) installed the `/graphify` skill **globally**: `C:\Users\nitis\.claude\skills\graphify\SKILL.md`, and created a **global** `~/.claude/CLAUDE.md` (this user had none before). This is a real, material difference from the README, which documents a `--project` flag for repo-scoped installs — **not available in installed version 0.4.20**. Recorded honestly rather than silently treated as project-scoped when it isn't.
- `graphify claude install` (the "always use the graph" step) **did** write project-scoped files as documented: a `## graphify` section appended to this repo's `CLAUDE.md` (correctly below the existing "add Claude-specific notes below this line" marker), and `.claude/settings.json` with a `PreToolUse` hook matching `Glob|Grep` that only fires if `graphify-out/graph.json` exists in the repo — pure local shell conditional, no network call, inspected directly.
- **Practical consequence:** the actual graph-building skill (`/graphify`) is currently available to *any* Claude Code session on this machine, not scoped to the Ozer repo specifically, because this installed version doesn't support project-scoped skill install. Not a security problem per se (the skill does nothing until invoked), but "local to this repo" is not accurate for the skill file's location — only `graphify-out/` and the `CLAUDE.md`/`.claude/settings.json` wiring are repo-scoped.

## Cross-Agent Testing

- **Claude Code, this session**: tested directly — `Skill({skill: "graphify"})` → `Unknown skill: graphify`. This is the **exact same limitation** already documented for the Matt Pocock skill install (`logs/reports/0003-install-matt-pocock-skills.md`): a running session's skill registry is snapshotted at session start and does not hot-reload skills installed mid-session. The skill file genuinely exists on disk — this is a session-lifecycle fact, not an installation failure. **A fresh Claude Code session should be able to invoke `/graphify`; this specific claim remains UNVERIFIED** because it requires a session this one cannot start.
- **Codex**: UNVERIFIED — no Codex environment available in this session. `graphify codex install` (writes to `AGENTS.md`) was **not run** in this session, since doing so would modify the canonical `AGENTS.md` for an integration that cannot be tested here — left for a future session with an actual Codex environment.
- **Generic `.agents/skills/`-based harness**: not tested — this version's `install --platform agents` variant was not exercised, to avoid adding untested integration surface area to canonical files.

## Failure Fallback (demonstrated by construction, not simulated)

No graph existed in the Ozer repo before or after this session's work (`graphify-out/` does not exist in the repo). Every command in this session — reading `AGENTS.md`/`CONTEXT.md`, editing files, running git — worked exactly as in every prior phase, with zero dependency on graphify. This is not a simulated failure test; it is the actual, continuous state of the repository throughout Phases 0–4 and this installation task: **git + Markdown + code remain fully sufficient on their own**, and graphify has added a local, optional, currently-inert capability on top, exactly as ADR 0002 requires.

## Retrieval Test (adapted to what this version can actually do)

The originally requested test — index a temporary Markdown fact, retrieve it via a fresh invocation — **could not be performed**, because this installed version has no code-independent way to index Markdown without the `/graphify` skill, and that skill cannot be invoked in this session (see Cross-Agent Testing above). The closest equivalent deterministic test this version's genuinely local, no-LLM capability supports **was performed and passed**: a unique code symbol was indexed via `graphify update .`, retrieved exactly via `graphify query`, and a sibling symbol under an ignored path was confirmed absent from the resulting graph — see ".graphifyignore — syntax and effectiveness" above. This is substantively the same validation (index → verify exclusion → retrieve known fact → confirm exact match), scoped to the capability this version actually has.

---

# Closure and Version Reconciliation (2026-08-24, follow-up session)

## Status: VERIFIED (version reconciliation) / GRAPHIFY CODE INDEX ONLY (final scope decision)

## Version discrepancy — explained with evidence, not assumed

The original install (`uv tool install graphifyy`, no version pin) resolved
to `0.4.20` and took **5 minutes 11 seconds** to complete (per the
background task's own recorded log). Re-running the **exact same
unversioned command** in this follow-up session, under normal network
conditions, resolved to `0.9.48` (the actual current latest) in **under 4
seconds**, and is reproducible (confirmed by running it twice). Explicitly
installing `graphifyy==0.9.48` also succeeded cleanly with the same
Python 3.14.3 interpreter already in use — **ruling out a Python-version
compatibility constraint** as the cause (this was checked directly, not
assumed).

**Conclusion:** the `0.4.20` result was very likely caused by a transient
condition during the original install — most plausibly a stale or
degraded package-index response during an unusually slow (60x slower than
normal) resolution, not a real version/compatibility constraint. This is
the most evidence-consistent explanation available; a definitive root
cause (e.g. a specific mirror or cache state) cannot be proven
after the fact, and is recorded as a residual limitation rather than
overclaimed.

**Same package lineage, confirmed:** `graphifyy==0.9.48` installed from
the same PyPI index, same project metadata (`Home-page:
https://github.com/safishamsi/graphify`, same MIT license/author),
consistent with `0.4.20` — not a different or renamed package.

## Missing-functionality claims — tested directly on 0.9.48, not inferred from docs

| Claimed capability | 0.4.20 | 0.9.48 | Evidence |
|---|---|---|---|
| `extract` / `--code-only` headless indexing | Absent | **Present, tested** | `graphify extract . --code-only` run in an isolated test directory: correctly found and indexed 1 code file, correctly skipped a file under an ignored `logs/` subdirectory (`.graphifyignore` respected), retrieval via `graphify query` returned the exact expected node/edges |
| MCP server (`python -m graphify.serve` / `graphify-mcp`) | Absent | **Present, tested** | `graphify-mcp --help` (a real installed executable in 0.9.48, absent in 0.4.20) returns real usage text for `--transport {stdio,http}`, `--api-key`, etc. — not invoked as a live server (out of scope for this closure), but confirmed to exist and respond correctly to `--help` |
| Project-scoped skill install (`--project`) | Absent (confirmed via `--help`, not just assumed) | **Present, tested — but undocumented in `--help`** | `graphify install --project` run directly in the Ozer repo: correctly wrote `.claude/skills/graphify/` (project-scoped, portable file content, no absolute paths) instead of the global `~/.claude/skills/` location used by the bare `graphify install` |
| Broader retrieval (`affected`, `god-nodes`, `diagnose multigraph`, `tree`) | Absent | **Present** (per `--help`; not individually exercised in this closure — out of scope, code-graphing role doesn't currently need them) | `graphify --help` output |

**Would upgrading preserve the privacy/local-only architecture?** Yes, for
the code-only path specifically — re-verified directly (not assumed):
`graphify extract . --code-only` in the isolated test above ran with no
LLM provider key configured and completed in well under a second,
consistent with a pure local tree-sitter AST parse, matching the same
behavioral-evidence standard already established for `0.4.20`'s `update`
command. `extract` without `--code-only` (Markdown/PDF/image semantic
pass) still requires either an LLM key or the in-session skill in both
versions — upgrading does not change that requirement, it only makes the
`--code-only` restriction an explicit, documented flag instead of an
implicit behavior discovered by testing.

## A real reproducibility problem found and fixed during this closure

Running `graphify install --project` (0.9.48) and `graphify claude
install`-equivalent wiring together produced a `.claude/settings.json`
`PreToolUse` hook containing a **hardcoded, machine-specific absolute
path** (`C:/Users/nitis/.local/bin/graphify.EXE`) — a regression in
portability versus `0.4.20`'s hook, which used a portable relative shell
conditional (`[ -f graphify-out/graph.json ] && ... `). A hook committed
with this absolute path would silently fail (wrong binary path) on any
other machine, including CI or another contributor's laptop.

**Resolved by not committing that hook.** `.claude/settings.json` was
reverted to its previously-committed, portable, version-agnostic form.
The project-scoped skill files themselves (`.claude/skills/graphify/`)
were checked and confirmed to contain **no** absolute paths — this
portability problem was specific to the generated hook command, not the
skill content, and is documented here so a future session doesn't
silently regenerate the same non-reproducible hook by re-running
`graphify install --project`/`graphify claude install` without checking
the result first.

## Fresh-session test — inconclusive, not a real negative result

A genuinely independent fresh Claude Code process could not be launched
from within this session. As the closest available approximation, a
subagent was spawned via the `Agent` tool and asked to (a) attempt
`Skill({skill: "graphify"})`, (b) list its available skills, and (c)
summarize `AGENTS.md`/`CONTEXT.md`. Result: the subagent also got
`Unknown skill: graphify`, and its own skill listing showed **none** of
the skills already confirmed installed on disk in this repo (not just
graphify — the Matt Pocock skills from Phase 2 were absent too). This is
**not treated as proof that a real fresh terminal-launched session would
also fail** — it only demonstrates that `Agent`-tool subagents inherit
the parent session's static skill registry rather than performing an
independent, from-disk skill discovery. **Fresh-session discoverability
of the graphify skill remains genuinely UNVERIFIED**, not disproven —
this environment cannot produce a true independent test, and that
limitation is stated plainly rather than papered over with the
inconclusive subagent result.

## Markdown retrieval — ruled out for now, with the specific evidence-based reason

Two independent paths exist to index Markdown; both are blocked by
concrete, checked facts, not assumption:

1. **Headless `graphify extract` (no `--code-only`)**: requires one of
   `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` /
   `GOOGLE_API_KEY` / `DEEPSEEK_API_KEY` / `MOONSHOT_API_KEY` /
   a running Ollama instance. Checked directly this session — **none are
   configured**. Deliberately not configuring a new credential just to
   run this test, since that would mean adding a new external-API
   dependency to the machine for a validation task, and because sending
   any Ozer content (even a synthetic test fact) to a third-party LLM
   API deserves the same deliberateness as every other privacy-relevant
   decision in this project, not an ad hoc credential added mid-task.
2. **In-session `/graphify` skill** (uses the invoking IDE session's own
   model, no separate key): confirmed unavailable in this session and in
   a spawned subagent (see Fresh-session test above).

**Per the explicit fallback instruction for this closure phase:**

## GRAPHIFY CODE INDEX ONLY

Graphify's verified, active role in Ozer is **code-graph indexing only**
— local, no-LLM, tested and confirmed working end-to-end (index → exclude
→ retrieve) on `0.9.48`'s `extract --code-only` command. Markdown/doc
indexing is **not** an active or claimed capability of this integration
until a future session with either (a) a genuinely fresh, independently-
launched Claude Code process, or (b) a deliberately-provisioned LLM
backend credential, can actually demonstrate it. Until then, Ozer's
architecture treats Markdown/spec/ADR retrieval as **direct reading**
(`Read`/`Grep`/`git`), exactly as it has throughout every phase of this
project so far — see the revised architecture diagram in
`docs/architecture/graphify-integration.md`.

## Version decision

**B + D combined**: **upgrade** the installed version from `0.4.20` to
`0.9.48` (evidence supports it — same package lineage, more capable, no
compatibility issue found), **and** narrow graphify's active role to
**code graphing only** (option D) rather than attempting the broader
Markdown-retrieval role assumed during Phase 3 research. This is not "C:
replace" (no evidence another tool is better) and not "E: remove" (the
code-only capability is real, tested, and free — no reason to discard
it).

## Security status

- The previously-flagged `GROQ_API_KEY` was **not** inspected, displayed,
  or referenced again in this closure session — its value remains
  unknown to any file or log in this repository, exactly as required.
- No global Claude configuration (`~/.claude/CLAUDE.md`,
  `~/.claude/skills/`) was committed to this repository. The global
  skill was refreshed to `0.9.48` locally (for consistency with the
  project-scoped install and to clear a version-mismatch warning) — this
  is a machine-local convenience action, explicitly not part of any git
  commit.
- The non-reproducible, machine-path-bearing `.claude/settings.json` hook
  was identified and **not committed** — see "A real reproducibility
  problem found and fixed" above.
- No secrets appear in any committed file — scanned before staging (see
  the change log for this closure).
