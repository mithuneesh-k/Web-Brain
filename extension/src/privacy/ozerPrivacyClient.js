/**
 * OzerPrivacyClient — the single approved path from raw page elements
 * to an outbound network request. Per docs/specs/phase7-local-detection.md
 * (Threat T9 gap from Phase 6): future code should not call fetch()
 * directly against the server; it should call this instead, so
 * "detection -> redaction -> gate -> transport" cannot be silently
 * skipped by a new code path forgetting a function call.
 */

const { detectSensitiveElements } = require("../detection/domDetector.js");
const { redactElements } = require("../redaction/redactor.js");
const { assertSafeForEgress } = require("./egressGate.js");

/**
 * @param {object[]} rawElements
 * @param {{fetch: typeof fetch, serverUrl: string, pageUrlHash: string}} deps
 * @returns {Promise<object>} the server's TypedAction response
 */
async function postSanitizedContext(rawElements, deps) {
  const { fetch, serverUrl, pageUrlHash } = deps;

  const detected = detectSensitiveElements(rawElements);
  const { elements, privacy } = redactElements(detected);

  const context = {
    version: "1.1.0",
    page_url_hash: pageUrlHash,
    elements,
    privacy,
    timestamp: new Date().toISOString(),
  };

  const gateResult = assertSafeForEgress(context);
  if (!gateResult.allowed) {
    throw new Error(`privacy gate blocked egress: ${gateResult.reasons.join("; ")}`);
  }

  const resp = await fetch(`${serverUrl}/reason`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(context),
  });
  if (!resp.ok) {
    throw new Error(`server /reason failed: ${resp.status}`);
  }
  return resp.json();
}

const OzerPrivacyClient = { postSanitizedContext };

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OzerPrivacyClient };
} else {
  self.OzerPrivacyClient = OzerPrivacyClient;
}
