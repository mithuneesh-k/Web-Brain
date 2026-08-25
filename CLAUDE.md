# Claude Code Instructions — Ozer

See [`AGENTS.md`](./AGENTS.md) for the full engineering contract — it applies
to Claude Code exactly as it does to any other agent working in this
repository. Read [`CONTEXT.md`](./CONTEXT.md) first for project vocabulary
and current state.

This file intentionally does not duplicate rules. If Claude-specific tooling
notes become necessary (e.g. an MCP server setup unique to this harness),
add them below this line — but they must not contradict `AGENTS.md`.

## graphify

Installed (`graphifyy` 0.9.48), scoped to **code graphing only** — see
`docs/architecture/graphify-integration.md` and
`docs/adr/0002-graphify-as-index-not-source-of-truth.md`. No graph exists
yet (`graphify-out/` is absent) because Ozer has no source code yet.
Markdown/doc indexing has not been verified in this project and is not
in active use — do not assume `/graphify` or the graphify skill works
until a future session confirms it and this section is updated.

Once source code exists:
- Run `graphify update .` after modifying code to keep the graph current
  (local AST only, no LLM, no network).
- If `graphify-out/graph.json` exists, prefer `graphify query "<question>"`,
  `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over raw
  grep for codebase-structure questions — these return a scoped subgraph.
- Canonical source of truth remains git + Markdown + code, per `AGENTS.md`
  — if the graph ever disagrees with either, the graph is stale, not
  authoritative.
