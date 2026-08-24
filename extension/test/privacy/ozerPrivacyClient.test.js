const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { OzerPrivacyClient } = require("../../src/privacy/ozerPrivacyClient.js");

function makeMockFetch(response) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: response.status < 400, status: response.status, json: async () => response.body };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("detection catches a sensitive element, redaction masks it, and the gate still passes it through", async () => {
  const typedAction = { version: "1.0.0", action: "click", target_id: "el-2", value: null };
  const fetchImpl = makeMockFetch({ status: 200, body: typedAction });

  const rawElements = [
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
    { id: "el-2", role: "button", text: "Submit" },
  ];

  const result = await OzerPrivacyClient.postSanitizedContext(rawElements, {
    fetch: fetchImpl,
    serverUrl: "http://localhost:8001",
    pageUrlHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
  });

  assert.deepEqual(result, typedAction);
  const sentBody = JSON.parse(fetchImpl.calls[0].options.body);
  assert.ok(!JSON.stringify(sentBody).includes("hunter2Password!"));
  assert.equal(sentBody.privacy.redaction_applied, true);
});

test("client throws before any network call when the gate would block", async () => {
  const fetchImpl = makeMockFetch({ status: 200, body: {} });

  // A raw element with an unknown role bypasses detection entirely and
  // should be caught by the gate's own structural check, not silently sent.
  const rawElements = [{ id: "el-1", role: "some-unknown-role", text: "hi" }];

  await assert.rejects(
    () =>
      OzerPrivacyClient.postSanitizedContext(rawElements, {
        fetch: fetchImpl,
        serverUrl: "http://localhost:8001",
        pageUrlHash: "abc",
      }),
    /privacy gate blocked/i
  );
  assert.equal(fetchImpl.calls.length, 0, "no network call should have been made");
});

test("roundtrip.js does not call fetch directly for the server leg — it goes through OzerPrivacyClient", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../src/roundtrip.js"), "utf8");
  assert.ok(
    source.includes("OzerPrivacyClient") || source.includes("postSanitizedContext"),
    "roundtrip.js must route the server call through OzerPrivacyClient"
  );
  // A direct `fetch(` call to the server URL, outside the client module,
  // would be the exact Threat T9 regression this test is meant to catch.
  const serverFetchCallOutsideClient = /fetch\(\s*`\$\{serverUrl\}/;
  assert.ok(
    !serverFetchCallOutsideClient.test(source),
    "roundtrip.js must not call fetch directly against serverUrl"
  );
});
