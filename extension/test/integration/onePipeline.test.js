/**
 * The "one pipeline" proof (Phase 12B).
 *
 * The architectural claim is that DOM-derived regions (Tier 1/2) and
 * non-DOM visual regions (Tier 3, e.g. a face inside an <img>) converge
 * into ONE region list, are projected once, and are applied by ONE
 * redaction step — rather than Ozer running a second, competing privacy
 * system beside WebBrain's.
 *
 * This test demonstrates that on the real captured screenshot: mixed
 * producers, one list, one projection, one redaction pass.
 *
 * The Tier 3 region here is hand-supplied because no face detector
 * exists yet. That is the point of the test: it proves the *contract*
 * accepts a producer with no DOM element, so a real detector can be
 * dropped in later without touching geometry, projection, or redaction.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { decodePNG } = require("../../tools/png.js");
const { detectSensitiveElements } = require("../../src/detection/domDetector.js");
const { produceRegions } = require("../../src/detection/regionProducer.js");
const { projectSensitiveRegions } = require("../../src/detection/regionProjection.js");
const { redactImageData } = require("../../src/redaction/visualRedactor.js");

const FIX = path.join(__dirname, "../fixtures");
const captured = JSON.parse(fs.readFileSync(path.join(FIX, "real-capture-geometry.json"), "utf8"));
const shot = decodePNG(fs.readFileSync(path.join(FIX, "real-capture.png")));

const byId = new Map(captured.elements.map((e) => [e.id, e]));
const elementFor = (id) => ({ getBoundingClientRect: () => byId.get(id).rect });

const VIEWPORT = {
  devicePixelRatio: captured.dpr,
  imageWidth: shot.width,
  imageHeight: shot.height,
  captureMode: "viewport",
  padding: 2,
};

/** A Tier 3 producer's output: image-pixel box, no DOM element at all. */
const FACE_REGION = {
  id: "face-0",
  elementId: null,
  category: "visual_identity",
  subtype: "face",
  confidence: 0.91,
  source: "tier3-visual",
  boundingBox: { x: 600, y: 120, width: 160, height: 180 },
};

/** Tier 1 (DOM) + Tier 3 (visual) merged into a single SensitiveRegion[]. */
function allRegions() {
  const classified = detectSensitiveElements(captured.elements);
  const domDetections = classified
    .filter((e) => e.sensitive)
    .flatMap((e) =>
      e.types.map((category) => ({
        elementId: e.id, element: elementFor(e.id), category,
        subtype: e.reasons[0] || category, confidence: 1.0, source: "tier1-dom-pattern",
      }))
    );
  return [...produceRegions(domDetections, VIEWPORT), FACE_REGION];
}

const pixelAt = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

test("DOM and non-DOM producers converge into ONE region list", () => {
  const regions = allRegions();
  const sources = new Set(regions.map((r) => r.source));
  assert.ok(sources.has("tier1-dom-pattern"), "DOM producer missing");
  assert.ok(sources.has("tier3-visual"), "visual producer missing");
  assert.ok(regions.length > 1);
  // All producers emit the same contract.
  for (const r of regions) {
    assert.ok(r.boundingBox, `${r.id} has no boundingBox`);
    assert.equal(typeof r.category, "string");
    assert.equal(typeof r.source, "string");
  }
});

test("one projection call handles both producers, dropping neither", () => {
  const regions = allRegions();
  const out = projectSensitiveRegions(regions, { space: "image" });
  assert.equal(out.regions.length, regions.length, "a producer's regions were dropped");
  assert.equal(out.canonical.length, regions.length);
  // The face's true category survives on the canonical object even though
  // WebBrain's enum has no equivalent.
  const face = out.canonical.find((r) => r.id === "face-0");
  assert.equal(face.category, "visual_identity");
  assert.equal(face.source, "tier3-visual");
});

test("ONE redaction pass applies both DOM and visual regions to the real screenshot", () => {
  const regions = allRegions();
  const out = redactImageData(shot, regions); // strict: everything solid-masked

  // A DOM-derived region (the password field) is masked.
  const pwd = byId.get("password").rect;
  const [px, py] = [
    Math.floor((pwd.x + pwd.width / 2) * captured.dpr),
    Math.floor((pwd.y + pwd.height / 2) * captured.dpr),
  ];
  assert.deepEqual(pixelAt(out, px, py), [0, 0, 0, 255], "DOM region not redacted");

  // The non-DOM face region is masked by the same pass.
  assert.deepEqual(pixelAt(out, 680, 210), [0, 0, 0, 255], "Tier 3 region not redacted");

  // And a non-sensitive element is untouched.
  const save = byId.get("save").rect;
  const [sx, sy] = [
    Math.floor((save.x + save.width / 2) * captured.dpr),
    Math.floor((save.y + save.height / 2) * captured.dpr),
  ];
  assert.notDeepEqual(pixelAt(out, sx, sy), [0, 0, 0, 255], "the Save button was wrongly redacted");

  assert.equal(out.applied.length, regions.length, "not every region was applied");
});

test("adding a Tier 3 producer requires no change to geometry, projection, or redaction", () => {
  // Same pipeline, with and without the visual producer. The only
  // difference is one more region — no other code path varies.
  const withFace = allRegions();
  const withoutFace = withFace.filter((r) => r.source !== "tier3-visual");

  const a = projectSensitiveRegions(withoutFace, { space: "image" });
  const b = projectSensitiveRegions(withFace, { space: "image" });
  assert.equal(b.regions.length, a.regions.length + 1);

  const ra = redactImageData(shot, withoutFace);
  const rb = redactImageData(shot, withFace);
  assert.equal(rb.applied.length, ra.applied.length + 1);

  // Without the face producer, those pixels are untouched — proving the
  // masking above came from the Tier 3 region and nothing else.
  assert.notDeepEqual(pixelAt(ra, 680, 210), [0, 0, 0, 255]);
});
