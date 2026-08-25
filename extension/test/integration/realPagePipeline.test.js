/**
 * THE end-to-end privacy test.
 *
 * Real page -> real getBoundingClientRect() -> real detection -> real
 * pixel boxes -> real redaction -> assert the sensitive pixels are gone
 * and the useful ones survive.
 *
 * The geometry in captured-page-geometry.json was captured from
 * extension/test/fixtures/sensitive-page.html rendered in an actual
 * browser at 800x600 with devicePixelRatio 1.25 — a fractional DPR with
 * fractional rects, which is the case most likely to produce
 * off-by-a-pixel under-coverage. Nothing here is hand-authored geometry.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const captured = require("../fixtures/captured-page-geometry.json");

const { detectSensitiveElements } = require("../../src/detection/domDetector.js");
const { detectTier2Regions } = require("../../src/detection/tier2Detector.js");
const { produceRegions } = require("../../src/detection/regionProducer.js");
const { redactImageData } = require("../../src/redaction/visualRedactor.js");

const IMG_W = Math.round(captured.vw * captured.dpr); // 1000
const IMG_H = Math.round(captured.vh * captured.dpr); // 750

const VIEWPORT = {
  devicePixelRatio: captured.dpr,
  imageWidth: IMG_W,
  imageHeight: IMG_H,
  captureMode: "viewport",
  scrollX: captured.scrollX,
  scrollY: captured.scrollY,
  padding: 2,
};

const byId = new Map(captured.elements.map((e) => [e.id, e]));
const elementFor = (id) => ({ getBoundingClientRect: () => byId.get(id).rect });

const SENSITIVE_IDS = ["email", "phone", "password", "api_token", "otp"];
const MUST_SURVIVE_IDS = ["hdr", "note", "save", "nickname", "label-2", "ftr"];

/** Run the real detectors, then attach real geometry. */
function runPipeline() {
  const classified = detectSensitiveElements(captured.elements);
  const tier1 = classified
    .filter((e) => e.sensitive)
    .flatMap((e) =>
      e.types.map((category) => ({
        elementId: e.id,
        element: elementFor(e.id),
        category,
        subtype: e.reasons[0] || category,
        confidence: 1.0,
        source: "tier1-dom-pattern",
      }))
    );

  const tier2 = detectTier2Regions(captured.elements).map((r) => ({
    elementId: r.elementId,
    element: elementFor(r.elementId),
    category: r.category,
    subtype: r.subtype,
    confidence: r.confidence,
    source: "tier2-semantic",
  }));

  return produceRegions([...tier1, ...tier2], VIEWPORT);
}

/** A distinctly-coloured image so "was this pixel redacted" is unambiguous. */
function syntheticCapture() {
  const data = new Uint8ClampedArray(IMG_W * IMG_H * 4);
  for (let i = 0; i < IMG_W * IMG_H; i++) {
    data[i * 4] = 200; data[i * 4 + 1] = 30; data[i * 4 + 2] = 90; data[i * 4 + 3] = 255;
  }
  return { width: IMG_W, height: IMG_H, data };
}

const pixelAt = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
};

const centreOf = (id) => {
  const r = byId.get(id).rect;
  return [
    Math.floor((r.x + r.width / 2) * captured.dpr),
    Math.floor((r.y + r.height / 2) * captured.dpr),
  ];
};

test("every sensitive field on the real page produces a region with a real pixel box", () => {
  const regions = runPipeline();
  for (const id of SENSITIVE_IDS) {
    const rs = regions.filter((r) => r.elementId === id);
    assert.ok(rs.length > 0, `no region produced for "${id}"`);
    for (const r of rs) {
      assert.ok(r.boundingBox, `region for "${id}" has no boundingBox`);
      assert.ok(r.boundingBox.width > 0 && r.boundingBox.height > 0);
    }
  }
});

test("no region is produced for the harmless button, labels, or body copy", () => {
  const regions = runPipeline();
  const flagged = new Set(regions.map((r) => r.elementId));
  for (const id of MUST_SURVIVE_IDS) {
    assert.ok(!flagged.has(id), `false positive: "${id}" should not be redacted`);
  }
});

test("boxes are scaled by the real fractional DPR (1.25), not left in CSS pixels", () => {
  const regions = runPipeline();
  const email = regions.find((r) => r.elementId === "email");
  const css = byId.get("email").rect;
  // With padding 2 and dpr 1.25: floor((20-2)*1.25) = 22
  assert.equal(email.boundingBox.x, Math.floor((css.x - 2) * captured.dpr));
  assert.ok(
    email.boundingBox.width > css.width,
    "a 1.25x-scaled box must be wider than the CSS width"
  );
});

test("END TO END: sensitive pixels are destroyed, everything else survives", () => {
  const regions = runPipeline();
  const shot = syntheticCapture();
  const out = redactImageData(shot, regions); // strict mode by default

  for (const id of SENSITIVE_IDS) {
    const [cx, cy] = centreOf(id);
    assert.deepEqual(
      pixelAt(out, cx, cy),
      [0, 0, 0, 255],
      `sensitive field "${id}" was NOT redacted at its centre pixel`
    );
  }

  for (const id of MUST_SURVIVE_IDS) {
    const [cx, cy] = centreOf(id);
    if (cy >= IMG_H) continue; // footer overflows the viewport capture
    assert.deepEqual(
      pixelAt(out, cx, cy),
      [200, 30, 90, 255],
      `non-sensitive element "${id}" was wrongly redacted`
    );
  }
});

test("END TO END: the redacted image is mostly intact — this is redaction, not a blackout", () => {
  const regions = runPipeline();
  const out = redactImageData(syntheticCapture(), regions);
  let black = 0;
  for (let i = 0; i < IMG_W * IMG_H; i++) {
    if (out.data[i * 4] === 0 && out.data[i * 4 + 1] === 0 && out.data[i * 4 + 2] === 0) black++;
  }
  const ratio = black / (IMG_W * IMG_H);
  assert.ok(ratio > 0.01, `expected real redaction, only ${(ratio * 100).toFixed(2)}% masked`);
  assert.ok(ratio < 0.30, `over-redaction: ${(ratio * 100).toFixed(2)}% of the page was masked`);
});

test("the footer overflowing the viewport is handled without inventing pixels", () => {
  // The footer sits at y=581 with height 45.6 in an 800x600 viewport, so
  // it runs past the bottom edge. It is not sensitive, so it should
  // simply produce no region — and must not throw.
  const regions = runPipeline();
  assert.ok(!regions.some((r) => r.elementId === "ftr"));
  for (const r of regions) {
    assert.ok(r.boundingBox.y + r.boundingBox.height <= IMG_H, `region ${r.id} exceeds image height`);
    assert.ok(r.boundingBox.x + r.boundingBox.width <= IMG_W, `region ${r.id} exceeds image width`);
  }
});
