/**
 * Redaction: consumes the normalized SensitiveRegion[] contract (Phase 8)
 * — never detector-specific output — and produces the elements/privacy
 * blocks of a SanitizedContext (schema v1.1.0). Any element covered by
 * one or more regions (from any detector/tier) gets its text replaced
 * with a type-labeled mask; everything else passes through unchanged.
 */

const { ALLOWED_REDACTION_TYPES } = require("../privacy/patterns.js");

function maskFor(categories) {
  const label = categories[0] || "sensitive";
  return `[REDACTED:${label}]`;
}

/**
 * @param {object[]} rawElements - {id, role, text, ...}
 * @param {object[]} regions - SensitiveRegion[] from any detector(s)
 * @returns {{elements: object[], privacy: object}}
 */
function redactElements(rawElements, regions) {
  const regionsByElement = new Map();
  for (const r of regions) {
    const list = regionsByElement.get(r.elementId) || [];
    list.push(r);
    regionsByElement.set(r.elementId, list);
  }

  const redactedRegions = [];
  const redactionTypes = new Set();

  const elements = rawElements.map((el) => {
    const covering = regionsByElement.get(el.id);
    if (!covering || covering.length === 0) {
      return { id: el.id, role: el.role, text: el.text, redacted: false };
    }
    redactedRegions.push(el.id);
    const categories = [];
    for (const region of covering) {
      if (ALLOWED_REDACTION_TYPES.has(region.category)) {
        redactionTypes.add(region.category);
        categories.push(region.category);
      }
    }
    return { id: el.id, role: el.role, text: maskFor(categories), redacted: true };
  });

  const privacy = {
    redaction_applied: redactedRegions.length > 0,
    redacted_regions: redactedRegions,
    redaction_types: Array.from(redactionTypes),
    visual_context_version: "tier1-tier2-v1",
  };

  return { elements, privacy };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { redactElements };
} else {
  self.redactElements = redactElements;
}
