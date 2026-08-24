/**
 * Extension background script (Manifest V3 service worker).
 * STUB phase (Phase 5): wires the real browser-extension entry point to
 * the pure, tested runRoundTrip() logic in roundtrip.js. No real DOM
 * extraction or privacy gate exists yet — see docs/specs/phase5-reproducible-baseline.md.
 */
importScripts("privacy/patterns.js", "privacy/egressGate.js", "roundtrip.js");

const SERVER_URL = "http://localhost:8001";
const COMPANION_URL = "http://localhost:8002";

async function helloWorld() {
  const result = await runRoundTrip({
    fetch,
    serverUrl: SERVER_URL,
    companionUrl: COMPANION_URL,
  });
  console.log("Ozer Phase 5 hello-world round trip:", result);
  return result;
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Ozer extension installed (Phase 5 baseline)");
});

// Exposed for manual testing from the extension's service worker console.
self.ozerHelloWorld = helloWorld;
