# Claude Code Instructions — Ozer

See [`AGENTS.md`](./AGENTS.md) for the full engineering contract — it applies
to Claude Code exactly as it does to any other agent working in this
repository. Read [`CONTEXT.md`](./CONTEXT.md) first for project vocabulary
and current state.

This file intentionally does not duplicate rules. If Claude-specific tooling
notes become necessary (e.g. an MCP server setup unique to this harness),
add them below this line — but they must not contradict `AGENTS.md`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
