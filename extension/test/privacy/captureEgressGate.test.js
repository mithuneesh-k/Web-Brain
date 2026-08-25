const test = require("node:test");
const assert = require("node:assert/strict");
const { assertCaptureSafeForEgress } = require("../../src/privacy/captureEgressGate.js");

const RAW = "data:image/png;base64,RAWRAWRAW";
const SANITIZED = "data:image/png;base64,SANITIZEDXX";

/** A capture that passed every stage of the pipeline correctly. */
function goodCapture(overrides = {}) {
  return {
    redactionEnabled: true,
    snapshotOk: true,
    snapshotStable: true,
    regionCollectionComplete: true,
    regions: [{ kind: "password", rect: { x: 1, y: 2, w: 3, h: 4 } }],
    rawDataUrl: RAW,
    sanitizedDataUrl: SANITIZED,
    payloadDataUrl: SANITIZED,
    ...overrides,
  };
}

test("a correctly sanitized capture is ALLOWED", () => {
  const r = assertCaptureSafeForEgress(goodCapture());
  assert.equal(r.allowed, true, JSON.stringify(r.reasons));
});

// --- Invariant 1: policy was enabled ---

test("BLOCKED when redaction policy was disabled", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ redactionEnabled: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /policy|disabled/i.test(x)));
});

// --- Invariant 2: valid privacy snapshot ---

test("BLOCKED when the privacy snapshot was unavailable", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ snapshotOk: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /snapshot/i.test(x)));
});

// --- Invariant 2b: T16 TOCTOU ---

test("T16: BLOCKED when the page changed between region collection and capture", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ snapshotStable: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /TOCTOU|changed between|stale/i.test(x)), JSON.stringify(r.reasons));
});

// --- Invariant 3: region collection completed ---

test("BLOCKED when region collection did not complete (a frame failed inspection)", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ regionCollectionComplete: false }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /collection/i.test(x)));
});

// --- Invariant 4: THE T17 CHECK — transformation is not proof ---

test("T17: BLOCKED when regions existed but the image came back byte-identical", () => {
  // This is the exact upstream fail-open path: _redactScreenshotDataUrl
  // returns the original dataUrl on internal failure, so "redacted" is
  // the raw capture and nothing downstream can tell.
  const r = assertCaptureSafeForEgress(goodCapture({ sanitizedDataUrl: RAW }));
  assert.equal(r.allowed, false);
  assert.ok(
    r.reasons.some((x) => /identical|no-op|unchanged/i.test(x)),
    JSON.stringify(r.reasons)
  );
});

test("T17: a capture with NO regions may legitimately be unchanged", () => {
  // Nothing sensitive on the page means the sanitized image is expected
  // to equal the raw one. This must not be a false positive.
  const r = assertCaptureSafeForEgress(
    goodCapture({ regions: [], sanitizedDataUrl: RAW, payloadDataUrl: RAW })
  );
  assert.equal(r.allowed, true, JSON.stringify(r.reasons));
});

// --- Invariant 5: the payload must BE the sanitized image ---

test("BLOCKED when the payload is the raw capture rather than the sanitized copy", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ payloadDataUrl: RAW }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /payload/i.test(x)));
});

test("BLOCKED when the payload is some third image nobody sanitized", () => {
  const r = assertCaptureSafeForEgress(
    goodCapture({ payloadDataUrl: "data:image/png;base64,SOMETHINGELSE" })
  );
  assert.equal(r.allowed, false);
});

// --- Invariant 6: metadata complete and recognized ---

test("BLOCKED when a required field is missing entirely", () => {
  const c = goodCapture();
  delete c.snapshotOk;
  const r = assertCaptureSafeForEgress(c);
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /missing|snapshotOk/i.test(x)));
});

test("BLOCKED when a boolean invariant is a truthy non-boolean", () => {
  // "true" (string) must not satisfy a security invariant.
  const r = assertCaptureSafeForEgress(goodCapture({ snapshotOk: "true" }));
  assert.equal(r.allowed, false);
});

test("BLOCKED when regions is not an array", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ regions: "two" }));
  assert.equal(r.allowed, false);
});

test("BLOCKED when a region is malformed", () => {
  const r = assertCaptureSafeForEgress(
    goodCapture({ regions: [{ kind: "password", rect: { x: 1, y: 2, w: 0, h: 4 } }] })
  );
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /region/i.test(x)));
});

test("BLOCKED when an unrecognised field is present — unknown state is not safe state", () => {
  const r = assertCaptureSafeForEgress(goodCapture({ experimentalBypass: true }));
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /unexpected|unrecognis/i.test(x)));
});

// --- Invariant 7: any uncertainty blocks ---

test("BLOCKED on null/undefined/non-object input", () => {
  for (const bad of [null, undefined, "capture", 42, []]) {
    assert.equal(assertCaptureSafeForEgress(bad).allowed, false, `${JSON.stringify(bad)} was allowed`);
  }
});

test("BLOCKED when an internal error occurs — never throws, never allows", () => {
  const hostile = goodCapture();
  Object.defineProperty(hostile, "regions", {
    get() { throw new Error("boom"); },
  });
  const r = assertCaptureSafeForEgress(hostile);
  assert.equal(r.allowed, false);
  assert.ok(r.reasons.some((x) => /internal error/i.test(x)));
});

test("every blocked result carries at least one human-readable reason", () => {
  const cases = [
    goodCapture({ redactionEnabled: false }),
    goodCapture({ snapshotOk: false }),
    goodCapture({ sanitizedDataUrl: RAW }),
    goodCapture({ payloadDataUrl: RAW }),
    null,
  ];
  for (const c of cases) {
    const r = assertCaptureSafeForEgress(c);
    assert.equal(r.allowed, false);
    assert.ok(Array.isArray(r.reasons) && r.reasons.length > 0);
    assert.ok(r.reasons.every((x) => typeof x === "string" && x.length > 0));
  }
});

test("reasons never echo the image payloads themselves", () => {
  // A blocked-egress log must not become the leak it prevented.
  const r = assertCaptureSafeForEgress(goodCapture({ sanitizedDataUrl: RAW }));
  const joined = r.reasons.join(" ");
  assert.ok(!joined.includes("RAWRAWRAW"));
  assert.ok(!joined.includes("SANITIZEDXX"));
});
