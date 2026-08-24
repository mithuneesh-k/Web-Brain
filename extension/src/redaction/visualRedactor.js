/**
 * Tier 3 visual redaction — operates on raw RGBA pixel buffers.
 *
 * The input shape ({width, height, data}) is deliberately ImageData's
 * shape, which is exactly what OffscreenCanvas.getImageData() returns
 * inside WebBrain's service worker. That keeps this module a pure,
 * dependency-free, deterministically testable function while mapping
 * 1:1 onto the real extension environment — no canvas needed to test
 * it, no rewrite needed to ship it.
 *
 * Attachment point (see docs/specs/phase9-visual-redaction.md):
 * WebBrain funnels every screenshot into the provider message array
 * through one four-line helper, `_withImageDetail()` (agent.js:9996,
 * Chrome and Firefox both). Decoding the data URL there, running it
 * through this function, and re-encoding is the whole Tier 3 seam.
 *
 * FAIL-CLOSED: a region this function cannot apply is an error, never a
 * silent skip. A sensitive region we failed to mask must block egress,
 * not sail through unmasked — the caller is expected to let the throw
 * propagate and abort the request.
 */

class RedactionError extends Error {
  constructor(message) {
    super(message);
    this.name = "RedactionError";
  }
}

// Categories whose visual content should be obscured but whose presence
// and shape stay legible (a blurred face still reads as "a face here",
// which preserves layout understanding for the model). Everything else
// is flattened, because partial legibility of a credential is a leak.
const BLUR_CATEGORIES = new Set(["visual_identity"]);

// Minimum radius, and the divisor used to scale radius to the region.
// A FIXED small radius is a privacy-theatre failure mode: on a large
// region it visibly "blurs" while leaving the subject recognisable.
// Radius must grow with the region, so detail is destroyed at any size.
const BLUR_MIN_RADIUS = 8;
const BLUR_SIZE_DIVISOR = 4;

function blurRadiusFor(rect) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  return Math.max(BLUR_MIN_RADIUS, Math.floor(Math.min(w, h) / BLUR_SIZE_DIVISOR));
}

function assertValidBox(region, imgWidth, imgHeight) {
  const box = region.boundingBox;
  if (!box || typeof box !== "object") {
    throw new RedactionError(
      `region "${region.id}" has no boundingBox; cannot redact it visually (fail-closed)`
    );
  }
  for (const k of ["x", "y", "width", "height"]) {
    if (typeof box[k] !== "number" || !Number.isFinite(box[k])) {
      throw new RedactionError(`region "${region.id}" boundingBox.${k} is not a finite number`);
    }
  }
  if (box.width <= 0 || box.height <= 0) {
    throw new RedactionError(`region "${region.id}" boundingBox has non-positive dimensions`);
  }
  const x0 = Math.floor(box.x);
  const y0 = Math.floor(box.y);
  const x1 = Math.ceil(box.x + box.width);
  const y1 = Math.ceil(box.y + box.height);
  // Clipping a partially off-screen box is fine. A box with no overlap
  // at all means our geometry disagrees with the image we were handed —
  // that is a bug we must not paper over by ignoring the region.
  if (x1 <= 0 || y1 <= 0 || x0 >= imgWidth || y0 >= imgHeight) {
    throw new RedactionError(
      `region "${region.id}" boundingBox lies entirely outside the ${imgWidth}x${imgHeight} image (fail-closed)`
    );
  }
  return {
    x0: Math.max(0, x0),
    y0: Math.max(0, y0),
    x1: Math.min(imgWidth, x1),
    y1: Math.min(imgHeight, y1),
  };
}

function applyMask(data, width, rect) {
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const i = (y * width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
}

function applyBlur(data, source, width, height, rect) {
  // Box blur sampled from `source` (the unmodified copy) so earlier
  // writes inside the same region don't feed back into later averages.
  // Sampling is CLAMPED TO THE REGION, not the whole image: sampling
  // outside would pull unredacted surrounding pixels in, and would also
  // bleed the sensitive region's colour outward past its own box.
  const radius = blurRadiusFor(rect);
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      const sy0 = Math.max(rect.y0, y - radius);
      const sy1 = Math.min(rect.y1 - 1, y + radius);
      const sx0 = Math.max(rect.x0, x - radius);
      const sx1 = Math.min(rect.x1 - 1, x + radius);
      for (let sy = sy0; sy <= sy1; sy++) {
        for (let sx = sx0; sx <= sx1; sx++) {
          const si = (sy * width + sx) * 4;
          r += source[si];
          g += source[si + 1];
          b += source[si + 2];
          n++;
        }
      }
      const i = (y * width + x) * 4;
      data[i] = Math.round(r / n);
      data[i + 1] = Math.round(g / n);
      data[i + 2] = Math.round(b / n);
      data[i + 3] = 255;
    }
  }
}

/**
 * @param {{width:number, height:number, data:Uint8ClampedArray}} imageData
 * @param {object[]} regions - SensitiveRegion[] carrying boundingBox
 * @returns {{width:number, height:number, data:Uint8ClampedArray, applied:object[]}}
 * @throws {RedactionError} if any region cannot be applied (fail-closed)
 */
function redactImageData(imageData, regions) {
  if (!imageData || typeof imageData !== "object") {
    throw new RedactionError("imageData is not an object");
  }
  const { width, height } = imageData;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RedactionError("imageData has invalid dimensions");
  }
  if (!imageData.data || imageData.data.length !== width * height * 4) {
    throw new RedactionError("imageData.data length does not match width*height*4");
  }
  if (!Array.isArray(regions)) {
    throw new RedactionError("regions must be an array");
  }

  // Copy, so the caller keeps the untouched original for local use.
  const out = new Uint8ClampedArray(imageData.data);
  const source = new Uint8ClampedArray(imageData.data);
  const applied = [];

  for (const region of regions) {
    const rect = assertValidBox(region, width, height);
    const mode = BLUR_CATEGORIES.has(region.category) ? "blur" : "mask";
    if (mode === "blur") {
      applyBlur(out, source, width, height, rect);
    } else {
      applyMask(out, width, rect);
    }
    applied.push({ id: region.id, elementId: region.elementId, category: region.category, mode, rect });
  }

  return { width, height, data: out, applied };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { redactImageData, RedactionError, BLUR_CATEGORIES, blurRadiusFor };
} else {
  self.redactImageData = redactImageData;
  self.RedactionError = RedactionError;
}
