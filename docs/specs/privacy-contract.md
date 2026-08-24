# Privacy Contract

## Problem
Nothing currently prevents a future implementer from sending raw
sensitive data (screenshots, unredacted PII, credentials) from the
extension to the server. The Phase 5 `SanitizedContext` schema proves a
contract *shape* exists, but has no privacy semantics — it doesn't know
what "sanitized" means or how to check it.

## Evidence
- `docs/architecture/trust-boundaries.md`, `docs/architecture/
  privacy-data-flow.md` (this phase, written alongside this spec).
- `CONTEXT.md`'s architectural constraint:
  `RAW DATA -> LOCAL DETECTION -> LOCAL REDACTION -> SANITIZATION ASSERTION -> NETWORK`.
- `schemas/sanitized-context.schema.json` v1.0.0 (Phase 5) — the
  starting point this contract evolves from, per instruction ("start
  from the existing schema, evolve it through tests").

## Goal
A versioned `SanitizedContext` v1.1.0 schema carrying explicit privacy
metadata, plus a deterministic, testable `assertSafeForEgress()` gate
that a network call must pass before it's permitted — implemented and
proven with the 12 required test cases, no external model needed.

## Non-goals
- Real PII/secret detection (Phase 7). The gate's own pattern checks are
  an explicit, narrow, defense-in-depth sanity net — not a claim of
  general PII detection capability. Documented as such everywhere this
  matters.
- Enforcing that *every* future network call in the codebase goes
  through the gate (no such call exists yet beyond the Phase 5 stub) —
  see `privacy-data-flow.md`'s "what remains unimplemented."
- Real redaction/masking algorithms.

## Constraints
- No external AI model may be required for any test in this phase.
- Fail-closed: any validator exception, any unrecognized shape, any
  ambiguity → BLOCKED, never silently allowed.
- Must not use the words "secure"/"private"/"safe"/"zero-leakage"/
  "guaranteed" without evidence — use IMPLEMENTED / TESTED / VERIFIED /
  UNVERIFIED / BLOCKED / OUT OF SCOPE instead, per instruction.

## Schema evolution: SanitizedContext v1.0.0 → v1.1.0

**v1.0.0** (Phase 5): `{version, page_url_hash, elements: [{id, role,
text}], timestamp}`. No privacy semantics.

**v1.1.0** (this phase) adds a required `privacy` object and an optional
per-element `redacted` flag:

```json
{
  "version": "1.1.0",
  "page_url_hash": "<hash>",
  "elements": [
    { "id": "el-1", "role": "button", "text": "Say hello", "redacted": false }
  ],
  "privacy": {
    "redaction_applied": false,
    "redacted_regions": [],
    "redaction_types": [],
    "visual_context_version": "none"
  },
  "timestamp": "2026-08-24T00:00:00Z"
}
```

- `privacy.redaction_applied` (bool, required): whether the upstream
  (future Phase 7) pipeline claims to have redacted anything.
- `privacy.redacted_regions` (array of element ids, required, may be
  empty): which elements were redacted, if any.
- `privacy.redaction_types` (array, required, may be empty): from the
  enum `["pii", "authentication", "financial", "visual_identity"]` —
  matching the data classification taxonomy below.
- `privacy.visual_context_version` (string, required): identifies which
  version of the (not-yet-built) local detection/redaction pipeline
  produced this context — `"none"` is valid for Phase 5/6 stub content
  that never went through any pipeline.
- Per-element `redacted` (bool, optional, defaults to `false` if
  absent): lets the gate cross-check a claimed redacted region against
  the actual element.

This is a **breaking change** from v1.0.0 — the `version` field's
`const` is bumped, and old payloads are no longer schema-valid. This is
deliberate and documented, not accidental drift (see ADR — created only
if this rises to an irreversible decision; recorded here as a spec-level
change instead, since it's still pre-any-real-usage and easily
revisable).

## Data classification taxonomy

```
PUBLIC            — safe to log, safe to send, safe to display anywhere
INTERNAL          — Ozer-internal identifiers (element ids, hashes)
SENSITIVE         — PII: names, emails, phone numbers, addresses, government IDs
HIGHLY_SENSITIVE  — AUTHENTICATION: passwords, OTPs, API keys, access/session tokens
                     FINANCIAL: card numbers, CVV, bank/account identifiers
SECRET            — VISUAL_IDENTITY: faces, biometric/identity-bearing imagery
STRUCTURAL        — button locations, form field types, page hierarchy,
                     accessibility labels, bounding boxes, element roles
                     (kept explicitly separate from raw content — this is
                     what's actually allowed to cross the boundary)
```

`redaction_types` values map to this taxonomy: `pii` → SENSITIVE,
`authentication`/`financial` → HIGHLY_SENSITIVE, `visual_identity` →
SECRET. `STRUCTURAL` data (element role, id, bounding box) is what
`elements[].role`/`.id` carry — never raw content by contract.

## What may cross EXTENSION → SERVER (allowed)

- `page_url_hash` (a hash, never the raw URL)
- `elements[].id`, `.role` (structural)
- `elements[].text`, **only if** it passes the gate's pattern checks
  (see Test Plan) — i.e. it doesn't look like a password/API key/OTP/
  email, or it's marked `redacted: true` with a masked value
- `privacy.*` metadata (booleans, enums, region-id lists, version
  string)
- `timestamp`

## What must never cross (forbidden)

- Raw screenshots / images (structurally impossible — no such field
  exists in the schema, `additionalProperties: false`)
- Raw passwords, API keys, OTPs, session/access tokens (caught by
  pattern check if unredacted; caught again if claimed-redacted but the
  pattern still matches — Test 5)
- Unredacted PII matching the gate's email pattern (narrow: email only
  in this phase, see Non-goals — full PII detection is Phase 7)
