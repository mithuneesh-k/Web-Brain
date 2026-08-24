const test = require("node:test");
const assert = require("node:assert/strict");
const { redactElements } = require("../../src/redaction/redactor.js");
const { detectSensitiveElements } = require("../../src/detection/domDetector.js");
const { assertSafeForEgress } = require("../../src/privacy/egressGate.js");

test("masked text never contains the original sensitive value", () => {
  const detected = detectSensitiveElements([
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
  ]);
  const { elements } = redactElements(detected);
  const el = elements.find((e) => e.id === "el-1");
  assert.equal(el.redacted, true);
  assert.ok(!el.text.includes("hunter2Password!"));
});

test("non-sensitive elements pass through unchanged", () => {
  const detected = detectSensitiveElements([
    { id: "el-1", role: "button", text: "Say hello" },
  ]);
  const { elements } = redactElements(detected);
  const el = elements.find((e) => e.id === "el-1");
  assert.equal(el.redacted, false);
  assert.equal(el.text, "Say hello");
});

test("privacy metadata accurately reflects what was redacted", () => {
  const detected = detectSensitiveElements([
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
    { id: "el-2", role: "textbox", type: "email", text: "someone@example.com" },
    { id: "el-3", role: "button", text: "Submit" },
  ]);
  const { privacy } = redactElements(detected);
  assert.equal(privacy.redaction_applied, true);
  assert.deepEqual(privacy.redacted_regions.sort(), ["el-1", "el-2"]);
  assert.ok(privacy.redaction_types.includes("authentication"));
  assert.ok(privacy.redaction_types.includes("pii"));
  assert.ok(!privacy.redaction_types.includes("financial"));
});

test("output of redactElements always passes assertSafeForEgress", () => {
  const detected = detectSensitiveElements([
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
    { id: "el-2", role: "button", text: "Say hello" },
  ]);
  const { elements, privacy } = redactElements(detected);
  const context = {
    version: "1.1.0",
    page_url_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
    elements,
    privacy,
    timestamp: "2026-08-24T00:00:00Z",
  };
  const result = assertSafeForEgress(context);
  assert.equal(result.allowed, true, JSON.stringify(result.reasons));
});

test("no privacy applied when nothing sensitive is present", () => {
  const detected = detectSensitiveElements([
    { id: "el-1", role: "button", text: "Say hello" },
  ]);
  const { privacy } = redactElements(detected);
  assert.equal(privacy.redaction_applied, false);
  assert.deepEqual(privacy.redacted_regions, []);
  assert.deepEqual(privacy.redaction_types, []);
});
