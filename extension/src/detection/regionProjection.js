/**
 * SensitiveRegion -> WebBrain region projection (Phase 12B).
 *
 * This is the join that makes one screenshot pipeline with several
 * region producers, instead of two competing privacy systems.
 *
 * THE INVARIANT THIS PRESERVES (Phase 11B):
 *   WebBrain only needs GEOMETRY to transform pixels — `pixelateDataUrl`
 *   reads `region.rect` and never reads `kind`. Ozer owns the MEANING of
 *   why that geometry is sensitive.
 *
 * So `SensitiveRegion` stays canonical. WebBrain's four-value `kind`
 * enum is a downstream label, never Ozer's privacy model. The full
 * region — `id`, `elementId`, `category`, `subtype`, `confidence`,
 * `source` — is returned alongside the projection and is what Ozer's
 * own gates, audit, and privacy metadata continue to use.
 *
 * THE ADAPTER MAKES NO PRIVACY DECISION. It does not filter by
 * confidence, inspect text, re-detect, or drop anything. Deciding what
 * is sensitive belongs to the detectors; deciding what may leave belongs
 * to the egress gates. This is a format conversion and nothing else.
 *
 * COORDINATE SPACE IS REQUIRED, NEVER INFERRED. Ozer's `boundingBox`
 * from `domGeometry` is in IMAGE pixels (DPR already applied), whereas
 * WebBrain's `mapRegionsToImage` expects CSS pixels and scales them.
 * Feeding one into the other double-scales every box. There is
 * deliberately no default:
 *   - `space: 'image'` -> inject after mapRegionsToImage, straight to
 *     pixelateDataUrl.
 *   - `space: 'css'`   -> may go through mapRegionsToImage with the rest.
 */

const { ALLOWED_REDACTION_TYPES } = require("../privacy/patterns.js");

class ProjectionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectionError";
  }
}

const SPACES = new Set(["image", "css"]);

/**
 * Ozer category -> WebBrain REGION_KIND.
 *
 * Total by construction: every Ozer category has an entry, so nothing is
 * ever dropped for lacking an upstream equivalent. `financial` and
 * `visual_identity` have no real counterpart in WebBrain's enum
 * (password|input|email|phone) and map to `input`. That is a **label**
 * compromise, not a privacy one — the region is still redacted, and its
 * true category survives on the canonical object.
 */
const CATEGORY_TO_KIND = Object.freeze({
  authentication: "password",
  pii: "email",
  financial: "input",
  visual_identity: "input",
});

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Convert to integer pixel bounds that never crop the region: the origin
 * floors and the far edge ceils. Shrinking a sensitive box by a
 * sub-pixel would leave a sliver of the original visible.
 */
function toIntegerRect(box, regionId) {
  for (const k of ["x", "y", "width", "height"]) {
    if (!finite(box[k])) {
      throw new ProjectionError(`region "${regionId}" boundingBox.${k} is not a finite number`);
    }
  }
  if (box.width <= 0 || box.height <= 0) {
    throw new ProjectionError(`region "${regionId}" boundingBox has non-positive dimensions`);
  }
  const x = Math.floor(box.x);
  const y = Math.floor(box.y);
  return {
    x,
    y,
    w: Math.ceil(box.x + box.width) - x,
    h: Math.ceil(box.y + box.height) - y,
  };
}

/**
 * @param {object[]} regions - Ozer SensitiveRegion[]
 * @param {{space: 'image'|'css'}} options - REQUIRED; never inferred
 * @returns {{space: string, regions: {kind: string, rect: object}[], canonical: object[]}}
 * @throws {ProjectionError}
 */
function projectSensitiveRegions(regions, options = {}) {
  const space = options.space;
  if (!SPACES.has(space)) {
    throw new ProjectionError(
      `coordinate space must be explicitly 'image' or 'css' (got ${JSON.stringify(space)}); ` +
        "guessing would double-scale or under-scale every region"
    );
  }
  if (!Array.isArray(regions)) {
    throw new ProjectionError("regions must be an array");
  }

  const projected = [];
  const canonical = [];

  for (const region of regions) {
    if (!region || typeof region !== "object") {
      throw new ProjectionError("region is not an object");
    }
    const id = region.id || "<unidentified>";
    if (!ALLOWED_REDACTION_TYPES.has(region.category)) {
      throw new ProjectionError(
        `region "${id}" has unknown category "${region.category}"; refusing to guess a kind`
      );
    }
    const box = region.boundingBox;
    if (!box || typeof box !== "object") {
      throw new ProjectionError(
        `region "${id}" has no boundingBox; it cannot be projected into a pixel pipeline`
      );
    }

    projected.push({ kind: CATEGORY_TO_KIND[region.category], rect: toIntegerRect(box, id) });
    canonical.push(region);
  }

  return { space, regions: projected, canonical };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { projectSensitiveRegions, ProjectionError, CATEGORY_TO_KIND };
} else {
  self.projectSensitiveRegions = projectSensitiveRegions;
  self.ProjectionError = ProjectionError;
}
