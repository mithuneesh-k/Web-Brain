const test = require("node:test");
const assert = require("node:assert/strict");
const { produceRegions, RegionProducerError } = require("../../src/detection/regionProducer.js");
const { GeometryError } = require("../../src/detection/domGeometry.js");

/** Stand-in for a DOM element: the producer only ever calls getBoundingClientRect(). */
function el(rect) {
  return { getBoundingClientRect: () => rect };
}

const VIEW = { devicePixelRatio: 1, imageWidth: 800, imageHeight: 600 };

function detection(overrides = {}) {
  return {
    elementId: "el-1",
    element: el({ x: 100, y: 50, width: 200, height: 20 }),
    category: "authentication",
    subtype: "password",
    confidence: 1.0,
    source: "tier1-dom-pattern",
    ...overrides,
  };
}

test("1. a password input produces a real pixel box", () => {
  const regions = produceRegions([detection()], VIEW);
  assert.equal(regions.length, 1);
  assert.equal(regions[0].category, "authentication");
  assert.deepEqual(regions[0].boundingBox, { x: 100, y: 50, width: 200, height: 20 });
  assert.notEqual(regions[0].boundingBox, null);
});

test("2. an email input produces a real pixel box", () => {
  const regions = produceRegions(
    [detection({ elementId: "el-2", category: "pii", subtype: "email", element: el({ x: 10, y: 10, width: 150, height: 18 }) })],
    VIEW
  );
  assert.equal(regions[0].category, "pii");
  assert.deepEqual(regions[0].boundingBox, { x: 10, y: 10, width: 150, height: 18 });
});

test("3. a Tier 2 contextual detection also gets geometry", () => {
  const regions = produceRegions(
    [detection({ source: "tier2-semantic", confidence: 0.7, subtype: "credential" })],
    VIEW
  );
  assert.equal(regions[0].source, "tier2-semantic");
  assert.equal(regions[0].confidence, 0.7);
  assert.ok(regions[0].boundingBox);
});

test("4. an element below the viewport yields NO region — never a fake box", () => {
  const regions = produceRegions([detection({ element: el({ x: 100, y: 900, width: 200, height: 20 }) })], VIEW);
  assert.deepEqual(regions, []);
});

test("5. a zero-sized element produces no screenshot region", () => {
  const regions = produceRegions([detection({ element: el({ x: 10, y: 10, width: 0, height: 0 }) })], VIEW);
  assert.deepEqual(regions, []);
});

test("6. two detections on the same element both carry geometry and share the elementId", () => {
  const shared = el({ x: 40, y: 40, width: 100, height: 20 });
  const regions = produceRegions(
    [
      detection({ elementId: "el-9", element: shared, category: "authentication", subtype: "password", source: "tier1-dom-pattern" }),
      detection({ elementId: "el-9", element: shared, category: "pii", subtype: "email", source: "tier2-semantic", confidence: 0.6 }),
    ],
    VIEW
  );
  assert.equal(regions.length, 2);
  assert.ok(regions.every((r) => r.elementId === "el-9"));
  assert.deepEqual(regions[0].boundingBox, regions[1].boundingBox);
  assert.notEqual(regions[0].id, regions[1].id, "ids must stay distinct so audit can tell them apart");
});

test("7. dpr=2 scales the produced box", () => {
  const regions = produceRegions([detection()], { devicePixelRatio: 2, imageWidth: 1600, imageHeight: 1200 });
  assert.deepEqual(regions[0].boundingBox, { x: 200, y: 100, width: 400, height: 40 });
});

test("8. viewport capture with scroll does NOT double-add scroll", () => {
  const regions = produceRegions([detection()], { ...VIEW, captureMode: "viewport", scrollX: 300, scrollY: 500 });
  assert.deepEqual(regions[0].boundingBox, { x: 100, y: 50, width: 200, height: 20 });
});

test("9. fullpage capture DOES add scroll", () => {
  const regions = produceRegions([detection()], {
    devicePixelRatio: 1, imageWidth: 800, imageHeight: 5000,
    captureMode: "fullpage", scrollX: 0, scrollY: 500,
  });
  assert.deepEqual(regions[0].boundingBox, { x: 100, y: 550, width: 200, height: 20 });
});

test("10. FAIL-CLOSED: bad geometry throws rather than emitting a boxless or wrong region", () => {
  assert.throws(
    () => produceRegions([detection({ element: el({ x: NaN, y: 0, width: 10, height: 10 }) })], VIEW),
    GeometryError
  );
  assert.throws(() => produceRegions([detection()], { ...VIEW, devicePixelRatio: 0 }), GeometryError);
});

test("FAIL-CLOSED: a detection whose element cannot be measured throws", () => {
  assert.throws(() => produceRegions([detection({ element: {} })], RegionProducerError && VIEW), RegionProducerError);
  assert.throws(() => produceRegions([detection({ element: null })], VIEW), RegionProducerError);
});

test("FAIL-CLOSED: an unknown category throws — the redactor must not receive a category it cannot mode", () => {
  assert.throws(() => produceRegions([detection({ category: "vibes" })], VIEW), RegionProducerError);
});

test("the producer performs NO detection of its own — it never inspects text or attributes", () => {
  // A detection whose element text screams "password" but whose declared
  // category is pii must come out as pii. Re-detecting here would be a
  // second, divergent source of privacy truth.
  const regions = produceRegions(
    [detection({ category: "pii", subtype: "email", element: el({ x: 1, y: 1, width: 10, height: 10, textContent: "password: hunter2" }) })],
    VIEW
  );
  assert.equal(regions[0].category, "pii");
  assert.equal(regions[0].subtype, "email");
});

test("padding is passed through to the geometry layer", () => {
  const regions = produceRegions([detection({ element: el({ x: 100, y: 100, width: 50, height: 10 }) })], { ...VIEW, padding: 3 });
  assert.deepEqual(regions[0].boundingBox, { x: 97, y: 97, width: 56, height: 16 });
});

test("empty input yields empty output, not an error", () => {
  assert.deepEqual(produceRegions([], VIEW), []);
});
