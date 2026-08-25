/**
 * Phase 10B — the real-pixel privacy test.
 *
 * Phase 10A proved: real DOM geometry -> real pixel boxes -> redaction
 * of a SYNTHETIC buffer. The synthetic buffer was the last staged part
 * of the Tier 1/2 path. This replaces it.
 *
 * real-capture.png and real-capture-geometry.json were produced in the
 * SAME browser session (playwright, Chromium, 800x600, DPR 1.25), so
 * the pixels and the geometry are guaranteed to describe the same
 * render. Nothing here is synthetic except the fixture page's content,
 * which is deliberately fake data.
 *
 * The assertions that matter are the ones a synthetic buffer could not
 * make: that real rendered TEXT existed in those pixels beforehand, and
 * is gone afterwards.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { decodePNG } = require("../../tools/png.js");
const { detectSensitiveElements } = require("../../src/detection/domDetector.js");
const { detectTier2Regions } = require("../../src/detection/tier2Detector.js");
const { produceRegions } = require("../../src/detection/regionProducer.js");
const { redactImageData } = require("../../src/redaction/visualRedactor.js");

const FIX = path.join(__dirname, "../fixtures");
const captured = JSON.parse(fs.readFileSync(path.join(FIX, "real-capture-geometry.json"), "utf8"));
const shot = decodePNG(fs.readFileSync(path.join(FIX, "real-capture.png")));

const SENSITIVE_IDS = ["email", "phone", "password", "api_token", "otp"];
const MUST_SURVIVE_IDS = ["hdr", "note", "save", "nickname"];

const byId = new Map(captured.elements.map((e) => [e.id, e]));
const elementFor = (id) => ({ getBoundingClientRect: () => byId.get(id).rect });

const VIEWPORT = {
  devicePixelRatio: captured.dpr,
  imageWidth: shot.width,
  imageHeight: shot.height,
  captureMode: "viewport",
  scrollX: captured.scrollX,
  scrollY: captured.scrollY,
  padding: 2,
};

function runPipeline() {
  const classified = detectSensitiveElements(captured.elements);
  const tier1 = classified
    .filter((e) => e.sensitive)
    .flatMap((e) =>
      e.types.map((category) => ({
        elementId: e.id, element: elementFor(e.id), category,
        subtype: e.reasons[0] || category, confidence: 1.0, source: "tier1-dom-pattern",
      }))
    );
  const tier2 = detectTier2Regions(captured.elements).map((r) => ({
    elementId: r.elementId, element: elementFor(r.elementId), category: r.category,
    subtype: r.subtype, confidence: r.confidence, source: "tier2-semantic",
  }));
  return produceRegions([...tier1, ...tier2], VIEWPORT);
}

/** Distinct colours inside an element's on-screen rect — a proxy for "text is rendered here". */
function distinctColours(img, id) {
  const r = byId.get(id).rect;
  const x0 = Math.max(0, Math.floor(r.x * captured.dpr));
  const y0 = Math.max(0, Math.floor(r.y * captured.dpr));
  const x1 = Math.min(img.width, Math.ceil((r.x + r.width) * captured.dpr));
  const y1 = Math.min(img.height, Math.ceil((r.y + r.height) * captured.dpr));
  const seen = new Set();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      seen.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]);
    }
  }
  return seen;
}

test("the fixture really is a rendered screenshot, not a flat image", () => {
  assert.equal(shot.width, Math.round(captured.vw * captured.dpr));
  assert.equal(shot.height, Math.round(captured.vh * captured.dpr));
  // A real render of this page has many distinct colours (anti-aliased text).
  const all = new Set();
  for (let i = 0; i < shot.width * shot.height; i++) {
    all.add((shot.data[i * 4] << 16) | (shot.data[i * 4 + 1] << 8) | shot.data[i * 4 + 2]);
  }
  assert.ok(all.size > 50, `expected a real render, got ${all.size} distinct colours`);
});

test("REAL PIXELS: each sensitive field visibly contained rendered text before redaction", () => {
  for (const id of SENSITIVE_IDS) {
    const colours = distinctColours(shot, id);
    assert.ok(
      colours.size > 3,
      `"${id}" should contain rendered glyphs before redaction, saw ${colours.size} colours`
    );
  }
});

test("REAL PIXELS: after redaction every sensitive field is a single flat colour", () => {
  const out = redactImageData(shot, runPipeline()); // strict by default
  for (const id of SENSITIVE_IDS) {
    const colours = distinctColours(out, id);
    assert.equal(
      colours.size,
      1,
      `"${id}" still has ${colours.size} distinct colours after redaction — text survived`
    );
    assert.ok(colours.has(0), `"${id}" was flattened to something other than black`);
  }
});

test("REAL PIXELS: the rendered content of non-sensitive elements is byte-identical", () => {
  const out = redactImageData(shot, runPipeline());
  for (const id of MUST_SURVIVE_IDS) {
    const r = byId.get(id).rect;
    const x0 = Math.max(0, Math.floor(r.x * captured.dpr));
    const y0 = Math.max(0, Math.floor(r.y * captured.dpr));
    const x1 = Math.min(shot.width, Math.ceil((r.x + r.width) * captured.dpr));
    const y1 = Math.min(shot.height, Math.ceil((r.y + r.height) * captured.dpr));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * shot.width + x) * 4;
        for (let k = 0; k < 4; k++) {
          assert.equal(out.data[i + k], shot.data[i + k], `"${id}" pixel changed at ${x},${y}`);
        }
      }
    }
  }
});

test("REAL PIXELS: the visible secret values are gone from the image entirely", () => {
  // The password field renders dots, but email/phone/token/otp render
  // readable glyph pixels. After redaction their rects must be flat.
  const out = redactImageData(shot, runPipeline());
  let changed = 0;
  for (let i = 0; i < shot.width * shot.height; i++) {
    const o = i * 4;
    if (out.data[o] !== shot.data[o] || out.data[o + 1] !== shot.data[o + 1] || out.data[o + 2] !== shot.data[o + 2]) {
      changed++;
    }
  }
  const ratio = changed / (shot.width * shot.height);
  assert.ok(ratio > 0.01, `nothing meaningful was redacted (${(ratio * 100).toFixed(2)}%)`);
  assert.ok(ratio < 0.30, `over-redaction: ${(ratio * 100).toFixed(2)}% of real pixels changed`);
});

test("REAL PIXELS: redaction is idempotent — re-running changes nothing further", () => {
  const regions = runPipeline();
  const once = redactImageData(shot, regions);
  const twice = redactImageData(once, regions);
  for (let i = 0; i < once.data.length; i++) {
    assert.equal(twice.data[i], once.data[i]);
  }
});
