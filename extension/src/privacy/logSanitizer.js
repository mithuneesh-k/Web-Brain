/**
 * Logging boundary: converts a SanitizedContext (or any object) into an
 * allowlist-only projection safe to write to structured logs.
 *
 * This is an ALLOWLIST, not a denylist, deliberately: a new field added
 * to SanitizedContext in a future phase is excluded from logs by
 * default until someone deliberately adds it here. See
 * docs/architecture/privacy-data-flow.md, "Logging leg."
 */

function sanitizeForLogging(context) {
  if (context === null || typeof context !== "object") {
    return { note: "unloggable input (not an object)" };
  }

  const out = {};

  if (typeof context.version === "string") out.version = context.version;
  if (typeof context.timestamp === "string") out.timestamp = context.timestamp;
  if (typeof context.page_url_hash === "string") out.page_url_hash = context.page_url_hash;
  if (Array.isArray(context.elements)) out.element_count = context.elements.length;

  const privacy = context.privacy;
  if (privacy && typeof privacy === "object") {
    if (typeof privacy.redaction_applied === "boolean") {
      out.redaction_applied = privacy.redaction_applied;
    }
    if (Array.isArray(privacy.redaction_types)) {
      out.redaction_types = privacy.redaction_types.slice();
    }
  }

  return out;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanitizeForLogging };
} else {
  self.sanitizeForLogging = sanitizeForLogging;
}
