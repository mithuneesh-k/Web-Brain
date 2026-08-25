const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeRegions } = require("../../src/detection/combineDetectors.js");

test("merges regions from multiple detector arrays into one flat array", () => {
  const a = [{ id: "r1", elementId: "el-1", category: "authentication", subtype: "password", confidence: 1.0, source: "tier1-dom-pattern", boundingBox: null }];
  const b = [{ id: "r2", elementId: "el-2", category: "pii", subtype: "email", confidence: 0.5, source: "tier2-semantic", boundingBox: null }];
  const merged = mergeRegions(a, b);
  assert.equal(merged.length, 2);
});

test("both Tier 1 and Tier 2 regions for the same element are preserved (not deduplicated away)", () => {
  const a = [{ id: "r1", elementId: "el-1", category: "authentication", subtype: "password", confidence: 1.0, source: "tier1-dom-pattern", boundingBox: null }];
  const b = [{ id: "r2", elementId: "el-1", category: "authentication", subtype: "password", confidence: 0.9, source: "tier2-semantic", boundingBox: null }];
  const merged = mergeRegions(a, b);
  assert.equal(merged.length, 2);
  assert.ok(merged.some((r) => r.source === "tier1-dom-pattern"));
  assert.ok(merged.some((r) => r.source === "tier2-semantic"));
});

test("handles empty arrays", () => {
  assert.deepEqual(mergeRegions([], []), []);
});
