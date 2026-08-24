# Phase 12: Enforceable egress — T17 and T16 converted into behaviour

## Status: T17 and T16 gates IMPLEMENTED and TESTED (31 tests). Not yet wired into a WebBrain build. Phase 12B (region adapter) and 12D (text path) not started.

## The principle

> **Transformation is not proof.** A payload may leave only if the final
> provider-bound artefact can be shown to satisfy the privacy policy —
> not because a redaction function was called.

This is what separates Ozer from a second redactor. WebBrain performs
the transformation; Ozer independently verifies it happened.

## `captureEgressGate.js` — T17

`assertCaptureSafeForEgress(capture) -> {allowed, reasons}`

Verifies the seven invariants, all fail-closed:

| # | Invariant | Blocks when |
|---|---|---|
| 1 | Policy was enabled | `redactionEnabled !== true` |
| 2 | Valid privacy snapshot | `snapshotOk !== true` |
| 2b | **No TOCTOU (T16)** | `snapshotStable !== true` |
| 3 | Region collection completed | `regionCollectionComplete !== true` |
| 4 | **Transformation actually occurred** | regions existed **and** `sanitizedDataUrl === rawDataUrl` |
| 5 | Payload *is* the sanitized artefact | `payloadDataUrl !== sanitizedDataUrl` |
| 6 | Metadata complete and recognised | missing field, non-boolean boolean, malformed region, **or any unrecognised key** |
| 7 | Any uncertainty | non-object input, or an internal throw |

Invariant 4 is the direct answer to the upstream fail-open path found in
Phase 11B: `_redactScreenshotDataUrl` and `pixelateDataUrl` both
`return dataUrl` on internal failure, and the auto-screenshot path has
no no-op check, so "redacted" can silently be the raw capture.

**The gate is deliberately non-co-operating.** It does not ask the
pipeline whether it succeeded; it checks conditions that only hold if it
genuinely did.

Two design choices worth keeping:

- **Unknown keys block.** A future field cannot silently widen what is
  permitted.
- **`reasons` never echo the payloads.** A blocked-egress log must not
  become the leak it prevented — there is a test for this.

### Explicit scope limit

This verifies **pipeline invariants, not image content**. It cannot tell
whether a box landed in the right place, or whether an *undetected*
secret is still visible. Content-level verification needs a detector and
is Tier 3's job. **Do not describe this as proving an image is free of
PII.**

## `snapshotStability.js` — T16

`assertSnapshotsStable(before, after) -> {stable, reasons}`

The failure it prevents:

```
collect regions   -> password measured at rect A
page reflows / lazy-renders
capture           -> secret now drawn at rect B
redact rect A     -> the secret escapes at rect B
```

No adversary required; ordinary async rendering reaches it.

Approach taken from WebBrain v32.2.3, which collects the snapshot twice
and refuses when they differ (`agent.js:1749-1754`) — reusing a proven
upstream idea rather than inventing one.

Two deliberate departures from naive `JSON.stringify` equality:

1. **Region order is not significant.** Collectors walk frames
   concurrently, so ordering varies with nothing having changed.
   Treating that as instability would be a false positive that trains
   people to disable the check.
2. **Only privacy-relevant fields are compared** — `kind` plus rect
   geometry plus viewport. Region `text` is never read and never appears
   in `reasons`.

Detects: moved region, resized region, appeared region, disappeared
region, viewport resize, kind reclassification. Fail-closed on missing
or malformed snapshots.

## What is NOT done

- **Not wired into a WebBrain build.** No WebBrain code has been
  imported or modified. These gates are tested in isolation.
- **The caller must compute `snapshotStable`** by taking two snapshots
  and calling `assertSnapshotsStable`. Nothing yet enforces that a
  caller actually does so — the same class of gap as Threat T9.
- **Phase 12A (default-on policy)** — not done. Requires a WebBrain
  build.
- **Phase 12B (region adapter)** — the `SensitiveRegion -> {kind, rect}`
  projection. Designed in Phase 11B, not written.
- **Phase 12D (text-path gate)** — the largest remaining gap, and the
  best-evidenced one.

## Tests

31 new: 18 in `captureEgressGate.test.js`, 13 in
`snapshotStability.test.js`. Suite total **178** (157 JS + 21 Python).

---

## Phase 12B: the region projection adapter — one pipeline, many producers

`regionProjection.js` — `projectSensitiveRegions(regions, { space })`.

### The invariant it preserves

WebBrain needs only **geometry** to transform pixels (`pixelateDataUrl`
reads `rect`, never `kind`). Ozer owns the **meaning** of why that
geometry is sensitive. So `SensitiveRegion` stays canonical and
WebBrain's four-value `kind` enum is a downstream label — never Ozer's
privacy model.

### The seven criteria, and how each is met

| # | Criterion | How |
|---|---|---|
| 1 | Every valid region projects | `{kind, rect}` out, tested |
| 2 | No geometry lost or shrunk | origin floors, far edge ceils — a box may only **grow**, never crop |
| 3 | Unsupported categories not dropped | `CATEGORY_TO_KIND` is **total**; `financial`/`visual_identity` map to `input` |
| 4 | Canonical fields survive | `canonical[]` returned alongside, same order, unmutated |
| 5 | No detection, no second privacy decision | never filters by confidence, never reads text — tested with a 0.01-confidence region and a misleading `text` field |
| 6 | Non-DOM regions accepted | `elementId: null` face box projects identically |
| 7 | Ambiguous coordinate space fails closed | `space` is **required**, never inferred |

### Criterion 3 is the one that matters most

`financial` and `visual_identity` have no counterpart in WebBrain's
`password|input|email|phone` enum. The tempting behaviour — drop what
doesn't map — would silently stop redacting card numbers and faces.
The mapping is therefore **total**, and the compromise is a *label*,
not a privacy decision: the region is still redacted, and its true
category survives on the canonical object.

An unknown category still **throws** rather than defaulting to `input`,
so a genuinely new category cannot slip through mislabelled.

### Criterion 7: a real coordinate trap

Ozer's `boundingBox` from `domGeometry` is in **image pixels** (DPR
already applied). WebBrain's `mapRegionsToImage` expects **CSS pixels**
and scales them. Feeding one into the other double-scales every box, so
there is deliberately **no default**:

- `space: 'image'` → inject after `mapRegionsToImage`, straight into
  `pixelateDataUrl`.
- `space: 'css'` → may travel through `mapRegionsToImage` with the rest.

### The one-pipeline proof

`extension/test/integration/onePipeline.test.js` runs DOM (Tier 1) and
non-DOM visual (Tier 3) producers together against the **real captured
screenshot** and asserts: they converge into one region list, one
projection call handles both without dropping either, and **one**
redaction pass masks both — while the Save button stays untouched.

A control assertion proves the face pixels are only masked *because* of
the Tier 3 region: removing that producer leaves them unchanged.

The Tier 3 region is hand-supplied, since no face detector exists. That
is the point — it proves the **contract** accepts a producer with no DOM
element, so a real detector drops in later without touching geometry,
projection, or redaction.

Suite total: **207** (186 JS + 21 Python).
