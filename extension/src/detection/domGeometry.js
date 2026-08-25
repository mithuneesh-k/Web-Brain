/**
 * DOM geometry -> screenshot pixel mapping.
 *
 * This is the bridge that makes Tier 1/Tier 2 detections usable for
 * visual redaction: they identify *which element* is sensitive, this
 * turns that element's on-screen rectangle into the pixel box
 * `redactImageData()` needs.
 *
 * THE COORDINATE TRAP, stated once so nobody re-introduces it:
 * `getBoundingClientRect()` returns **viewport-relative** CSS pixels —
 * scroll offset is already accounted for. For a viewport capture
 * (chrome.tabs.captureVisibleTab), adding scrollX/scrollY double-counts
 * and pushes every box off by the scroll distance. Scroll offset is
 * added **only** for a full-page capture, where the image spans the
 * whole document rather than the viewport. `captureMode` makes that
 * choice explicit rather than implicit.
 *
 * FAIL-CLOSED vs NOT-VISIBLE — a deliberate distinction:
 *  - Malformed input (NaN, missing rect, bad DPR) THROWS. We must never
 *    emit a confidently-wrong box; a wrong box redacts the wrong pixels
 *    and leaves the sensitive ones exposed.
 *  - An element genuinely outside the captured image returns
 *    `{visible: false}`. That is not a failure: those pixels are not in
 *    the image, so there is nothing to redact. (Its *text* is still
 *    handled separately by Tier 1/2 text redaction.)
 */

class GeometryError extends Error {
  constructor(message) {
    super(message);
    this.name = "GeometryError";
  }
}

const CAPTURE_MODES = new Set(["viewport", "fullpage"]);

function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * @param {object} rect - a DOMRect or DOMRect-like ({x|left, y|top, width, height}), CSS px
 * @param {object} options
 * @param {number} options.devicePixelRatio
 * @param {number} options.imageWidth  - captured image width, device px
 * @param {number} options.imageHeight - captured image height, device px
 * @param {'viewport'|'fullpage'} [options.captureMode='viewport']
 * @param {number} [options.scrollX=0] - only used for 'fullpage'
 * @param {number} [options.scrollY=0] - only used for 'fullpage'
 * @param {number} [options.padding=0] - CSS px of slack around the element
 * @returns {{visible:false}|{visible:true, boundingBox:{x:number,y:number,width:number,height:number}}}
 * @throws {GeometryError}
 */
function domRectToScreenshotBox(rect, options = {}) {
  if (!rect || typeof rect !== "object") {
    throw new GeometryError("rect is missing or not an object");
  }

  const {
    devicePixelRatio,
    imageWidth,
    imageHeight,
    captureMode = "viewport",
    scrollX = 0,
    scrollY = 0,
    padding = 0,
  } = options;

  if (!CAPTURE_MODES.has(captureMode)) {
    throw new GeometryError(
      `unknown captureMode "${captureMode}" (expected 'viewport' or 'fullpage')`
    );
  }
  if (!finite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new GeometryError(`invalid devicePixelRatio: ${devicePixelRatio}`);
  }
  if (!Number.isInteger(imageWidth) || !Number.isInteger(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
    throw new GeometryError(`invalid image dimensions: ${imageWidth}x${imageHeight}`);
  }
  if (!finite(padding) || padding < 0) {
    throw new GeometryError(`invalid padding: ${padding}`);
  }

  const cssX = finite(rect.x) ? rect.x : rect.left;
  const cssY = finite(rect.y) ? rect.y : rect.top;
  const cssW = rect.width;
  const cssH = rect.height;

  for (const [name, v] of [["x/left", cssX], ["y/top", cssY], ["width", cssW], ["height", cssH]]) {
    if (!finite(v)) throw new GeometryError(`rect.${name} is not a finite number`);
  }
  if (cssW < 0 || cssH < 0) {
    throw new GeometryError("rect has negative dimensions");
  }

  // A zero-area element occupies no pixels: nothing to redact.
  if (cssW === 0 || cssH === 0) return { visible: false };

  const offsetX = captureMode === "fullpage" ? scrollX : 0;
  const offsetY = captureMode === "fullpage" ? scrollY : 0;
  if (captureMode === "fullpage" && (!finite(scrollX) || !finite(scrollY))) {
    throw new GeometryError("fullpage capture requires finite scrollX/scrollY");
  }

  // Expand by padding in CSS space, then convert. Floor the origin and
  // ceil the far edge so a fractional-DPR box never crops the element.
  const left = (cssX + offsetX - padding) * devicePixelRatio;
  const top = (cssY + offsetY - padding) * devicePixelRatio;
  const right = (cssX + offsetX + cssW + padding) * devicePixelRatio;
  const bottom = (cssY + offsetY + cssH + padding) * devicePixelRatio;

  const x0 = Math.max(0, Math.floor(left));
  const y0 = Math.max(0, Math.floor(top));
  const x1 = Math.min(imageWidth, Math.ceil(right));
  const y1 = Math.min(imageHeight, Math.ceil(bottom));

  // No overlap with the captured image at all.
  if (x1 <= x0 || y1 <= y0) return { visible: false };

  return {
    visible: true,
    boundingBox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { domRectToScreenshotBox, GeometryError, CAPTURE_MODES };
} else {
  self.domRectToScreenshotBox = domRectToScreenshotBox;
  self.GeometryError = GeometryError;
}
