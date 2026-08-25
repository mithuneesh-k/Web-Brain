const test = require("node:test");
const assert = require("node:assert/strict");
const {
  domRectToScreenshotBox,
  GeometryError,
} = require("../../src/detection/domGeometry.js");

const VIEWPORT = { devicePixelRatio: 1, imageWidth: 800, imageHeight: 600 };

function box(overrides = {}) {
  return { x: 100, y: 50, width: 200, height: 20, ...overrides };
}

test("dpr=1: CSS pixels map 1:1 to screenshot pixels", () => {
  const r = domRectToScreenshotBox(box(), VIEWPORT);
  assert.equal(r.visible, true);
  assert.deepEqual(r.boundingBox, { x: 100, y: 50, width: 200, height: 20 });
});

test("dpr=2: every coordinate AND dimension scales", () => {
  const r = domRectToScreenshotBox(box(), {
    devicePixelRatio: 2,
    imageWidth: 1600,
    imageHeight: 1200,
  });
  assert.deepEqual(r.boundingBox, { x: 200, y: 100, width: 400, height: 40 });
});

test("dpr=1.5 produces integer pixel bounds that fully cover the element", () => {
  const r = domRectToScreenshotBox({ x: 10.4, y: 20.6, width: 33.3, height: 11.1 }, {
    devicePixelRatio: 1.5,
    imageWidth: 800,
    imageHeight: 600,
  });
  const b = r.boundingBox;
  // Must not under-cover: floor the origin, ceil the far edge.
  assert.ok(Number.isInteger(b.x) && Number.isInteger(b.y));
  assert.ok(b.x <= 10.4 * 1.5, "x must not crop the left edge");
  assert.ok(b.y <= 20.6 * 1.5, "y must not crop the top edge");
  assert.ok(b.x + b.width >= (10.4 + 33.3) * 1.5, "must not crop the right edge");
  assert.ok(b.y + b.height >= (20.6 + 11.1) * 1.5, "must not crop the bottom edge");
});

test("viewport capture: scroll offset is NOT added — getBoundingClientRect is already viewport-relative", () => {
  // The classic double-count bug. A page scrolled 500px down still has an
  // element at viewport y=50 sitting at screenshot y=50.
  const r = domRectToScreenshotBox(box(), {
    ...VIEWPORT,
    captureMode: "viewport",
    scrollX: 300,
    scrollY: 500,
  });
  assert.deepEqual(r.boundingBox, { x: 100, y: 50, width: 200, height: 20 });
});

test("fullpage capture: scroll offset IS added, because the image spans the document", () => {
  const r = domRectToScreenshotBox(box(), {
    devicePixelRatio: 1,
    imageWidth: 800,
    imageHeight: 5000,
    captureMode: "fullpage",
    scrollX: 0,
    scrollY: 500,
  });
  assert.deepEqual(r.boundingBox, { x: 100, y: 550, width: 200, height: 20 });
});

test("accepts DOMRect's left/top naming as well as x/y", () => {
  const r = domRectToScreenshotBox({ left: 100, top: 50, width: 200, height: 20 }, VIEWPORT);
  assert.deepEqual(r.boundingBox, { x: 100, y: 50, width: 200, height: 20 });
});

test("element partially off the right edge is clipped to the image", () => {
  const r = domRectToScreenshotBox({ x: 700, y: 50, width: 300, height: 20 }, VIEWPORT);
  assert.equal(r.visible, true);
  assert.deepEqual(r.boundingBox, { x: 700, y: 50, width: 100, height: 20 });
});

test("element partially above the top edge is clipped", () => {
  const r = domRectToScreenshotBox({ x: 100, y: -10, width: 200, height: 50 }, VIEWPORT);
  assert.deepEqual(r.boundingBox, { x: 100, y: 0, width: 200, height: 40 });
});

test("element scrolled entirely out of view is NOT visible — nothing to redact in this image", () => {
  const r = domRectToScreenshotBox({ x: 100, y: -500, width: 200, height: 20 }, VIEWPORT);
  assert.equal(r.visible, false);
  assert.equal(r.boundingBox, undefined);
});

test("element entirely below the fold is not visible", () => {
  const r = domRectToScreenshotBox({ x: 100, y: 900, width: 200, height: 20 }, VIEWPORT);
  assert.equal(r.visible, false);
});

test("zero-sized (display:none-like) element is not visible, not an error", () => {
  assert.equal(domRectToScreenshotBox({ x: 10, y: 10, width: 0, height: 0 }, VIEWPORT).visible, false);
  assert.equal(domRectToScreenshotBox({ x: 10, y: 10, width: 200, height: 0 }, VIEWPORT).visible, false);
});

test("padding expands the box but never past the image bounds", () => {
  const r = domRectToScreenshotBox({ x: 0, y: 0, width: 50, height: 10 }, { ...VIEWPORT, padding: 4 });
  assert.deepEqual(r.boundingBox, { x: 0, y: 0, width: 54, height: 14 });
});

test("padding covers anti-aliased glyph edges on all four sides", () => {
  const r = domRectToScreenshotBox({ x: 100, y: 100, width: 50, height: 10 }, { ...VIEWPORT, padding: 3 });
  assert.deepEqual(r.boundingBox, { x: 97, y: 97, width: 56, height: 16 });
});

// --- fail-closed: malformed input must never yield a silently-wrong box ---

test("FAIL-CLOSED: non-finite rect values throw", () => {
  assert.throws(() => domRectToScreenshotBox({ x: NaN, y: 0, width: 10, height: 10 }, VIEWPORT), GeometryError);
  assert.throws(() => domRectToScreenshotBox({ x: 0, y: Infinity, width: 10, height: 10 }, VIEWPORT), GeometryError);
});

test("FAIL-CLOSED: missing rect throws", () => {
  assert.throws(() => domRectToScreenshotBox(null, VIEWPORT), GeometryError);
});

test("FAIL-CLOSED: invalid devicePixelRatio throws rather than defaulting", () => {
  assert.throws(() => domRectToScreenshotBox(box(), { ...VIEWPORT, devicePixelRatio: 0 }), GeometryError);
  assert.throws(() => domRectToScreenshotBox(box(), { ...VIEWPORT, devicePixelRatio: -1 }), GeometryError);
});

test("FAIL-CLOSED: invalid image dimensions throw", () => {
  assert.throws(() => domRectToScreenshotBox(box(), { devicePixelRatio: 1, imageWidth: 0, imageHeight: 600 }), GeometryError);
});

test("FAIL-CLOSED: unknown captureMode throws instead of guessing", () => {
  assert.throws(() => domRectToScreenshotBox(box(), { ...VIEWPORT, captureMode: "magic" }), GeometryError);
});

test("negative width in the source rect throws", () => {
  assert.throws(() => domRectToScreenshotBox({ x: 10, y: 10, width: -5, height: 10 }, VIEWPORT), GeometryError);
});
