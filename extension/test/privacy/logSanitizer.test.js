const test = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeForLogging } = require("../../src/privacy/logSanitizer.js");

test("Test 11: sensitive data inside a context is stripped from the log projection", () => {
  const context = {
    version: "1.1.0",
    page_url_hash: "abc123",
    elements: [
      { id: "el-1", role: "textbox", text: "someone@example.com", redacted: false },
    ],
    privacy: {
      redaction_applied: false,
      redacted_regions: [],
      redaction_types: [],
      visual_context_version: "none",
    },
    timestamp: "2026-08-24T00:00:00Z",
  };

  const logged = sanitizeForLogging(context);
  const serialized = JSON.stringify(logged);

  assert.ok(!serialized.includes("someone@example.com"), "raw email must not appear in log output");
  assert.ok(!("elements" in logged), "raw elements array must not appear in log output");
  assert.equal(logged.version, "1.1.0");
  assert.equal(logged.element_count, 1);
});

test("sanitizeForLogging never throws, even on malformed input", () => {
  assert.doesNotThrow(() => sanitizeForLogging(null));
  assert.doesNotThrow(() => sanitizeForLogging(undefined));
  assert.doesNotThrow(() => sanitizeForLogging("not an object"));
});

test("sanitizeForLogging only includes explicitly allowlisted keys", () => {
  const logged = sanitizeForLogging({
    version: "1.1.0",
    page_url_hash: "abc",
    elements: [{ id: "el-1", role: "button", text: "secret-looking-text" }],
    privacy: { redaction_applied: true, redacted_regions: ["el-1"], redaction_types: ["pii"], visual_context_version: "v1" },
    timestamp: "2026-08-24T00:00:00Z",
    unexpected_field: "should never appear",
  });
  const allowed = new Set(["version", "timestamp", "element_count", "redaction_applied", "redaction_types", "page_url_hash"]);
  for (const key of Object.keys(logged)) {
    assert.ok(allowed.has(key), `unexpected key in log projection: ${key}`);
  }
});
