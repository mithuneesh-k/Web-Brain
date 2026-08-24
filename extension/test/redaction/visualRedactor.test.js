const test = require("node:test");
const assert = require("node:assert/strict");
const { redactImageData, RedactionError } = require("../../src/redaction/visualRedactor.js");

// Build a solid-colour RGBA buffer, ImageData-shaped (exactly what
// OffscreenCanvas.getImageData() returns in the extension service worker).
function makeImage(width, height, [r, g, b] = [10, 200, 30]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function pixelAt(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function region(overrides = {}) {
  return {
    id: "r1",
    elementId: "el-1",
    category: "pii",
    subtype: "email",
    confidence: 1.0,
    source: "tier1-dom-pattern",
    boundingBox: { x: 2, y: 2, width: 4, height: 4 },
    ...overrides,
  };
}

test("mask mode overwrites every pixel inside the box", () => {
  const img = makeImage(10, 10);
  const out = redactImageData(img, [region()]);
  assert.deepEqual(pixelAt(out, 3, 3), [0, 0, 0, 255]);
  assert.deepEqual(pixelAt(out, 2, 2), [0, 0, 0, 255]);
  assert.deepEqual(pixelAt(out, 5, 5), [0, 0, 0, 255]);
});

test("pixels outside the box are untouched — non-sensitive UI stays readable", () => {
  const img = makeImage(10, 10);
  const out = redactImageData(img, [region()]);
  assert.deepEqual(pixelAt(out, 0, 0), [10, 200, 30, 255]);
  assert.deepEqual(pixelAt(out, 9, 9), [10, 200, 30, 255]);
  assert.deepEqual(pixelAt(out, 6, 6), [10, 200, 30, 255]);
});

test("the original sensitive pixels are genuinely gone, not merely covered", () => {
  const img = makeImage(10, 10, [255, 0, 0]);
  const out = redactImageData(img, [region()]);
  // Scan the masked area: no trace of the original red may remain.
  for (let y = 2; y < 6; y++) {
    for (let x = 2; x < 6; x++) {
      assert.notDeepEqual(pixelAt(out, x, y), [255, 0, 0, 255]);
    }
  }
});

test("visual_identity uses blur, which changes pixels without a flat fill", () => {
  // Checkerboard so a blur has something to average.
  const img = makeImage(10, 10, [0, 0, 0]);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if ((x + y) % 2 === 0) {
        const i = (y * 10 + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      }
    }
  }
  const out = redactImageData(img, [
    region({ category: "visual_identity", subtype: "face", boundingBox: { x: 2, y: 2, width: 6, height: 6 } }),
  ], { privacyMode: "contextual" });
  const [r] = pixelAt(out, 4, 4);
  assert.ok(r > 0 && r < 255, `expected an averaged value, got ${r}`);
});

test("blur DESTROYS detail, it does not merely alter pixels", () => {
  // Regression test for a real defect: a fixed small blur radius passed
  // a "pixels changed" assertion while leaving a face plainly
  // recognisable — privacy theatre. Detail must actually collapse, and
  // it must collapse at large region sizes too, not just small ones.
  const size = 96;
  const img = makeImage(size, size, [0, 0, 0]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.floor(x / 6) % 2 === Math.floor(y / 6) % 2) {
        const i = (y * size + x) * 4;
        img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      }
    }
  }
  const box = { x: 0, y: 0, width: size, height: size };

  const variance = (im) => {
    const vals = [];
    for (let y = 8; y < size - 8; y++) {
      for (let x = 8; x < size - 8; x++) vals.push(pixelAt(im, x, y)[0]);
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
  };

  const before = variance(img);
  const after = variance(
    redactImageData(
      img,
      [region({ category: "visual_identity", subtype: "face", boundingBox: box })],
      { privacyMode: "contextual" }
    )
  );

  assert.ok(before > 5000, `test fixture should start high-contrast, got ${before}`);
  assert.ok(
    after < before * 0.02,
    `blur must collapse detail: variance went ${before.toFixed(0)} -> ${after.toFixed(0)}`
  );
});

test("blur does not bleed the sensitive region's pixels outside its own box", () => {
  const img = makeImage(40, 40, [250, 250, 250]);
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) {
      const i = (y * 40 + x) * 4;
      img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0;
    }
  }
  const out = redactImageData(img, [
    region({ category: "visual_identity", boundingBox: { x: 10, y: 10, width: 20, height: 20 } }),
  ], { privacyMode: "contextual" });
  // Just outside the box must remain the original background.
  assert.deepEqual(pixelAt(out, 9, 20), [250, 250, 250, 255]);
  assert.deepEqual(pixelAt(out, 30, 20), [250, 250, 250, 255]);
});

