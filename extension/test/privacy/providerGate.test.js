const test = require("node:test");
const assert = require("node:assert/strict");
const {
  wrapProviderWithPrivacyGate,
  PrivacyBlockedError,
  ALLOW_ALL_POLICY,
} = require("../../src/privacy/providerGate.js");

/** Stand-in for a WebBrain provider: the two-method BaseLLMProvider interface. */
class FakeProvider {
  constructor() {
    this.model = "fake-model-1";
    this.supportsTools = true;
    this.supportsVision = false;
    this.chatCalls = [];
    this.streamCalls = [];
  }
  get name() { return "fake"; }
  async chat(messages, options) {
    this.chatCalls.push({ messages, options });
    return { content: "ok", toolCalls: null, usage: null };
  }
  async *chatStream(messages, options) {
    this.streamCalls.push({ messages, options });
    yield { type: "text", content: "he" };
    yield { type: "text", content: "llo" };
    yield { type: "done" };
  }
}

const MSGS = [{ role: "user", content: "hello" }];

function blockingPolicy(reason = "policy says no") {
  return { evaluate: () => ({ allowed: false, reasons: [reason] }) };
}

async function drain(iter) {
  const out = [];
  for await (const chunk of iter) out.push(chunk);
  return out;
}

// --- 1 & 2: neither entry point can bypass the gate ---

test("1. chat() reaches the inner provider only when policy allows", async () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, ALLOW_ALL_POLICY);
  await gated.chat(MSGS, { temperature: 0 });
  assert.equal(inner.chatCalls.length, 1);
});

test("1. chat() BLOCKED — the inner provider is never called", async () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, blockingPolicy());
  await assert.rejects(() => gated.chat(MSGS, {}), PrivacyBlockedError);
  assert.equal(inner.chatCalls.length, 0, "the raw provider saw blocked messages");
});

test("2. chatStream() reaches the inner provider only when policy allows", async () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, ALLOW_ALL_POLICY);
  const chunks = await drain(gated.chatStream(MSGS, {}));
  assert.equal(inner.streamCalls.length, 1);
  assert.equal(chunks.length, 3);
});

test("2. chatStream() BLOCKED — the inner provider is never called and nothing is yielded", async () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, blockingPolicy());
  const yielded = [];
  await assert.rejects(async () => {
    for await (const c of gated.chatStream(MSGS, {})) yielded.push(c);
  }, PrivacyBlockedError);
  assert.equal(inner.streamCalls.length, 0, "the raw provider saw blocked messages");
  assert.deepEqual(yielded, [], "a blocked stream must not emit partial content");
});

// --- 3: transparency, so every provider type can be wrapped safely ---

test("3. the wrapper is transparent — properties and identity pass through", () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, ALLOW_ALL_POLICY);
  assert.equal(gated.model, "fake-model-1");
  assert.equal(gated.supportsTools, true);
  assert.equal(gated.supportsVision, false);
  assert.equal(gated.name, "fake");
  // agent.js logs provider.constructor.name — it must not become "Object".
  assert.equal(gated.constructor.name, "FakeProvider");
});

test("3. property writes reach the inner provider", () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, ALLOW_ALL_POLICY);
  gated.supportsVision = true;
  assert.equal(inner.supportsVision, true);
});

test("3. wrapping is idempotent-safe: a wrapped provider reports as gated", () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, ALLOW_ALL_POLICY);
  assert.equal(gated.__ozerPrivacyGated, true);
  assert.equal(inner.__ozerPrivacyGated, undefined);
});

test("3. double-wrapping is refused rather than silently stacking gates", () => {
  const gated = wrapProviderWithPrivacyGate(new FakeProvider(), ALLOW_ALL_POLICY);
  assert.throws(() => wrapProviderWithPrivacyGate(gated, ALLOW_ALL_POLICY), /already gated/i);
});

// --- 4 & 5: fail-closed ---

test("5. FAIL-CLOSED: a policy that THROWS blocks, and the inner provider is never called", async () => {
  const inner = new FakeProvider();
  const exploding = { evaluate: () => { throw new Error("policy exploded"); } };
  const gated = wrapProviderWithPrivacyGate(inner, exploding);
  await assert.rejects(() => gated.chat(MSGS, {}), PrivacyBlockedError);
  assert.equal(inner.chatCalls.length, 0);
});

