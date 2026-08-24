const test = require("node:test");
const assert = require("node:assert/strict");
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

test("Tier 1 + Tier 2 detection catches a sensitive element, redaction masks it, and the gate still passes it through", async () => {
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

test("Tier 2 alone (no Tier 1 match) still triggers redaction — e.g. a label-only signal", async () => {
  const typedAction = { version: "1.0.0", action: "noop", target_id: null, value: null };
  const fetchImpl = makeMockFetch({ status: 200, body: typedAction });

  const rawElements = [
    { id: "el-1", role: "textbox", ariaLabel: "Your secret phrase" },
  ];

  await OzerPrivacyClient.postSanitizedContext(rawElements, {
    fetch: fetchImpl,
    serverUrl: "http://localhost:8001",
    pageUrlHash: "abc",
  });

  const sentBody = JSON.parse(fetchImpl.calls[0].options.body);
  assert.equal(sentBody.elements[0].redacted, true);
});

test("client throws before any network call when the gate would block", async () => {
  const fetchImpl = makeMockFetch({ status: 200, body: {} });
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

test("postTypedAction forwards a TypedAction to the companion and returns the ExecutionResult", async () => {
  const typedAction = { version: "1.0.0", action: "click", target_id: "el-1", value: null };
  const executionResult = { version: "1.0.0", status: "ok", detail: "stub execution: click on el-1 acknowledged" };
  const fetchImpl = makeMockFetch({ status: 200, body: executionResult });

  const result = await OzerPrivacyClient.postTypedAction(typedAction, {
    fetch: fetchImpl,
    companionUrl: "http://localhost:8002",
  });

  assert.deepEqual(result, executionResult);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, "http://localhost:8002/execute");
});

test("postTypedAction throws if the companion call fails", async () => {
  const fetchImpl = makeMockFetch({ status: 500, body: {} });
  await assert.rejects(
    () =>
      OzerPrivacyClient.postTypedAction(
        { version: "1.0.0", action: "noop", target_id: null, value: null },
        { fetch: fetchImpl, companionUrl: "http://localhost:8002" }
      ),
    /companion \/execute failed/
  );
});

// The authoritative, comment-aware version of this check lives in
// extension/test/architecture/egressEnforcement.test.js, which scans
// every file under extension/src/ (not just this one) and strips
// comments before matching, so it isn't fooled by this file's own
// docstrings mentioning "fetch(" in prose.
