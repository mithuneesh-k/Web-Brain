const test = require("node:test");
const assert = require("node:assert/strict");
const { assertSafeForEgress } = require("../../src/privacy/egressGate.js");

function baseContext(overrides = {}) {
  return {
    version: "1.1.0",
    page_url_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
    elements: [],
    privacy: {
      redaction_applied: false,
      redacted_regions: [],
      redaction_types: [],
      visual_context_version: "none",
    },
    timestamp: "2026-08-24T00:00:00Z",
    ...overrides,
  };
}

test("Test 1: raw password -> BLOCKED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "textbox", text: "hunter2Password!", redacted: false }],
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /password/i.test(r)));
});

test("Test 2: API key -> BLOCKED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "textbox", text: "sk-abcdefghijklmnopqrstuvwx", redacted: false }],
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /api.?key/i.test(r)));
});

test("Test 3: unredacted email -> BLOCKED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "textbox", text: "someone@example.com", redacted: false }],
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /email/i.test(r)));
});

test("Test 4: redacted sensitive value -> ALLOWED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "textbox", text: "[REDACTED]", redacted: true }],
    privacy: {
      redaction_applied: true,
      redacted_regions: ["el-1"],
      redaction_types: ["pii"],
      visual_context_version: "stub-1",
    },
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, true);
});

test("Test 5: claims redaction but original value still present -> BLOCKED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "textbox", text: "someone@example.com", redacted: true }],
    privacy: {
      redaction_applied: true,
      redacted_regions: ["el-1"],
      redaction_types: ["pii"],
      visual_context_version: "stub-1",
    },
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /claims redaction|still present|leftover/i.test(r)));
});

test("Test 6: invalid privacy metadata (missing required field) -> BLOCKED", () => {
  const ctx = baseContext();
  delete ctx.privacy.redaction_applied;
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /privacy metadata|invalid/i.test(r)));
});

test("Test 7: unknown element role -> BLOCKED", () => {
  const ctx = baseContext({
    elements: [{ id: "el-1", role: "totally-unknown-role", text: "hi", redacted: false }],
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /role|classification/i.test(r)));
});

test("Test 8: validator internal exception -> BLOCKED (fail-closed)", () => {
  // Passing a circular structure makes internal JSON handling throw.
  const ctx = baseContext();
  ctx.elements = [];
  const circular = {};
  circular.self = circular;
  ctx.elements.push(circular);
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /error|exception|internal/i.test(r)));
});

test("Test 9: valid structural-only context -> ALLOWED", () => {
  const ctx = baseContext({
    elements: [
      { id: "el-1", role: "button", text: "Say hello", redacted: false },
      { id: "el-2", role: "link", text: "Learn more", redacted: false },
    ],
  });
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, true);
});

test("Test 10: payload with a screenshot-like field -> BLOCKED", () => {
  const ctx = baseContext();
  ctx.screenshot = "data:image/png;base64,aaaa";
  const result = assertSafeForEgress(ctx);
  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((r) => /unexpected field|screenshot|not permitted/i.test(r)));
});
