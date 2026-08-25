/**
 * Tier 1 adapter: wraps domDetector.js's classification output (Phase 7,
 * unchanged) into the normalized SensitiveRegion contract (Phase 8), so
 * the redactor never needs Tier-1-specific knowledge.
 */

const { detectSensitiveElements } = require("./domDetector.js");
const { makeRegion } = require("./regionTypes.js");

function detectTier1Regions(rawElements) {
  const classified = detectSensitiveElements(rawElements);
  const regions = [];
  for (const el of classified) {
    if (!el.sensitive) continue;
    for (const category of el.types) {
      regions.push(
        makeRegion({
          elementId: el.id,
          category,
          subtype: el.reasons[0] || category,
          confidence: 1.0,
          source: "tier1-dom-pattern",
        })
      );
    }
  }
  return regions;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { detectTier1Regions };
} else {
  self.detectTier1Regions = detectTier1Regions;
}
