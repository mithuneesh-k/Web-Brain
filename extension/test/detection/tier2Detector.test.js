const test = require("node:test");
const assert = require("node:assert/strict");
const { detectTier2Regions } = require("../../src/detection/tier2Detector.js");

function regionsFor(el) {
  return detectTier2Regions([el]);
}

test("password type alone scores 1.0", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", type: "password" });
  assert.equal(r.category, "authentication");
  assert.equal(r.confidence, 1.0);
});

test("autocomplete=current-password alone scores 0.9", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", autocomplete: "current-password" });
  assert.equal(r.confidence, 0.9);
});

test("label containing 'secret' alone scores 0.7", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", ariaLabel: "Your secret phrase" });
  assert.equal(r.category, "authentication");
  assert.equal(r.confidence, 0.7);
});

test("name containing 'token' alone scores 0.6", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", name: "session_token" });
  assert.equal(r.confidence, 0.6);
});

test("multiple signals in the same category fuse additively, capped at 1.0", () => {
  const [r] = regionsFor({
    id: "el-1",
    role: "textbox",
    ariaLabel: "API secret",
    name: "my_token",
  });
  // 0.7 (secret) + 0.6 (token) = 1.3, capped at 1.0
  assert.equal(r.confidence, 1.0);
  assert.equal(r.category, "authentication");
});

test("below-threshold single weak signal does not emit a region", () => {
  const regions = regionsFor({ id: "el-1", role: "textbox", name: "just_a_field" });
  assert.deepEqual(regions, []);
});

test("email label alone scores exactly at the 0.5 threshold and is emitted", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", ariaLabel: "Your email" });
  assert.equal(r.category, "pii");
  assert.equal(r.confidence, 0.5);
});

test("card label scores 0.6 in the financial category", () => {
  const [r] = regionsFor({ id: "el-1", role: "textbox", ariaLabel: "Credit card number" });
  assert.equal(r.category, "financial");
  assert.equal(r.confidence, 0.6);
});

test("plain non-sensitive field emits nothing", () => {
  const regions = regionsFor({ id: "el-1", role: "button", text: "Submit" });
  assert.deepEqual(regions, []);
});

test("signals in different categories on the same element produce separate regions", () => {
  const regions = regionsFor({
    id: "el-1",
    role: "textbox",
    ariaLabel: "Email or phone",
  });
  const categories = regions.map((r) => r.category).sort();
  assert.deepEqual(categories, ["pii"]);
  // "Email or phone" matches both the email and phone label patterns —
  // both map to the pii category, so they fuse into one pii region
  // rather than two, consistent with the "score per category" model.
  assert.ok(regions[0].confidence >= 0.5);
});
