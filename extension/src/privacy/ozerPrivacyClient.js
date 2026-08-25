/**
 * OzerPrivacyClient — the single approved path for ALL outbound network
 * calls from the extension. Per docs/specs/phase8-tier2-detection.md
 * (Threat T9 from Phase 6, closed for real this phase): no other module
 * under extension/src/ may call fetch() — enforced by
 * extension/test/architecture/egressEnforcement.test.js.
 *
 * postSanitizedContext(): detection (Tier 1 + Tier 2) -> redaction ->
 * gate -> transport, for the extension -> server leg.
 * postTypedAction(): transport for the server -> companion leg. No
 * privacy gating needed here (a TypedAction is not page-derived
 * sensitive content — see docs/specs/privacy-contract.md) but routing
 * through this single module still closes the "any file could call
 * fetch directly" architectural gap for both legs, not just one.
 */

const { detectTier1Regions } = require("../detection/tier1Detector.js");
const { detectTier2Regions } = require("../detection/tier2Detector.js");
const { mergeRegions } = require("../detection/combineDetectors.js");
const { redactElements } = require("../redaction/redactor.js");
const { assertSafeForEgress } = require("./egressGate.js");

/**
 * @param {object[]} rawElements
 * @param {{fetch: typeof fetch, serverUrl: string, pageUrlHash: string}} deps
 * @returns {Promise<object>} the server's TypedAction response
 */
async function postSanitizedContext(rawElements, deps) {
  const { fetch, serverUrl, pageUrlHash } = deps;

  const tier1Regions = detectTier1Regions(rawElements);
  const tier2Regions = detectTier2Regions(rawElements);
  const regions = mergeRegions(tier1Regions, tier2Regions);
  const { elements, privacy } = redactElements(rawElements, regions);

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

/**
 * @param {object} typedAction
 * @param {{fetch: typeof fetch, companionUrl: string}} deps
 * @returns {Promise<object>} the companion's ExecutionResult response
 */
async function postTypedAction(typedAction, deps) {
  const { fetch, companionUrl } = deps;

  const resp = await fetch(`${companionUrl}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(typedAction),
  });
  if (!resp.ok) {
    throw new Error(`companion /execute failed: ${resp.status}`);
  }
  return resp.json();
}

const OzerPrivacyClient = { postSanitizedContext, postTypedAction };

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OzerPrivacyClient };
} else {
  self.OzerPrivacyClient = OzerPrivacyClient;
}