test("5. FAIL-CLOSED: a policy returning a malformed verdict blocks", async () => {
  const inner = new FakeProvider();
  for (const verdict of [null, undefined, {}, { allowed: "yes" }, 42]) {
    const gated = wrapProviderWithPrivacyGate(inner, { evaluate: () => verdict });
    await assert.rejects(() => gated.chat(MSGS, {}), PrivacyBlockedError);
  }
  assert.equal(inner.chatCalls.length, 0);
});

test("5. FAIL-CLOSED: a missing policy is refused at wrap time, not at call time", () => {
  assert.throws(() => wrapProviderWithPrivacyGate(new FakeProvider(), null), /policy/i);
  assert.throws(() => wrapProviderWithPrivacyGate(new FakeProvider(), {}), /policy/i);
});

test("5. FAIL-CLOSED: wrapping a non-provider is refused", () => {
  assert.throws(() => wrapProviderWithPrivacyGate(null, ALLOW_ALL_POLICY), /provider/i);
  assert.throws(() => wrapProviderWithPrivacyGate({}, ALLOW_ALL_POLICY), /chat/i);
});

// --- 6: streaming and non-streaming behave identically w.r.t. policy ---

test("6. both entry points enforce the SAME policy verdict", async () => {
  const seen = [];
  const recording = {
    evaluate: (messages, ctx) => { seen.push(ctx.method); return { allowed: true, reasons: [] }; },
  };
  const gated = wrapProviderWithPrivacyGate(new FakeProvider(), recording);
  await gated.chat(MSGS, {});
  await drain(gated.chatStream(MSGS, {}));
  assert.deepEqual(seen, ["chat", "chatStream"]);
});

test("6. policy is evaluated BEFORE any provider work, on both paths", async () => {
  const order = [];
  const inner = new FakeProvider();
  const orig = inner.chat.bind(inner);
  inner.chat = async (...a) => { order.push("provider"); return orig(...a); };
  const policy = { evaluate: () => { order.push("policy"); return { allowed: true, reasons: [] }; } };
  await wrapProviderWithPrivacyGate(inner, policy).chat(MSGS, {});
  assert.deepEqual(order, ["policy", "provider"]);
});

test("6. an allowed stream forwards every chunk unchanged and in order", async () => {
  const gated = wrapProviderWithPrivacyGate(new FakeProvider(), ALLOW_ALL_POLICY);
  const chunks = await drain(gated.chatStream(MSGS, {}));
  assert.deepEqual(chunks, [
    { type: "text", content: "he" },
    { type: "text", content: "llo" },
    { type: "done" },
  ]);
});

// --- policy may rewrite; the inner provider must receive the rewritten form ---

test("a policy may return replacement messages, and the provider sees ONLY those", async () => {
  const inner = new FakeProvider();
  const redacting = {
    evaluate: () => ({
      allowed: true,
      reasons: [],
      messages: [{ role: "user", content: "[REDACTED]" }],
    }),
  };
  const gated = wrapProviderWithPrivacyGate(inner, redacting);
  await gated.chat([{ role: "user", content: "my password is hunter2" }], {});
  assert.deepEqual(inner.chatCalls[0].messages, [{ role: "user", content: "[REDACTED]" }]);
  assert.ok(!JSON.stringify(inner.chatCalls[0].messages).includes("hunter2"));
});

test("FAIL-CLOSED: a policy that allows but returns malformed replacement messages blocks", async () => {
  const inner = new FakeProvider();
  const gated = wrapProviderWithPrivacyGate(inner, {
    evaluate: () => ({ allowed: true, reasons: [], messages: "not an array" }),
  });
  await assert.rejects(() => gated.chat(MSGS, {}), PrivacyBlockedError);
  assert.equal(inner.chatCalls.length, 0);
});

// --- the block error must not become the leak ---

test("a PrivacyBlockedError carries reasons but never the message content", async () => {
  const gated = wrapProviderWithPrivacyGate(new FakeProvider(), blockingPolicy("contains a credential"));
  try {
    await gated.chat([{ role: "user", content: "hunter2Password!" }], {});
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof PrivacyBlockedError);
    assert.ok(Array.isArray(err.reasons) && err.reasons.length > 0);
    assert.ok(!err.message.includes("hunter2Password!"));
    assert.ok(!JSON.stringify(err.reasons).includes("hunter2Password!"));
  }
});

test("ALLOW_ALL_POLICY is explicitly named as a placeholder, not a real policy", () => {
  assert.equal(ALLOW_ALL_POLICY.isPlaceholder, true);
});
