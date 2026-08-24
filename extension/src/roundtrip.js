/**
 * Core round-trip logic, extracted from background.js so it is testable
 * with `node --test` without a real browser. STUB phase (Phase 5): the
 * sanitized context here is fixed/fake, not derived from a real page —
 * real DOM extraction and sanitization arrive in Phase 7.
 *
 * @param {{fetch: typeof fetch, serverUrl: string, companionUrl: string}} deps
 * @returns {Promise<{typedAction: object, executionResult: object}>}
 */
async function runRoundTrip(deps) {
  const { fetch, serverUrl, companionUrl } = deps;

  const sanitizedContext = {
    version: "1.0.0",
    page_url_hash:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
    elements: [{ id: "el-1", role: "button", text: "Say hello" }],
    timestamp: new Date().toISOString(),
  };

  const reasonResp = await fetch(`${serverUrl}/reason`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitizedContext),
  });
  if (!reasonResp.ok) {
    throw new Error(`server /reason failed: ${reasonResp.status}`);
  }
  const typedAction = await reasonResp.json();

  const executeResp = await fetch(`${companionUrl}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(typedAction),
  });
  if (!executeResp.ok) {
    throw new Error(`companion /execute failed: ${executeResp.status}`);
  }
  const executionResult = await executeResp.json();

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
