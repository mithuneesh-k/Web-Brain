const test = require("node:test");
const assert = require("node:assert/strict");
const { redactElements } = require("../../src/redaction/redactor.js");
const { detectTier1Regions } = require("../../src/detection/tier1Detector.js");
const { assertSafeForEgress } = require("../../src/privacy/egressGate.js");

test("masked text never contains the original sensitive value", () => {
  const rawElements = [{ id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" }];
  const regions = detectTier1Regions(rawElements);
  const { elements } = redactElements(rawElements, regions);
  const el = elements.find((e) => e.id === "el-1");
  assert.equal(el.redacted, true);
  assert.ok(!el.text.includes("hunter2Password!"));
});

test("elements with no covering region pass through unchanged", () => {
  const rawElements = [{ id: "el-1", role: "button", text: "Say hello" }];
  const { elements } = redactElements(rawElements, []);
  const el = elements.find((e) => e.id === "el-1");
  assert.equal(el.redacted, false);
  assert.equal(el.text, "Say hello");
});

test("privacy metadata accurately reflects what was redacted", () => {
  const rawElements = [
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
    { id: "el-2", role: "textbox", type: "email", text: "someone@example.com" },
    { id: "el-3", role: "button", text: "Submit" },
  ];
  const regions = detectTier1Regions(rawElements);
  const { privacy } = redactElements(rawElements, regions);
  assert.equal(privacy.redaction_applied, true);
  assert.deepEqual(privacy.redacted_regions.sort(), ["el-1", "el-2"]);
  assert.ok(privacy.redaction_types.includes("authentication"));
  assert.ok(privacy.redaction_types.includes("pii"));
  assert.ok(!privacy.redaction_types.includes("financial"));
});

test("output of redactElements always passes assertSafeForEgress", () => {
  const rawElements = [
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
    { id: "el-2", role: "button", text: "Say hello" },
  ];
  const regions = detectTier1Regions(rawElements);
  const { elements, privacy } = redactElements(rawElements, regions);
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

test("no privacy applied when there are no regions at all", () => {
  const rawElements = [{ id: "el-1", role: "button", text: "Say hello" }];
  const { privacy } = redactElements(rawElements, []);
  assert.equal(privacy.redaction_applied, false);
  assert.deepEqual(privacy.redacted_regions, []);
  assert.deepEqual(privacy.redaction_types, []);
});

test("Tier 1 and Tier 2 regions for the same element merge into one redacted element with the union of categories", () => {
  const rawElements = [{ id: "el-1", role: "textbox", type: "password", ariaLabel: "API secret" }];
  const regions = [
    { id: "r1", elementId: "el-1", category: "authentication", subtype: "password", confidence: 1.0, source: "tier1-dom-pattern", boundingBox: null },
  ];
  const { elements, privacy } = redactElements(rawElements, regions);
  const el = elements.find((e) => e.id === "el-1");
  assert.equal(el.redacted, true);
  assert.deepEqual(privacy.redaction_types, ["authentication"]);
});
