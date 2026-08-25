const test = require("node:test");
const assert = require("node:assert/strict");
const { detectSensitiveElements } = require("../../src/detection/domDetector.js");

function detect(elements) {
  return detectSensitiveElements(elements);
}

test("password: type=password is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "password", text: "hunter2Password!" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("authentication"));
});

test("password: negative — plain text field is not detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", name: "comment", text: "hello world" }]);
  assert.equal(r.sensitive, false);
});

test("otp: autocomplete=one-time-code is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", autocomplete: "one-time-code", text: "123456" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("authentication"));
});

test("otp: negative — unrelated autocomplete value is not detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", autocomplete: "given-name", text: "Alex" }]);
  assert.equal(r.sensitive, false);
});

test("api key: name=api_key is detected regardless of value", () => {
  const [r] = detect([{ id: "e1", role: "textbox", name: "api_key", text: "whatever" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("authentication"));
});

test("api key: key-shaped text value is detected even with a neutral field name", () => {
  const [r] = detect([{ id: "e1", role: "textbox", name: "notes", text: "sk-abcdefghijklmnopqrstuvwx" }]);
  assert.equal(r.sensitive, true);
});

test("api key: negative — short benign text is not detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", name: "notes", text: "hi there" }]);
  assert.equal(r.sensitive, false);
});

test("email: type=email is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "email", text: "" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("pii"));
});

test("email: email-shaped text is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "someone@example.com" }]);
  assert.equal(r.sensitive, true);
});

test("email: negative — text without an @ is not detected as email", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "no email here" }]);
  assert.equal(r.sensitive, false);
});

test("phone: type=tel is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "tel", text: "" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("pii"));
});

test("phone: phone-shaped text is detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "+1 (415) 555-0132" }]);
  assert.equal(r.sensitive, true);
});

test("phone: negative — short unrelated number is not detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "42" }]);
  assert.equal(r.sensitive, false);
});

test("credit card: Luhn-valid 16-digit number is detected", () => {
  // 4111 1111 1111 1111 is a well-known Luhn-valid test card number.
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "4111 1111 1111 1111" }]);
  assert.equal(r.sensitive, true);
  assert.ok(r.types.includes("financial"));
});

test("credit card: negative — Luhn-invalid 16-digit number is not detected", () => {
  const [r] = detect([{ id: "e1", role: "textbox", type: "text", text: "1234 5678 9012 3456" }]);
  assert.equal(r.sensitive, false);
});

test("mixed elements: only the sensitive ones are flagged", () => {
  const results = detect([
    { id: "el-1", role: "button", text: "Say hello" },
    { id: "el-2", role: "textbox", type: "password", text: "sup3rSecret1" },
    { id: "el-3", role: "link", text: "Learn more" },
  ]);
  const flagged = results.filter((r) => r.sensitive).map((r) => r.id);
  assert.deepEqual(flagged, ["el-2"]);
});
