# Research: Graphify (cross-agent memory)

## Status: UNVERIFIED — not yet researched

Per `AGENTS.md`, this is an evidence-gathering task, not a default choice.
Unknowns to resolve before any integration:

- Which specific Graphify product/version is intended (the name is
  ambiguous without a link from the user/team).
- Integration API and supported agent harnesses.
- Persistence semantics and where data physically lives.
- Security/privacy behavior — relevant here because Ozer's whole premise is
  minimizing what leaves the local device; any memory layer touching
  Ozer-related data must be evaluated against the same standard.
- Failure mode when unavailable (must not block core workflow).

## Governing constraint (already decided, not open)

Graphify, if adopted, is an augmentation/index layer over repository state.
It is never the source of truth. On conflict between Graphify and
git+Markdown, git+Markdown wins. See `CONTEXT.md` and `AGENTS.md`.

## Next step

Ask the user which specific Graphify product they mean, or find a
first-party link/doc, before writing an integration spec.
