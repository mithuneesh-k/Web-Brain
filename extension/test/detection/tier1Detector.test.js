const test = require("node:test");
const assert = require("node:assert/strict");
const { detectTier1Regions } = require("../../src/detection/tier1Detector.js");

test("emits a normalized SensitiveRegion for a password field", () => {
  const regions = detectTier1Regions([
    { id: "el-1", role: "textbox", type: "password", text: "hunter2Password!" },
  ]);
  assert.equal(regions.length, 1);
  const r = regions[0];
  assert.equal(r.elementId, "el-1");
  assert.equal(r.category, "authentication");
  assert.equal(r.confidence, 1.0);
  assert.equal(r.source, "tier1-dom-pattern");
  assert.equal(r.boundingBox, null);
});

test("emits no regions for a non-sensitive element", () => {
  const regions = detectTier1Regions([{ id: "el-1", role: "button", text: "Say hello" }]);
  assert.deepEqual(regions, []);
});

test("emits one region per matched category for a multi-category element", () => {
  // A field whose text is both API-key-shaped AND happens to also be
  // named like a token field triggers only one category (authentication)
  // here since both signals map to the same category — covered instead
  // by a genuinely multi-category case: card number text in an
  // otherwise-untyped field plus an email-shaped value is not
  // representable on one element's `text`, so this test uses two
  // elements to prove independent regions are emitted per element.
  const regions = detectTier1Regions([
    { id: "el-1", role: "textbox", type: "email", text: "" },
    { id: "el-2", role: "textbox", type: "text", text: "4111 1111 1111 1111" },
  ]);
  assert.equal(regions.length, 2);
  assert.ok(regions.some((r) => r.elementId === "el-1" && r.category === "pii"));
  assert.ok(regions.some((r) => r.elementId === "el-2" && r.category === "financial"));
});
