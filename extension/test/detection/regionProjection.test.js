const test = require("node:test");
const assert = require("node:assert/strict");
const {
  projectSensitiveRegions,
  ProjectionError,
  CATEGORY_TO_KIND,
} = require("../../src/detection/regionProjection.js");

function region(overrides = {}) {
  return {
    id: "el-1-tier1-password",
    elementId: "el-1",
    category: "authentication",
    subtype: "password",
    confidence: 1.0,
    source: "tier1-dom-pattern",
    boundingBox: { x: 20, y: 100, width: 320, height: 32 },
    ...overrides,
  };
}

// --- criterion 1: every valid region projects ---

test("1. a valid region projects into WebBrain's {kind, rect} shape", () => {
  const out = projectSensitiveRegions([region()], { space: "image" });
  assert.equal(out.regions.length, 1);
  assert.deepEqual(Object.keys(out.regions[0]).sort(), ["kind", "rect"]);
  assert.deepEqual(Object.keys(out.regions[0].rect).sort(), ["h", "w", "x", "y"]);
});

// --- criterion 2: geometry is never lost or shrunk ---

test("2. geometry is carried across exactly", () => {
  const out = projectSensitiveRegions([region()], { space: "image" });
  assert.deepEqual(out.regions[0].rect, { x: 20, y: 100, w: 320, h: 32 });
});

test("2. fractional geometry GROWS to integers, never shrinks", () => {
  // Shrinking a sensitive box by a sub-pixel leaves a sliver of the
  // original visible. Origin floors, extent ceils.
  const out = projectSensitiveRegions(
    [region({ boundingBox: { x: 20.7, y: 100.2, width: 319.4, height: 31.9 } })],
    { space: "image" }
  );
  const r = out.regions[0].rect;
  assert.ok(r.x <= 20.7 && r.y <= 100.2, "origin must not move inward");
  assert.ok(r.x + r.w >= 20.7 + 319.4, "right edge must not move inward");
  assert.ok(r.y + r.h >= 100.2 + 31.9, "bottom edge must not move inward");
  assert.ok(Number.isInteger(r.x) && Number.isInteger(r.w));
});

// --- criterion 3: unsupported categories are NOT dropped ---

test("3. financial and visual_identity have no WebBrain kind but are STILL projected", () => {
  const out = projectSensitiveRegions(
    [
      region({ id: "a", category: "financial", subtype: "card" }),
      region({ id: "b", category: "visual_identity", subtype: "face" }),
    ],
    { space: "image" }
  );
  assert.equal(out.regions.length, 2, "no region may be dropped for lacking an upstream kind");
});

test("3. every Ozer category maps to some kind — none map to undefined", () => {
  for (const category of ["authentication", "pii", "financial", "visual_identity"]) {
    const out = projectSensitiveRegions([region({ category })], { space: "image" });
    assert.equal(typeof out.regions[0].kind, "string");
    assert.ok(out.regions[0].kind.length > 0, `${category} projected to an empty kind`);
  }
});

test("3. the mapping is explicit and total", () => {
  assert.deepEqual(Object.keys(CATEGORY_TO_KIND).sort(), [
    "authentication", "financial", "pii", "visual_identity",
  ]);
});

// --- criterion 4: the canonical region survives ---

test("4. canonical regions are returned intact, in the same order", () => {
  const input = [region({ id: "a" }), region({ id: "b", category: "pii", confidence: 0.7 })];
  const out = projectSensitiveRegions(input, { space: "image" });
  assert.equal(out.canonical.length, 2);
  assert.equal(out.canonical[0].id, "a");
  assert.equal(out.canonical[1].confidence, 0.7);
  assert.equal(out.canonical[1].source, "tier1-dom-pattern");
  assert.equal(out.canonical[1].category, "pii", "the ORIGINAL category must survive projection");
});

