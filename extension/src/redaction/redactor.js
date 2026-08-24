/**
 * Redaction: turns detector output into the elements/privacy blocks of
 * a SanitizedContext (schema v1.1.0). Sensitive elements get their text
 * replaced with a type-labeled mask; everything else passes through
 * unchanged. Per docs/specs/phase7-local-detection.md — masking only in
 * this phase, no bounding-box/visual redaction (that's Tier 3).
 *
 * ALLOWED_ELEMENT_ROLES in egressGate/patterns constrains `role` to a
 * fixed enum; the mask itself never echoes the original value.
 */

const { ALLOWED_REDACTION_TYPES } = require("../privacy/patterns.js");

function maskFor(types) {
  const label = types[0] || "sensitive";
  return `[REDACTED:${label}]`;
}

/**
 * @param {object[]} detectedElements - output of detectSensitiveElements
 * @returns {{elements: object[], privacy: object}}
 */
function redactElements(detectedElements) {
  const redactedRegions = [];
  const redactionTypes = new Set();

  const elements = detectedElements.map((el) => {
    const { sensitive, types, reasons, ...rest } = el;
    if (!sensitive) {
      return { id: rest.id, role: rest.role, text: rest.text, redacted: false };
    }
    redactedRegions.push(rest.id);
    for (const t of types) {
      if (ALLOWED_REDACTION_TYPES.has(t)) redactionTypes.add(t);
    }
    return { id: rest.id, role: rest.role, text: maskFor(types), redacted: true };
  });

  const privacy = {
    redaction_applied: redactedRegions.length > 0,
    redacted_regions: redactedRegions,
    redaction_types: Array.from(redactionTypes),
    visual_context_version: "tier1-dom-v1",
  };

  return { elements, privacy };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { redactElements };
} else {
  self.redactElements = redactElements;
}
