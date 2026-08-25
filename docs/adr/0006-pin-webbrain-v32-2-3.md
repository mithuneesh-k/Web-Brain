# ADR 0006: Pin WebBrain v32.2.3 as the agent foundation

## Status
Accepted. Supersedes ADR 0005's implicit assumption that the current
GPL release was the integration target; ADR 0005's *architecture*
(WebBrain as agent, Ozer as privacy layer, local gate primary, proxy
defense in depth) is unchanged and still in force.

## Date
2026-08-24

## Decision

Ozer's agent foundation is **WebBrain v32.2.3, commit
`52fb7914611717f2e9774dc137036a074b293b1d`**, pinned exactly — not a
floating tag, not `main`.

Terms of this pin:

1. **Version**: v32.2.3 / `52fb7914611717f2e9774dc137036a074b293b1d`
   (verified `object.type == commit`, so the SHA is the commit, not an
   annotated-tag object).
2. **Chrome + Firefox parity is mandatory.** Any Ozer integration must
   land in both `src/chrome/` and `src/firefox/`. A Chrome-only
   mechanism is not acceptable — the problem statement requires both,
   and Phase 8C confirmed WebBrain maintains parity at the seams Ozer
   uses (`_withImageDetail` appears in both).
3. **Ozer's privacy contracts remain the source of truth.**
   `SanitizedContext` v1.1.0, `SensitiveRegion`, `assertSafeForEgress()`,
   the threat model, and the trust-boundary model are Ozer's, not
   WebBrain's, and do not bend to fit WebBrain's shapes. Where they
   conflict, Ozer's contract wins and the conflict is recorded.
4. **The local privacy gate is primary.** Per ADR 0005 — it attaches
   inside the WebBrain-derived build, at the seams identified in Phase
   8C, so it cannot be skipped by configuration.
5. **The OpenAI-compatible proxy remains defense in depth**, not the
   primary mechanism.
6. **Tier 3 is experimental until measured.** No Tier 3 claim —
   including any use of WebBrain's bundled VLM — may be presented as
   working until it has been measured against fixtures. See
   "Consequences" for why this is called out specifically.

## Context

Phase 8A found WebBrain's credential defense is prompt-level, not
egress-level. Phase 8B found the GPL in v33.x comes from a vendored
Xapian/libzim WASM powering an offline-Wikipedia feature Ozer does not
need, and that v33.0.0's entire changelog is the relicence plus two
onboarding cosmetics. Phase 8C verified v32.2.3 directly.

## Evidence

From `docs/specs/phase8c-v32-foundation-verification.md`, all verified
at `?ref=v32.2.3` rather than inferred:

- Root `LICENSE` is standard MIT; `package.json` is `"license": "MIT"`.
  **Both agree** — unlike v33.2.1, where three first-party sources
  contradict each other.
- Zero runtime npm dependencies.
- Vendored tree: fflate MIT, fzstd MIT, pdfjs Apache-2.0, sqlite
  Apache-2.0, transformers Apache-2.0 + ONNX Runtime MIT.
  `vendor/libzim` **absent**.
- No GPL/LGPL/AGPL anywhere in the vendor tree. One MPL-2.0 component
  (weak, file-level) inside ONNX Runtime's third-party notices.
- Identical 17-file provider set to v33.2.1; WebGPU local inference and
  a 450M VLM present.
- Integration seams confirmed: `_withImageDetail()` defined once
  (`agent.js:9996`, four lines) carrying all seven `image_url`
  construction sites, plus four `provider.chat()/chatStream()` sites.

## Alternatives rejected

- **v33.2.1 (current)** — GPL-3.0-or-later, with a first-party
  licensing contradiction nobody on this project can resolve. Gains
  nothing Ozer needs.
- **Fork/patch current GPL WebBrain** — inherits the copyleft and the
  ambiguity for no architectural benefit.
- **Proxy-only, no WebBrain modification** — bypassable by
  configuration, fails the "sanitize before any network request"
  requirement (established in ADR 0005).

## Consequences

**Positive.** The Phase 8A deadlock dissolves: the foundation is both
unbypassable (gate inside the build) and permissively licensed. All
Phase 6–8 Ozer privacy work carries over unchanged. The screenshot seam
is one four-line method rather than seven scattered sites.

**Obligations this creates.** Modifying v32.2.3 produces an MIT-derived
work with MIT attribution obligations. Distribution additionally carries
Apache-2.0 NOTICE obligations (pdfjs, sqlite, Transformers.js) and
MPL-2.0 file-level obligations (within ONNX Runtime's dependencies).
**"MIT-clean" is the wrong phrase and should not be used** — the
accurate claim is "permissive, GPL-free, mixed."

**Known gaps, carried forward deliberately.**
- KaTeX ships with no vendored licence file (MIT upstream — an
  attribution gap to fix before distribution, worth reporting upstream).
- The ONNX model weights download at runtime under their own terms,
  which were **not** audited and are not covered by this pin.
- Pinning forgoes post-v32.2.3 fixes. Upstream security fixes will need
  deliberate backporting; there is no automatic path.

**Why term 6 exists.** Phase 8C found WebBrain's VLM is exposed as
`chat(messages) -> text` — a vision-*language* model, not a region
detector. Ozer's `SensitiveRegion` requires bounding boxes. Extracting
reliable boxes from a 450M VL model by prompting is plausible but
**unproven**. Face detection in particular is likely better served by a
dedicated small detector than by prompting a VL model. Any demo that
shows a blurred face must be backed by something measured, not by an
assumption that the bundled VLM handles it.

## Open risks

1. Ozer still has no `LICENSE` file of its own. Needed before
   distribution, and the choice interacts with the obligations above.
2. Full licence audit of the runtime-downloaded model weights.
3. Backport policy for upstream security fixes after this pin.
4. Whether the gate can attach at both seams without touching code
   paths that would complicate the derived-work picture further — a
   design question for Phase 9, not settled here.
