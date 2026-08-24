/**
 * Deterministic, narrow pattern checks used by the Phase 6 privacy gate.
 *
 * STUB / DEFENSE-IN-DEPTH ONLY: these are not a general PII/secret
 * detector. Real detection is Phase 7's job. This module exists so the
 * gate has *something* deterministic to check against without any
 * external model, per the Phase 6 constraint that no test may depend on
 * one. Expect real-world false negatives — documented, not hidden, in
 * docs/specs/privacy-contract.md.
 */

const PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  // Common API-key-shaped prefixes (sk-, gsk_, AKIA, ghp_) plus a long
  // opaque-token heuristic (20+ contiguous alphanumeric/underscore/dash
  // characters with no spaces).
  apiKey: /\b(sk-[A-Za-z0-9]{16,}|gsk_[A-Za-z0-9]{16,}|AKIA[A-Za-z0-9]{12,}|ghp_[A-Za-z0-9]{16,}|[A-Za-z0-9_-]{24,})\b/,
  // A crude "this looks like a typed password" heuristic: 6+ chars,
  // mixes letters and digits or symbols, no spaces. Intentionally
  // narrow — real password detection needs field-type context (Phase 7).
  passwordShaped: /^(?=.*[A-Za-z])(?=.*[\d!@#$%^&*])[A-Za-z\d!@#$%^&*]{6,}$/,
};

const ALLOWED_ELEMENT_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "heading",
  "text",
  "image",
]);

const ALLOWED_REDACTION_TYPES = new Set(["pii", "authentication", "financial", "visual_identity"]);

function matchesAnySensitivePattern(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  if (PATTERNS.email.test(text)) return "email";
  if (PATTERNS.apiKey.test(text)) return "api_key";
  if (PATTERNS.passwordShaped.test(text)) return "password";
  return null;
}

module.exports = {
  PATTERNS,
  ALLOWED_ELEMENT_ROLES,
  ALLOWED_REDACTION_TYPES,
  matchesAnySensitivePattern,
};
