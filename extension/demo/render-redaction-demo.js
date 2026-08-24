/**
 * Phase 9 visual proof. Renders a mock "account page" screenshot, runs it
 * through Ozer's Tier 3 visual redactor, and writes before/after PNGs.
 *
 * This is a DEMO ARTIFACT, not production code. It exists so the
 * redaction pipeline can be inspected by eye, not only asserted on in
 * pixel tests. It uses no dependencies: PNG encoding is done here with
 * node:zlib.
 *
 *   node extension/demo/render-redaction-demo.js [outDir]
 */

const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");
const { redactImageData } = require("../src/redaction/visualRedactor.js");

// ---------- tiny PNG encoder (RGBA, no deps) ----------

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type RGBA
  // 10,11,12 = compression/filter/interlace = 0
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < width * 4; x++) {
      raw[y * (width * 4 + 1) + 1 + x] = data[y * width * 4 + x];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- mock screenshot ----------

const W = 560, H = 360;

function blank(w, h, rgb) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

function rect(img, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
      const i = (yy * img.width + xx) * 4;
      img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
    }
  }
}

/** Text-like run of glyph blocks, so redaction is visible by eye. */
function textLine(img, x, y, widths, rgb, h = 9, gap = 4) {
  let cx = x;
  for (const w of widths) { rect(img, cx, y, w, h, rgb); cx += w + gap; }
  return cx;
}

/** A face: skin oval, hair, two eyes, mouth — enough that blurring reads. */
function face(img, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if ((x * x) / (r * r) + (y * y) / (r * 1.15 * (r * 1.15)) <= 1) {
        rect(img, cx + x, cy + y, 1, 1, [232, 190, 160]);
      }
    }
  }
  rect(img, cx - r, cy - r - 2, r * 2, Math.round(r * 0.55), [60, 42, 32]);
  rect(img, cx - Math.round(r * 0.45), cy - 3, 5, 5, [40, 40, 48]);
  rect(img, cx + Math.round(r * 0.2), cy - 3, 5, 5, [40, 40, 48]);
  rect(img, cx - Math.round(r * 0.3), cy + Math.round(r * 0.42), Math.round(r * 0.6), 3, [150, 70, 70]);
}

function buildMockScreenshot() {
  const img = blank(W, H, [247, 248, 250]);
  rect(img, 0, 0, W, 46, [38, 74, 140]);                 // header bar
  textLine(img, 18, 18, [30, 22, 14, 26], [255, 255, 255], 10);  // "Account" title
  rect(img, 0, 46, W, 2, [225, 228, 234]);

  face(img, 74, 116, 34);                                 // avatar
  textLine(img, 130, 82, [46, 30, 38], [55, 60, 70], 11); // display name
  textLine(img, 130, 108, [28, 20], [140, 148, 160], 8);  // "Email" label
  textLine(img, 130, 124, [54, 12, 40, 18], [55, 60, 70]);// email value
  textLine(img, 130, 150, [30, 22], [140, 148, 160], 8);  // "Phone" label
  textLine(img, 130, 166, [24, 34, 30], [55, 60, 70]);    // phone value

  rect(img, 24, 214, W - 48, 1, [225, 228, 234]);
  textLine(img, 24, 232, [42, 26], [140, 148, 160], 8);   // "Password" label
  rect(img, 24, 248, 260, 26, [255, 255, 255]);
  rect(img, 24, 248, 260, 1, [205, 210, 220]);
  rect(img, 24, 273, 260, 1, [205, 210, 220]);
  textLine(img, 34, 256, [7, 7, 7, 7, 7, 7, 7, 7], [90, 96, 108], 9, 3); // dots

  rect(img, 300, 248, 110, 26, [38, 140, 86]);            // Save button
  textLine(img, 322, 256, [20, 14, 22], [255, 255, 255], 9);

  textLine(img, 24, 312, [40, 28, 34, 22, 30], [150, 158, 170], 8); // footer
  return img;
}

// Regions a real Tier1/2/3 pass would emit. Boxes are padded slightly,
// as a real detector would, so glyph edges are fully covered.
const REGIONS = [
  { id: "r-face", elementId: "avatar", category: "visual_identity", subtype: "face",
    confidence: 0.91, source: "tier3-visual", boundingBox: { x: 34, y: 74, width: 82, height: 88 } },
  { id: "r-email", elementId: "el-email", category: "pii", subtype: "email",
    confidence: 0.98, source: "tier1-dom-pattern", boundingBox: { x: 128, y: 121, width: 146, height: 15 } },
  { id: "r-phone", elementId: "el-phone", category: "pii", subtype: "phone",
    confidence: 0.94, source: "tier1-dom-pattern", boundingBox: { x: 128, y: 163, width: 100, height: 15 } },
  { id: "r-pass", elementId: "el-password", category: "authentication", subtype: "password",
    confidence: 1.0, source: "tier1-dom-pattern", boundingBox: { x: 26, y: 250, width: 256, height: 22 } },
];

function main() {
  const outDir = process.argv[2] || path.join(__dirname, "out");
  fs.mkdirSync(outDir, { recursive: true });

  const before = buildMockScreenshot();
  const after = redactImageData(before, REGIONS);

  const beforePath = path.join(outDir, "screenshot-before.png");
  const afterPath = path.join(outDir, "screenshot-after-ozer.png");
  fs.writeFileSync(beforePath, encodePNG(before));
  fs.writeFileSync(afterPath, encodePNG(after));

  console.log("Ozer Tier 3 visual redaction demo");
  console.log(`  image           ${before.width}x${before.height}`);
  console.log(`  regions applied ${after.applied.length}`);
  for (const a of after.applied) {
    console.log(`    ${a.mode.padEnd(5)} ${a.category.padEnd(16)} ${a.id}`);
  }
  console.log(`  before -> ${beforePath}`);
  console.log(`  after  -> ${afterPath}`);
}

main();
