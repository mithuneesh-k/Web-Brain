/**
 * The network egress gate — the single required checkpoint between a
 * SanitizedContext and any outbound network call, per
 * docs/specs/privacy-contract.md and CONTEXT.md's architectural
 * invariant. Fail-closed: any ambiguity, unrecognized shape, or
 * internal error results in {allowed: false}, never a silent pass.
 *
 * This module does NOT perform general PII detection — see
 * privacy/patterns.js's own header comment. It is a deterministic
 * contract-shape and pattern sanity net, not a substitute for Phase 7's
 * real detector.
 */

const {
  ALLOWED_ELEMENT_ROLES,
  ALLOWED_REDACTION_TYPES,
  matchesAnySensitivePattern,
} = require("./patterns.js");

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "version",
  "page_url_hash",
  "elements",
  "privacy",
  "timestamp",
]);
const ALLOWED_ELEMENT_KEYS = new Set(["id", "role", "text", "redacted"]);
const REQUIRED_PRIVACY_KEYS = [
  "redaction_applied",
  "redacted_regions",
  "redaction_types",
  "visual_context_version",
];

function fail(reasons) {
  return { allowed: false, reasons };
}

function pass() {
  return { allowed: true, reasons: [] };
}

/**
 * @param {object} context - a would-be SanitizedContext
 * @returns {{allowed: boolean, reasons: string[]}}
 */
function assertSafeForEgress(context) {
  try {
    if (context === null || typeof context !== "object") {
      return fail(["context is not an object"]);
    }

    // Defensive canary: a well-formed SanitizedContext must be JSON
    // serializable (it travels over HTTP as JSON). This also converts
    // pathological inputs (circular references, etc.) into the
    // fail-closed catch branch below instead of an uncaught crash.
    JSON.stringify(context);

    // Structural check: no unexpected top-level fields (catches an
    // attempted screenshot/raw-payload field before anything else runs).
    for (const key of Object.keys(context)) {
      if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
        return fail([`unexpected field not permitted on SanitizedContext: "${key}"`]);
      }
    }

    if (context.version !== "1.1.0") {
      return fail([`unsupported SanitizedContext version: ${context.version}`]);
    }

    // Privacy metadata must be present and complete.
    const privacy = context.privacy;
    if (privacy === null || typeof privacy !== "object") {
      return fail(["invalid privacy metadata: missing privacy object"]);
    }
    for (const key of REQUIRED_PRIVACY_KEYS) {
      if (!(key in privacy)) {
        return fail([`invalid privacy metadata: missing required field "${key}"`]);
      }
    }
    if (typeof privacy.redaction_applied !== "boolean") {
      return fail(["invalid privacy metadata: redaction_applied must be boolean"]);
    }
    if (!Array.isArray(privacy.redacted_regions) || !Array.isArray(privacy.redaction_types)) {
      return fail(["invalid privacy metadata: redacted_regions/redaction_types must be arrays"]);
    }
    for (const t of privacy.redaction_types) {
      if (!ALLOWED_REDACTION_TYPES.has(t)) {
        return fail([`invalid privacy metadata: unknown redaction_type "${t}"`]);
      }
    }

    if (!Array.isArray(context.elements)) {
      return fail(["elements must be an array"]);
    }

    const reasons = [];
    for (const el of context.elements) {
      if (el === null || typeof el !== "object") {
        return fail(["element is not an object"]);
      }
      for (const key of Object.keys(el)) {
        if (!ALLOWED_ELEMENT_KEYS.has(key)) {
          return fail([`unexpected field not permitted on element: "${key}"`]);
        }
      }
      if (!ALLOWED_ELEMENT_ROLES.has(el.role)) {
        return fail([`unknown element role/classification: "${el.role}"`]);
      }

      const match = matchesAnySensitivePattern(el.text);
      const claimedRedacted = el.redacted === true;

      if (match && claimedRedacted) {
        reasons.push(
          `element "${el.id}" claims redaction but still contains a sensitive-shaped value (leftover ${match})`
        );
      } else if (match && !claimedRedacted) {
        reasons.push(`element "${el.id}" contains an unredacted sensitive-shaped value (${match})`);
      }
    }

    if (reasons.length > 0) {
      return fail(reasons);
    }

    return pass();
  } catch (err) {
    return fail([`internal error during privacy validation: ${err && err.message}`]);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { assertSafeForEgress };
} else {
  self.assertSafeForEgress = assertSafeForEgress;
}
