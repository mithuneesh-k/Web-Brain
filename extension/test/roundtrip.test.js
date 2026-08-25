const test = require("node:test");
const assert = require("node:assert/strict");
const { runRoundTrip } = require("../src/roundtrip.js");

function makeMockFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const match = responses.find((r) => url.startsWith(r.urlPrefix));
    if (!match) {
      throw new Error(`no mock response configured for ${url}`);
    }
    return {
      ok: match.status < 400,
      status: match.status,
      json: async () => match.body,
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test("runRoundTrip posts sanitized context, then the returned action, and returns both results", async () => {
  const typedAction = { version: "1.0.0", action: "click", target_id: "el-1", value: null };
  const executionResult = { version: "1.0.0", status: "ok", detail: "stub execution: click on el-1 acknowledged" };

  const fetchImpl = makeMockFetch([
    { urlPrefix: "http://localhost:8001/reason", status: 200, body: typedAction },
    { urlPrefix: "http://localhost:8002/execute", status: 200, body: executionResult },
  ]);

  const result = await runRoundTrip({
    fetch: fetchImpl,
    serverUrl: "http://localhost:8001",
    companionUrl: "http://localhost:8002",
  });

  assert.deepEqual(result.typedAction, typedAction);
  assert.deepEqual(result.executionResult, executionResult);
  assert.equal(fetchImpl.calls.length, 2);

  const firstBody = JSON.parse(fetchImpl.calls[0].options.body);
  assert.equal(firstBody.elements[0].id, "el-1");

  const secondBody = JSON.parse(fetchImpl.calls[1].options.body);
  assert.deepEqual(secondBody, typedAction);
});

test("runRoundTrip throws if the server call fails", async () => {
  const fetchImpl = makeMockFetch([
    { urlPrefix: "http://localhost:8001/reason", status: 500, body: {} },
  ]);

  await assert.rejects(
    () =>
      runRoundTrip({
        fetch: fetchImpl,
        serverUrl: "http://localhost:8001",
        companionUrl: "http://localhost:8002",
      }),
    /server \/reason failed/
  );
});

test("runRoundTrip throws if the companion call fails", async () => {
  const typedAction = { version: "1.0.0", action: "noop", target_id: null, value: null };
  const fetchImpl = makeMockFetch([
    { urlPrefix: "http://localhost:8001/reason", status: 200, body: typedAction },
    { urlPrefix: "http://localhost:8002/execute", status: 500, body: {} },
  ]);

  await assert.rejects(
    () =>
      runRoundTrip({
        fetch: fetchImpl,
        serverUrl: "http://localhost:8001",
        companionUrl: "http://localhost:8002",
      }),
    /companion \/execute failed/
  );
});