- Unredacted faces (no visual/image field exists at all in this schema
  version — out of scope until Phase 8 adds a visual channel, at which
  point this contract must be revisited)

## Interfaces

**`assertSafeForEgress(context: object): {allowed: boolean, reasons: string[]}`**
(`extension/src/privacy/egressGate.js`) — pure function, no I/O, no
exceptions escape (wrapped, fail-closed on internal error).

**`validateTypedAction(action: object): {valid: boolean, reasons: string[]}`**
(mirrored in `companion/privacy/typed_action_guard.py` for the
Python-side companion, since that's where actions are actually
executed) — allowlist check (`action` in `{click, noop}`), target_id
consistency (`click` requires a non-null `target_id`, `noop` requires
null).

**`sanitizeForLogging(obj: object): object`**
(`extension/src/privacy/logSanitizer.js`) — allowlist-only projection,
strips anything not explicitly permitted.

**`submit_to_local_execution_adapter(payload: dict): dict`**
(`companion/privacy/adapter_boundary.py`) — the browser-use integration
boundary. Accepts only `{version, action, target_id, value}` keys;
raises on any other key (structurally proves a `screenshot` key cannot
reach whatever sits behind this function, per ADR 0003).

## Acceptance Criteria
All 12 tests in the Test Plan pass, deterministically, with no network
call and no external model dependency.

## Test Plan
1. Context with raw password (unredacted, password-shaped value) →
   BLOCKED
2. Context with API key (unredacted, key-shaped value) → BLOCKED
3. Context with email address, not marked/redacted → BLOCKED
4. Context with a redacted sensitive value (marked `redacted: true`,
   masked text) → ALLOWED
5. Context claiming redaction (`redacted: true`) but the text still
   contains the original sensitive-shaped value → BLOCKED
6. Invalid privacy metadata (missing required `privacy` fields) →
   BLOCKED
7. Unknown element role/classification (not in the allowed enum) →
   BLOCKED
8. Privacy validator throws an internal exception → BLOCKED (fail-closed
   wrapper)
9. Valid structural-only context (button/link roles, no sensitive
   patterns) → ALLOWED
10. Attempted request shape containing a `screenshot`-like field →
    rejected by schema/contract (structurally impossible to construct a
    valid `SanitizedContext` with one)
11. Sensitive data inside logs → `sanitizeForLogging()` strips
    everything except the allowlist, proven by test with a context
    containing sensitive text
12. browser-use integration boundary → `submit_to_local_execution_
    adapter()` rejects a payload containing a `screenshot` key

## Performance Targets
Not applicable — pure synchronous functions, no measurable latency
budget defined yet (deferred to Phase 10).

## Risks
- The gate's pattern-matching (regex for email/password/API-key shapes)
  will have false negatives against real-world sensitive data not
  matching these narrow patterns — explicitly acknowledged, not a claim
  of general detection. Phase 7 replaces/augments this with real
  detection.
- Schema version bump to 1.1.0 breaks the Phase 5 example payloads and
  server tests that hardcoded `"1.0.0"` — all updated in this change,
  cross-checked by running the full test suite before commit.

## Open Questions
None blocking — see `privacy-data-flow.md`'s "what remains unimplemented"
for deferred items already tracked, not left ambiguous.
