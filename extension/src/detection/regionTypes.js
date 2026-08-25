/**
 * The normalized SensitiveRegion contract every detector (Tier 1, 2,
 * and eventually 3) emits, per docs/specs/phase8-tier2-detection.md.
 * The redactor consumes only this shape — it never needs to know which
 * detector produced a region.
 */

const { ALLOWED_REDACTION_TYPES } = require("../privacy/patterns.js");

function makeRegion({ elementId, category, subtype, confidence, source, boundingBox = null }) {
  if (!ALLOWED_REDACTION_TYPES.has(category)) {
    throw new Error(`invalid SensitiveRegion category: ${category}`);
  }
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error(`invalid SensitiveRegion confidence: ${confidence}`);
  }
  return {
    id: `${elementId}-${source}-${subtype}`,
    elementId,
    category,
    subtype,
    confidence,
    source,
    boundingBox,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { makeRegion };
} else {
  self.makeRegion = makeRegion;
}
