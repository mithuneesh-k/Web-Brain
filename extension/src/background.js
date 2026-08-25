/**
 * Extension background script (Manifest V3 service worker).
 * STUB phase (Phase 5): wires the real browser-extension entry point to
 * the pure, tested runRoundTrip() logic in roundtrip.js. No real DOM
 * extraction or privacy gate exists yet — see docs/specs/phase5-reproducible-baseline.md.
 */
importScripts(
  "privacy/patterns.js",
  "privacy/egressGate.js",
  "detection/regionTypes.js",
  "detection/domDetector.js",
  "detection/tier1Detector.js",
  "detection/tier2Detector.js",
  "detection/combineDetectors.js",
  "redaction/redactor.js",
  "privacy/ozerPrivacyClient.js",
  "roundtrip.js"
);

const SERVER_URL = "http://localhost:8001";
const COMPANION_URL = "http://localhost:8002";

// Keep helloWorld for legacy compatibility
async function helloWorld() {
  const result = await runRoundTrip({
    fetch,
    serverUrl: SERVER_URL,
    companionUrl: COMPANION_URL,
  });
  console.log("Ozer Phase 5 hello-world round trip:", result);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "run_agent") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab.");

        // 1. Extract DOM via content script
        const domResult = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_DOM" });
        if (!domResult || !domResult.elements) throw new Error("Could not extract DOM from page.");

        // We can pass the user prompt by appending a dummy element (hack for prototype)
        const elements = domResult.elements;
        elements.unshift({ id: "prompt", role: "text", text: `USER GOAL: ${message.prompt}` });

        // 2. Call Ozer's privacy pipeline (this does detection, redaction, and sends to local model)
        const typedAction = await OzerPrivacyClient.postSanitizedContext(elements, {
          fetch,
          serverUrl: SERVER_URL,
          pageUrlHash: "dummy-hash" // Or generate a real hash
        });

        // 3. Send action back to content script for execution
        const execResult = await chrome.tabs.sendMessage(tab.id, {
          type: "EXECUTE_ACTION",
          actionPayload: typedAction
        });

        sendResponse({ result: execResult.result });
      } catch (err) {
        console.error("Agent error:", err);
        sendResponse({ error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Ozer extension installed (Local Agent Mode)");
});

self.ozerHelloWorld = helloWorld;
