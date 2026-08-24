/**
 * Tier 2: structural/semantic detection via additive confidence fusion.
 * Deterministic, rule-weighted arithmetic — not a calibrated ML model.
 * Weight table matches docs/specs/phase8-tier2-detection.md exactly.
 */

const { makeRegion } = require("./regionTypes.js");

const THRESHOLD = 0.5;

// Each rule: {test(el) -> bool, weight, category, subtype}
const RULES = [
  {
    test: (el) => el.type === "password",
    weight: 1.0,
    category: "authentication",
    subtype: "password",
  },
  {
    test: (el) => el.autocomplete === "current-password" || el.autocomplete === "new-password",
    weight: 0.9,
    category: "authentication",
    subtype: "password",
  },
  {
    test: (el) => /password/i.test(labelText(el)),
    weight: 0.9,
    category: "authentication",
    subtype: "password",
  },
  {
    test: (el) => /otp|one.?time.?code|2fa|mfa/i.test(`${el.name || ""} ${el.id || ""} ${el.autocomplete || ""}`),
    weight: 0.8,
    category: "authentication",
    subtype: "otp",
  },
  {
    test: (el) => /secret/i.test(labelText(el)),
    weight: 0.7,
    category: "authentication",
    subtype: "credential",
  },
  {
    test: (el) => /api.?key|credential/i.test(labelText(el)),
    weight: 0.6,
    category: "authentication",
    subtype: "api_key",
  },
  {
    test: (el) => /token/i.test(`${el.name || ""} ${el.id || ""}`),
    weight: 0.6,
    category: "authentication",
    subtype: "api_key",
  },
  {
    test: (el) => /card|credit|payment/i.test(labelText(el)),
    weight: 0.6,
    category: "financial",
    subtype: "card",
  },
  {
    test: (el) => el.type === "email" || el.autocomplete === "email" || /email/i.test(labelText(el)),
    weight: 0.5,
    category: "pii",
    subtype: "email",
  },
  {
    test: (el) => el.type === "tel" || el.autocomplete === "tel" || /phone/i.test(labelText(el)),
    weight: 0.5,
    category: "pii",
    subtype: "phone",
  },
];

function labelText(el) {
  return [el.label, el.ariaLabel, el.placeholder].filter(Boolean).join(" ");
}

function detectTier2Regions(rawElements) {
  const regions = [];
  for (const el of rawElements) {
    const perCategory = new Map(); // category -> {score, bestWeight, subtype}
    for (const rule of RULES) {
      if (!rule.test(el)) continue;
      const existing = perCategory.get(rule.category) || { score: 0, bestWeight: 0, subtype: rule.subtype };
      existing.score = Math.min(1.0, existing.score + rule.weight);
      if (rule.weight > existing.bestWeight) {
        existing.bestWeight = rule.weight;
        existing.subtype = rule.subtype;
      }
      perCategory.set(rule.category, existing);
    }
    for (const [category, { score, subtype }] of perCategory) {
      if (score >= THRESHOLD) {
        regions.push(
          makeRegion({
            elementId: el.id,
            category,
            subtype,
            confidence: score,
            source: "tier2-semantic",
          })
        );
      }
    }
  }
  return regions;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { detectTier2Regions };
} else {
  self.detectTier2Regions = detectTier2Regions;
}
