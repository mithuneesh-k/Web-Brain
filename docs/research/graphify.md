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

**Version or commit:** Not pinned. The README references a `v8` active
development branch and various dated troubleshooting notes (e.g.
"pre-v0.8.33"), implying a `0.8.x`+ line, but no single version number or
commit SHA was captured. If integrated, pin an exact `graphifyy` version
at install time and record it here.

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
