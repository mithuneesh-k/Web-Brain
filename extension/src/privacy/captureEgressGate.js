/**
 * Capture egress gate — the independent verifier for image payloads.
 *
 * THE PRINCIPLE THIS EXISTS FOR:
 *   Transformation is not proof. A screenshot may leave only if the
 *   final provider-bound payload can be shown to satisfy the privacy
 *   policy — not because a redaction function was called.
 *
 * This is the direct answer to threat T17
 * (docs/specs/phase6-threat-model.md). WebBrain's redactor returns the
 * ORIGINAL image on internal failure:
 *
 *     } catch { return dataUrl; }        // pixelateDataUrl
 *     if (!snapshot) return dataUrl;     // _redactScreenshotDataUrl
 *
 * Its `/screenshot` path compensates with a no-op check; its
 * auto-screenshot path does not, and cannot tell that "redacted" is the
 * raw capture. This gate is deliberately **non-co-operating**: it does
 * not ask the pipeline whether it succeeded, it checks invariants that
 * only hold if it actually did.
 *
 * SCOPE, stated honestly: this verifies *pipeline invariants*, not
 * image content. It cannot tell whether a region was drawn in the right
 * place or whether an undetected secret is still visible — only that
 * the policy ran, the collection completed, a transformation genuinely
 * occurred when regions existed, and the payload is the sanitized
 * artefact. Content-level verification needs a detector and is Tier 3's
 * job. Do not describe this as proving an image is free of PII.
 */

const REQUIRED_BOOLEANS = ["redactionEnabled", "snapshotOk", "snapshotStable", "regionCollectionComplete"];
const REQUIRED_STRINGS = ["rawDataUrl", "sanitizedDataUrl", "payloadDataUrl"];
const ALLOWED_KEYS = new Set([...REQUIRED_BOOLEANS, ...REQUIRED_STRINGS, "regions"]);

function fail(reasons) {
  return { allowed: false, reasons };
}

function validRegion(r) {
  if (!r || typeof r !== "object") return false;
  const rect = r.rect;
  if (!rect || typeof rect !== "object") return false;
  for (const k of ["x", "y", "w", "h"]) {
    if (typeof rect[k] !== "number" || !Number.isFinite(rect[k])) return false;
  }
  return rect.w > 0 && rect.h > 0;
}

/**
 * @param {object} capture
 * @param {boolean} capture.redactionEnabled        privacy policy was on
 * @param {boolean} capture.snapshotOk              a valid privacy snapshot existed
 * @param {boolean} capture.snapshotStable          before/after snapshots matched (T16)
 * @param {boolean} capture.regionCollectionComplete all frames reported successfully
 * @param {object[]} capture.regions                regions the collector found
 * @param {string} capture.rawDataUrl               the untouched capture
 * @param {string} capture.sanitizedDataUrl         the redactor's output
 * @param {string} capture.payloadDataUrl           what will actually be sent
 * @returns {{allowed: boolean, reasons: string[]}} never throws
 */
function assertCaptureSafeForEgress(capture) {
  try {
    if (capture === null || typeof capture !== "object" || Array.isArray(capture)) {
      return fail(["capture is not an object"]);
    }

    // Unknown state is not safe state: refuse shapes we do not model,
    // so a future field cannot silently widen what is permitted.
    for (const key of Object.keys(capture)) {
      if (!ALLOWED_KEYS.has(key)) {
        return fail([`unexpected/unrecognised field on capture: "${key}"`]);
      }
    }

    const reasons = [];

    for (const key of REQUIRED_BOOLEANS) {
      if (!(key in capture)) reasons.push(`missing required field "${key}"`);
      else if (typeof capture[key] !== "boolean") {
        reasons.push(`"${key}" must be a boolean, not ${typeof capture[key]}`);
      }
    }
    for (const key of REQUIRED_STRINGS) {
      if (!(key in capture)) reasons.push(`missing required field "${key}"`);
      else if (typeof capture[key] !== "string" || capture[key].length === 0) {
        reasons.push(`"${key}" must be a non-empty string`);
      }
    }
    if (!("regions" in capture)) reasons.push('missing required field "regions"');
    else if (!Array.isArray(capture.regions)) reasons.push("regions must be an array");

    // Shape problems make every later check meaningless — stop here.
    if (reasons.length > 0) return fail(reasons);

    // Invariant 1: the policy was actually on.
    if (capture.redactionEnabled !== true) {
      reasons.push("privacy policy was disabled for this capture");
    }
    // Invariant 2: a valid privacy snapshot existed.
    if (capture.snapshotOk !== true) {
      reasons.push("no valid privacy snapshot was available for this capture");
    }
    // Invariant 2b (T16): the page did not mutate between region
    // collection and capture. See privacy/snapshotStability.js — the
    // caller computes this with assertSnapshotsStable(before, after).
    if (capture.snapshotStable !== true) {
      reasons.push("the page changed between region collection and capture (TOCTOU); redaction boxes may be stale");
    }
    // Invariant 3: region collection completed across all frames.
    if (capture.regionCollectionComplete !== true) {
      reasons.push("region collection did not complete (a frame failed inspection or overflowed)");
    }

    for (const [i, region] of capture.regions.entries()) {
      if (!validRegion(region)) reasons.push(`region at index ${i} is malformed`);
    }

    // Invariant 4 (T17): if there was something to redact, the image must
    // actually have changed. A byte-identical "sanitized" copy means the
    // transform silently no-opped.
    if (capture.regions.length > 0 && capture.sanitizedDataUrl === capture.rawDataUrl) {
      reasons.push(
        `${capture.regions.length} sensitive region(s) were found but the sanitized image is byte-identical to the raw capture (redaction no-op)`
      );
    }

    // Invariant 5: what leaves must BE the sanitized artefact.
    if (capture.payloadDataUrl !== capture.sanitizedDataUrl) {
      reasons.push("provider-bound payload is not the sanitized image");
    }

    if (reasons.length > 0) return fail(reasons);
    return { allowed: true, reasons: [] };
  } catch (err) {
    // Invariant 7: any uncertainty blocks. Never rethrow — a caller that
    // forgets a try/catch must not end up sending the payload.
    return fail([`internal error during capture egress verification: ${err && err.message}`]);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { assertCaptureSafeForEgress };
} else {
  self.assertCaptureSafeForEgress = assertCaptureSafeForEgress;
}
