/**
 * Region producer — the bridge from "this element is sensitive" to
 * "these exact screenshot pixels are sensitive".
 *
 * DESIGN RULE, deliberately enforced: this module performs NO detection.
 * It never inspects text, attributes, labels, or values. Given a
 * detection someone else made, its only job is to answer *where that
 * element is in the captured image*. Re-detecting here would create a
 * second, divergent source of privacy truth — the exact failure mode
 * ADR 0006 term 3 exists to prevent.
 *
 * FAIL-CLOSED: an element we cannot measure, or a category the redactor
 * would not know how to handle, throws. A detection that silently
 * produced no region would leave sensitive pixels in the image with
 * nothing anywhere recording that we failed.
 *
 * NOT-VISIBLE is different from FAILURE: an element scrolled out of the
 * captured area, or of zero size, is genuinely absent from the image and
 * is omitted. Its text is still handled by Tier 1/2 text redaction.
 */

const { domRectToScreenshotBox } = require("./domGeometry.js");
const { ALLOWED_REDACTION_TYPES } = require("../privacy/patterns.js");

class RegionProducerError extends Error {
  constructor(message) {
    super(message);
    this.name = "RegionProducerError";
  }
}

/**
 * @param {object[]} detections - [{element, elementId, category, subtype, confidence, source}]
 * @param {object} viewport - forwarded to domRectToScreenshotBox
 * @returns {object[]} SensitiveRegion[] with real boundingBox values
 */
function produceRegions(detections, viewport) {
  if (!Array.isArray(detections)) {
    throw new RegionProducerError("detections must be an array");
  }

  const regions = [];

  for (const d of detections) {
    if (!d || typeof d !== "object") {
      throw new RegionProducerError("detection is not an object");
    }
    if (!ALLOWED_REDACTION_TYPES.has(d.category)) {
      throw new RegionProducerError(
        `detection has unknown category "${d.category}"; the redactor could not choose a mode for it`
      );
    }
    const element = d.element;
    if (!element || typeof element.getBoundingClientRect !== "function") {
      throw new RegionProducerError(
        `detection for "${d.elementId}" has no measurable element (getBoundingClientRect missing)`
      );
    }

    // Geometry errors propagate: a confidently-wrong box is worse than none.
    const placed = domRectToScreenshotBox(element.getBoundingClientRect(), viewport);

    if (!placed.visible) continue; // genuinely not in this image

    regions.push({
      id: `${d.elementId}-${d.source}-${d.subtype}`,
      elementId: d.elementId,
      category: d.category,
      subtype: d.subtype,
      confidence: d.confidence,
      source: d.source,
      boundingBox: placed.boundingBox,
    });
  }

  return regions;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { produceRegions, RegionProducerError };
} else {
  self.produceRegions = produceRegions;
  self.RegionProducerError = RegionProducerError;
}
