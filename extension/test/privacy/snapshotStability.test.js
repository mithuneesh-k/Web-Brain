const test = require("node:test");
const assert = require("node:assert/strict");
const { assertSnapshotsStable } = require("../../src/privacy/snapshotStability.js");

/** A region snapshot as the collector would report it. */
function snap(regions, viewport = { width: 800, height: 600 }) {
  return { viewport, regions };
}

const PWD = { kind: "password", rect: { x: 20, y: 100, w: 320, h: 32 } };
const EMAIL = { kind: "email", rect: { x: 20, y: 50, w: 320, h: 32 } };

test("identical before/after snapshots are STABLE", () => {
  const r = assertSnapshotsStable(snap([PWD, EMAIL]), snap([PWD, EMAIL]));
  assert.equal(r.stable, true, JSON.stringify(r.reasons));
});

test("T16: a region that MOVED between collection and capture is UNSTABLE", () => {
  // The exact leak: boxes computed at rect A, page reflows, capture shows
  // the secret at rect B. Masking A leaves the secret visible at B.
  const moved = { kind: "password", rect: { x: 20, y: 260, w: 320, h: 32 } };
  const r = assertSnapshotsStable(snap([PWD]), snap([moved]));
  assert.equal(r.stable, false);
  assert.ok(r.reasons.some((x) => /changed|differ/i.test(x)));
});

test("T16: a region that RESIZED is unstable", () => {
  const grown = { kind: "password", rect: { x: 20, y: 100, w: 480, h: 32 } };
  assert.equal(assertSnapshotsStable(snap([PWD]), snap([grown])).stable, false);
});

test("T16: a NEW sensitive region appearing after collection is unstable", () => {
  // Lazy-rendered secret. Collection saw one region, the capture has two.
  const r = assertSnapshotsStable(snap([PWD]), snap([PWD, EMAIL]));
  assert.equal(r.stable, false);
  assert.ok(r.reasons.some((x) => /count|changed|differ/i.test(x)));
});

test("T16: a region DISAPPEARING is also unstable", () => {
  assert.equal(assertSnapshotsStable(snap([PWD, EMAIL]), snap([PWD])).stable, false);
});

test("T16: a viewport resize mid-capture is unstable", () => {
  const r = assertSnapshotsStable(
    snap([PWD], { width: 800, height: 600 }),
    snap([PWD], { width: 900, height: 600 })
  );
  assert.equal(r.stable, false);
  assert.ok(r.reasons.some((x) => /viewport/i.test(x)));
});

test("region ORDER must not cause a false instability", () => {
  // Collectors walk frames concurrently; ordering is not guaranteed and
  // is not a security-relevant change.
  const r = assertSnapshotsStable(snap([PWD, EMAIL]), snap([EMAIL, PWD]));
  assert.equal(r.stable, true, JSON.stringify(r.reasons));
});

test("a kind change on the same rect is unstable", () => {
  const reclassified = { kind: "input", rect: { ...PWD.rect } };
  assert.equal(assertSnapshotsStable(snap([PWD]), snap([reclassified])).stable, false);
});

test("two empty snapshots are stable — a page with nothing sensitive", () => {
  assert.equal(assertSnapshotsStable(snap([]), snap([])).stable, true);
});

// --- fail-closed ---

test("FAIL-CLOSED: a missing snapshot is unstable, not 'unchanged'", () => {
  assert.equal(assertSnapshotsStable(null, snap([PWD])).stable, false);
  assert.equal(assertSnapshotsStable(snap([PWD]), null).stable, false);
  assert.equal(assertSnapshotsStable(null, null).stable, false);
});

test("FAIL-CLOSED: a malformed snapshot is unstable", () => {
  assert.equal(assertSnapshotsStable({ regions: "x" }, snap([])).stable, false);
  assert.equal(assertSnapshotsStable(snap([]), { viewport: null, regions: [] }).stable, false);
});

test("FAIL-CLOSED: never throws, even on hostile input", () => {
  const hostile = {};
  Object.defineProperty(hostile, "regions", { get() { throw new Error("boom"); } });
  const r = assertSnapshotsStable(hostile, snap([]));
  assert.equal(r.stable, false);
  assert.ok(r.reasons.some((x) => /internal error/i.test(x)));
});

test("reasons never echo region text or values", () => {
  const withText = { kind: "email", rect: { x: 1, y: 1, w: 10, h: 10 }, text: "secret@example.com" };
  const r = assertSnapshotsStable(snap([withText]), snap([]));
  assert.equal(r.stable, false);
  assert.ok(!r.reasons.join(" ").includes("secret@example.com"));
});
