# Upstream: browser-use

## Status: PARTIALLY_VERIFIED — identified, pinned, and analyzed; not yet integrated

Full analysis: [`docs/research/browser-use.md`](../research/browser-use.md).
Integration decision: [`docs/adr/0003-browser-use-integration-strategy.md`](../adr/0003-browser-use-integration-strategy.md).
No upstream code has been copied into Ozer — this phase was research and
decision only.

## Pin

- **Repository:** `https://github.com/browser-use/browser-use`
- **Exact commit SHA:** `85ddbfedf609166b2d2c76c3d80506649fee82a9`
- **Branch:** `main`
- **Commit date:** 2026-08-19 10:35:20 -0700
- **Inspection date:** 2026-08-24
- **Package version at this commit:** `0.13.8`
- **License:** MIT (Gregor Zunic, 2024)

## Reason this revision was selected

Latest commit on `main` at inspection time, obtained via a shallow clone
(`git clone --depth 1`) into a throwaway location outside this repository
for read-only inspection. Not a stability/release-tag pin — if
integration actually proceeds, re-evaluate whether to pin to a tagged
release instead of a `main` commit for a more deliberate update cadence.

## Python version and dependency requirements

`requires-python = ">=3.11,<4.0"`. Connects to a real Chrome/Chromium
process via **Chrome DevTools Protocol** (`cdp-use==1.4.5`) — **no
Playwright dependency**, correcting this document's earlier open question
about Playwright. Full dependency list and analysis in
`docs/research/browser-use.md`.

## Package boundaries (as actually observed in source)

`agent/` (loop, LLM calls, `use_vision`/`sensitive_data` handling),
`llm/` (per-provider serializers, including image-content serialization),
`browser/` (CDP session, Chrome/Chromium process launch/connect),
`dom/` (structured page-state extraction), `screenshots/` (raw base64
screenshot storage — no redaction), `tools/` (typed action registry +
execution, including an LLM-backed `extract` action). Full detail in
`docs/research/browser-use.md`.

## Browser extension compatibility

**Not extension-compatible as-is.** It is a Python process that shells
out to launch/connect to a native Chrome/Chromium binary over CDP —
architecturally incompatible with a Chrome/Firefox extension's JS/WASM
sandbox, which cannot run an arbitrary Python process or spawn a sibling
browser process. Full evidence trail in `docs/research/browser-use.md`
under "Extension Compatibility."

## License terms and required attribution

MIT license. Permissive — allows use, copy, modification, and
distribution with the original copyright/license notice retained.
Attribution requirement: preserve the upstream `LICENSE` file's copyright
notice in any vendored/copied code (none has been copied yet under the
selected strategy — see ADR 0003).

## Integration decision

See [ADR 0003](../adr/0003-browser-use-integration-strategy.md) for the
full evaluation of fork/vendor/dependency/adapter/reimplementation
options and the selected approach with justification.

## Update procedure

Not yet defined in operational detail — depends on final integration
mode selected in ADR 0003. If browser-use is used as a companion process
dependency (the currently selected direction), updates are a normal
Python dependency version bump (`uv add browser-use==<version>` or
equivalent), re-verified against the modification seams documented in
`docs/research/browser-use.md` (vision/screenshot path, `extract` tool,
telemetry) after every upgrade, since those are exactly the paths an
upstream change could silently alter.

## Compatibility risks

- Upstream's default `use_vision` behavior, screenshot handling, or the
  `extract` tool's LLM wiring could change in a future version in ways
  that reintroduce a privacy-bypass path Ozer previously closed off by
  configuration — re-audit `docs/research/browser-use.md`'s "Privacy
  Bypass Analysis" equivalent (in ADR 0003) after any version bump.
- No Playwright dependency today; a future upstream change adding one
  would change the runtime footprint assumption recorded here.
- Telemetry defaults (PostHog, opt-out via `ANONYMIZED_TELEMETRY=false`)
  could change in a future release — re-verify the env var still works
  as documented.

## Divergence log

(empty — no code has been vendored, forked, or modified; the selected
strategy in ADR 0003 does not currently require any.)