test("multiple regions across categories are all applied", () => {
  const img = makeImage(20, 10);
  const out = redactImageData(img, [
    region({ id: "r1", boundingBox: { x: 0, y: 0, width: 3, height: 3 } }),
    region({ id: "r2", category: "authentication", subtype: "password", boundingBox: { x: 10, y: 5, width: 4, height: 4 } }),
  ]);
  assert.deepEqual(pixelAt(out, 1, 1), [0, 0, 0, 255]);
  assert.deepEqual(pixelAt(out, 11, 6), [0, 0, 0, 255]);
  assert.deepEqual(pixelAt(out, 6, 1), [10, 200, 30, 255]);
});

test("a box overlapping the edge is clipped, not an error", () => {
  const img = makeImage(10, 10);
  const out = redactImageData(img, [region({ boundingBox: { x: 8, y: 8, width: 10, height: 10 } })]);
  assert.deepEqual(pixelAt(out, 9, 9), [0, 0, 0, 255]);
});

test("FAIL-CLOSED: a region with no boundingBox throws rather than silently skipping", () => {
  const img = makeImage(10, 10);
  assert.throws(() => redactImageData(img, [region({ boundingBox: null })]), RedactionError);
});

test("FAIL-CLOSED: a malformed boundingBox throws", () => {
  const img = makeImage(10, 10);
  assert.throws(() => redactImageData(img, [region({ boundingBox: { x: 1, y: 1, width: -5, height: 4 } })]), RedactionError);
  assert.throws(() => redactImageData(img, [region({ boundingBox: { x: "a", y: 1, width: 4, height: 4 } })]), RedactionError);
});

test("FAIL-CLOSED: a box entirely outside the image throws — a region we cannot mask is not a region we may ignore", () => {
  const img = makeImage(10, 10);
  assert.throws(() => redactImageData(img, [region({ boundingBox: { x: 50, y: 50, width: 4, height: 4 } })]), RedactionError);
});

test("no regions leaves the image byte-identical", () => {
  const img = makeImage(8, 8);
  const before = Array.from(img.data);
  const out = redactImageData(img, []);
  assert.deepEqual(Array.from(out.data), before);
});

test("reports what it applied, for privacy metadata and audit", () => {
  const img = makeImage(10, 10);
  const out = redactImageData(img, [
    region({ id: "r1" }),
    region({ id: "r2", category: "visual_identity", subtype: "face", boundingBox: { x: 0, y: 0, width: 2, height: 2 } }),
  ], { privacyMode: "contextual" });
  assert.equal(out.applied.length, 2);
  assert.deepEqual(out.applied.map((a) => a.mode).sort(), ["blur", "mask"]);
  assert.deepEqual(out.applied.map((a) => a.id).sort(), ["r1", "r2"]);
});

test("does not mutate the caller's buffer — the raw screenshot is left intact for local use", () => {
  const img = makeImage(10, 10);
  const originalFirstPixel = pixelAt(img, 3, 3);
  redactImageData(img, [region()]);
  assert.deepEqual(pixelAt(img, 3, 3), originalFirstPixel);
});

// --- privacy mode: strict is the safe default ---

test("DEFAULT is strict: a face is SOLID-MASKED, not blurred", () => {
  const img = makeImage(20, 20, [230, 190, 160]);
  const out = redactImageData(img, [
    region({ category: "visual_identity", subtype: "face", boundingBox: { x: 4, y: 4, width: 10, height: 10 } }),
  ]);
  assert.equal(out.privacyMode, "strict");
  assert.equal(out.applied[0].mode, "mask");
  assert.deepEqual(pixelAt(out, 8, 8), [0, 0, 0, 255]);
});

test("credentials are ALWAYS masked, even in contextual mode", () => {
  const img = makeImage(20, 20);
  const out = redactImageData(img, [
    region({ category: "authentication", subtype: "password", boundingBox: { x: 4, y: 4, width: 10, height: 10 } }),
  ], { privacyMode: "contextual" });
  assert.equal(out.applied[0].mode, "mask");
  assert.deepEqual(pixelAt(out, 8, 8), [0, 0, 0, 255]);
});

test("FAIL-CLOSED: an unknown privacyMode throws rather than falling back", () => {
  const img = makeImage(10, 10);
  assert.throws(() => redactImageData(img, [region()], { privacyMode: "loose" }), RedactionError);
});