test("4. projection does not mutate the caller's regions", () => {
  const input = [region()];
  const before = JSON.stringify(input);
  projectSensitiveRegions(input, { space: "image" });
  assert.equal(JSON.stringify(input), before);
});

// --- criterion 5: no detection, no second privacy decision ---

test("5. the adapter makes NO privacy decision — it never filters by confidence", () => {
  // A 0.01-confidence region is still projected. Deciding what is
  // sensitive belongs to the detectors, not to a format adapter.
  const out = projectSensitiveRegions([region({ confidence: 0.01 })], { space: "image" });
  assert.equal(out.regions.length, 1);
});

test("5. the adapter never inspects text or attributes", () => {
  const out = projectSensitiveRegions(
    [region({ category: "pii", subtype: "email", text: "password: hunter2" })],
    { space: "image" }
  );
  assert.equal(out.canonical[0].category, "pii");
  assert.equal(out.regions[0].kind, CATEGORY_TO_KIND.pii);
});

// --- criterion 6: Tier 3 regions with no DOM element ---

test("6. a face box with NO elementId projects like any other region", () => {
  const face = {
    id: "face-0",
    elementId: null,
    category: "visual_identity",
    subtype: "face",
    confidence: 0.91,
    source: "tier3-visual",
    boundingBox: { x: 34, y: 74, width: 82, height: 88 },
  };
  const out = projectSensitiveRegions([face], { space: "image" });
  assert.equal(out.regions.length, 1);
  assert.deepEqual(out.regions[0].rect, { x: 34, y: 74, w: 82, h: 88 });
  assert.equal(out.canonical[0].source, "tier3-visual");
});

// --- criterion 7: coordinate space must be explicit; ambiguity fails closed ---

test("7. FAIL-CLOSED: omitting the coordinate space throws — it is never guessed", () => {
  // Ozer boxes are IMAGE px (domGeometry already applied DPR); WebBrain's
  // mapRegionsToImage expects CSS px. Guessing wrong double-scales every
  // box, so there is deliberately no default.
  assert.throws(() => projectSensitiveRegions([region()], {}), ProjectionError);
  assert.throws(() => projectSensitiveRegions([region()]), ProjectionError);
});

test("7. FAIL-CLOSED: an unknown coordinate space throws", () => {
  assert.throws(() => projectSensitiveRegions([region()], { space: "screen" }), ProjectionError);
});

test("7. the declared space is echoed back so the caller cannot mis-route the result", () => {
  assert.equal(projectSensitiveRegions([region()], { space: "image" }).space, "image");
  assert.equal(projectSensitiveRegions([region()], { space: "css" }).space, "css");
});

// --- fail-closed on bad regions ---

test("FAIL-CLOSED: a region with no boundingBox throws rather than being skipped", () => {
  assert.throws(
    () => projectSensitiveRegions([region({ boundingBox: null })], { space: "image" }),
    ProjectionError
  );
});

test("FAIL-CLOSED: non-positive or non-finite geometry throws", () => {
  for (const box of [
    { x: 1, y: 1, width: 0, height: 10 },
    { x: 1, y: 1, width: 10, height: -3 },
    { x: NaN, y: 1, width: 10, height: 10 },
  ]) {
    assert.throws(
      () => projectSensitiveRegions([region({ boundingBox: box })], { space: "image" }),
      ProjectionError
    );
  }
});

test("FAIL-CLOSED: an unknown category throws — it must not silently become 'input'", () => {
  assert.throws(
    () => projectSensitiveRegions([region({ category: "vibes" })], { space: "image" }),
    ProjectionError
  );
});

test("FAIL-CLOSED: non-array input throws", () => {
  assert.throws(() => projectSensitiveRegions("regions", { space: "image" }), ProjectionError);
});

test("an empty region list projects to an empty list, not an error", () => {
  const out = projectSensitiveRegions([], { space: "image" });
  assert.deepEqual(out.regions, []);
  assert.deepEqual(out.canonical, []);
});
