/**
 * Merges SensitiveRegion[] arrays from multiple detectors (Tier 1,
 * Tier 2, and eventually Tier 3) into one flat array. Deliberately does
 * NOT deduplicate across detectors — the redactor treats "any region
 * covering this element" as sufficient to redact, so keeping both a
 * Tier 1 and a Tier 2 finding for the same element is harmless and
 * preserves provenance (useful for future benchmark/debugging work).
 */

function mergeRegions(...regionArrays) {
  return regionArrays.flat();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { mergeRegions };
} else {
  self.mergeRegions = mergeRegions;
}
