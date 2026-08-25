/**
 * TOCTOU guard for the region/screenshot boundary — threat T16.
 *
 * The failure this prevents:
 *
 *     collect regions      -> password field measured at rect A
 *     page reflows / lazy-renders
 *     capture screenshot   -> secret is now drawn at rect B
 *     redact rect A        -> the secret escapes at rect B
 *
 * No adversary is required; ordinary asynchronous rendering reaches it.
 *
 * The approach is taken from WebBrain v32.2.3, which collects the region
 * snapshot twice — before and after the capture — and refuses when they
 * differ (`agent.js:1749-1754`). Reusing a proven upstream idea rather
 * than inventing one. This module is the comparison primitive; the
 * refusal belongs to the caller and to `captureEgressGate`.
 *
 * Two deliberate differences from a naive `JSON.stringify` equality:
 *   1. Region ORDER is not significant. Collectors walk frames
 *      concurrently, so ordering varies without anything having changed.
 *      Treating that as instability would be a false positive that
 *      trains people to disable the check.
 *   2. Only privacy-relevant fields are compared (kind + rect geometry +
 *      viewport). Incidental fields must not cause spurious refusals,
 *      and region *text* is never read here — see the note below.
 *
 * Region `text` is deliberately NOT compared and never appears in
 * `reasons`. A refusal message must not become the leak it prevented.
 */

function fail(reasons) {
  return { stable: false, reasons };
}

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/** Canonical, order-independent, privacy-relevant fingerprint of a region. */
function regionKey(region) {
  if (!region || typeof region !== "object") return null;
  const rect = region.rect;
  if (!rect || typeof rect !== "object") return null;
  for (const k of ["x", "y", "w", "h"]) {
    if (!finite(rect[k])) return null;
  }
  const kind = typeof region.kind === "string" ? region.kind : "";
  return `${kind}|${rect.x}|${rect.y}|${rect.w}|${rect.h}`;
}

function fingerprint(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  if (!Array.isArray(snapshot.regions)) return null;
  const vp = snapshot.viewport;
  if (!vp || typeof vp !== "object" || !finite(vp.width) || !finite(vp.height)) return null;

  const keys = [];
  for (const region of snapshot.regions) {
    const key = regionKey(region);
    if (key === null) return null;
    keys.push(key);
  }
  keys.sort(); // order-independent
  return { viewport: `${vp.width}x${vp.height}`, keys };
}

/**
 * @param {object} before - region snapshot taken before capture
 * @param {object} after  - region snapshot taken after capture
 * @returns {{stable: boolean, reasons: string[]}} never throws
 */
function assertSnapshotsStable(before, after) {
  try {
    const a = fingerprint(before);
    const b = fingerprint(after);

    if (a === null && b === null) {
      return fail(["both region snapshots are missing or malformed"]);
    }
    if (a === null) return fail(["the pre-capture region snapshot is missing or malformed"]);
    if (b === null) return fail(["the post-capture region snapshot is missing or malformed"]);

    const reasons = [];

    if (a.viewport !== b.viewport) {
      reasons.push(`viewport changed during capture (${a.viewport} -> ${b.viewport})`);
    }
    if (a.keys.length !== b.keys.length) {
      reasons.push(
        `sensitive region count changed during capture (${a.keys.length} -> ${b.keys.length})`
      );
    } else {
      for (let i = 0; i < a.keys.length; i++) {
        if (a.keys[i] !== b.keys[i]) {
          // Report that geometry moved, never what was in it.
          reasons.push("a sensitive region's kind or geometry changed during capture");
          break;
        }
      }
    }

    if (reasons.length > 0) return fail(reasons);
    return { stable: true, reasons: [] };
  } catch (err) {
    return fail([`internal error during snapshot stability check: ${err && err.message}`]);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { assertSnapshotsStable };
} else {
  self.assertSnapshotsStable = assertSnapshotsStable;
}
