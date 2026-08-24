/**
 * Core round-trip logic, extracted from background.js so it is testable
 * with `node --test` without a real browser. STUB phase (Phase 5): the
 * raw elements here are fixed/fake, not derived from a real page — real
 * DOM extraction from a live page is not built yet.
 *
 * Phase 6: the server leg is gated by assertSafeForEgress() before any
 * network call.
 *
 * Phase 7: the server leg goes through OzerPrivacyClient
 * (detection -> redaction -> gate -> transport) instead of building a
 * SanitizedContext and calling fetch directly here.
 *
 * Phase 8: the companion leg ALSO goes through OzerPrivacyClient
 * (postTypedAction), so this file makes zero direct fetch() calls at
 * all — enforced by extension/test/architecture/egressEnforcement.test.js,
 * which scans every file under extension/src/ except
 * privacy/ozerPrivacyClient.js for a direct fetch() call.
 *
 * @param {{fetch: typeof fetch, serverUrl: string, companionUrl: string}} deps
 * @returns {Promise<{typedAction: object, executionResult: object}>}
 */
const { OzerPrivacyClient } =
  typeof module !== "undefined" && module.exports
    ? require("./privacy/ozerPrivacyClient.js")
    : self;

async function runRoundTrip(deps) {
  const { fetch, serverUrl, companionUrl } = deps;

  const rawElements = [{ id: "el-1", role: "button", text: "Say hello" }];
  const pageUrlHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85";

  const typedAction = await OzerPrivacyClient.postSanitizedContext(rawElements, {
    fetch,
    serverUrl,
    pageUrlHash,
  });

  const executionResult = await OzerPrivacyClient.postTypedAction(typedAction, {
    fetch,
    companionUrl,
  });

  return { typedAction, executionResult };
}

// Dual-environment export: CommonJS for `node --test`, plain global for
// the Manifest V3 service worker (loaded via importScripts, no bundler
// in this phase).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { runRoundTrip };
} else {
  self.runRoundTrip = runRoundTrip;
}
