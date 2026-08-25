/**
 * Tier 1 local detection: deterministic DOM-signal and pattern-based
 * detectors. Per docs/specs/phase7-local-detection.md — cheap, high
 * confidence, no model. Tier 2 (broader structural/semantic signals)
 * and Tier 3 (visual/ML) are explicitly out of scope here.
 *
 * Input elements are a plain JS shape, not a real DOM node — a future
 * content script is responsible for producing this shape from a live
 * page; that extraction is not built in this phase.
 */

const { PATTERNS } = require("../privacy/patterns.js");

const OTP_FIELD_RE = /otp|one.?time.?code|2fa|mfa.?code/i;
const PASSWORD_FIELD_RE = /pass(word)?/i;
const API_KEY_FIELD_RE = /api.?key|api.?token|access.?token|secret.?key/i;
const PHONE_SHAPED_RE = /^[+]?[\d\s().-]{7,20}$/;

function digitsOnly(text) {
  return (text || "").replace(/[\s-]/g, "");
}

function phoneDigitCount(text) {
  return (text || "").replace(/\D/g, "").length;
}

function isLuhnValid(digits) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * @param {object} el - {id, role, type?, name?, autocomplete?, ariaLabel?, text}
 * @returns {{sensitive: boolean, types: string[], reasons: string[]}}
 */
function classifyElement(el) {
  const types = new Set();
  const reasons = [];

  const type = el.type || "";
  const name = el.name || "";
  const id = el.id || "";
  const autocomplete = el.autocomplete || "";
  const ariaLabel = el.ariaLabel || "";
  const text = el.text || "";
  const fieldIdentifiers = `${name} ${id} ${ariaLabel}`;

  // Password
  if (type === "password" || PASSWORD_FIELD_RE.test(fieldIdentifiers)) {
    types.add("authentication");
    reasons.push("password field");
  }

  // OTP
  if (OTP_FIELD_RE.test(`${fieldIdentifiers} ${autocomplete}`) || autocomplete === "one-time-code") {
    types.add("authentication");
    reasons.push("otp field");
  }

  // API key / token
  if (API_KEY_FIELD_RE.test(fieldIdentifiers) || PATTERNS.apiKey.test(text)) {
    types.add("authentication");
    reasons.push("api key / token");
  }

  // Email
  if (type === "email" || PATTERNS.email.test(text)) {
    types.add("pii");
    reasons.push("email");
  }

  // Phone — ITU E.164 max length is 15 digits; anything longer (e.g. a
  // credit card number) must not be misclassified as a phone number.
  const phoneDigits = phoneDigitCount(text);
  if (type === "tel" || (PHONE_SHAPED_RE.test(text) && phoneDigits >= 7 && phoneDigits <= 15)) {
    types.add("pii");
    reasons.push("phone number");
  }

  // Credit card (Luhn-validated)
  const digits = digitsOnly(text);
  if (isLuhnValid(digits)) {
    types.add("financial");
    reasons.push("credit card number (Luhn-valid)");
  }

  return { sensitive: types.size > 0, types: Array.from(types), reasons };
}

/**
 * @param {object[]} rawElements
 * @returns {object[]} each element annotated with sensitive/types/reasons
 */
function detectSensitiveElements(rawElements) {
  return rawElements.map((el) => ({ ...el, ...classifyElement(el) }));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { detectSensitiveElements, classifyElement, isLuhnValid };
} else {
  self.detectSensitiveElements = detectSensitiveElements;
}
