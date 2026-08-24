/**
 * Manager-level gating (patch 0002 semantics).
 *
 * Patch 0002 wraps AFTER the provider switch returns, at the single
 * point every provider passes through. This test models that structure
 * and asserts the properties that make it worth doing — above all, that
 * a provider type added LATER is gated without anyone remembering to
 * wrap it.
 *
 * It exercises Ozer's real gate against a stand-in factory rather than
 * WebBrain's 2125-line manager, because the property being tested is
 * structural: wrap once, after construction, with no try/catch fallback.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { wrapProviderWithPrivacyGate, PrivacyBlockedError } = require("../../src/privacy/providerGate.js");
const { ozerTextPolicy } = require("../../src/privacy/textPolicy.js");

/** The eight provider types WebBrain v32.2.3 constructs. */
const PROVIDER_TYPES = [
  "llamacpp", "webgpu", "openai", "azure_openai",
  "aws_bedrock", "anthropic", "anthropic_oauth", "vertex_anthropic",
];

function makeProviderClass(typeName) {
  return {
    [typeName]: class {
      constructor(config) { this.config = config; this.model = `${typeName}-model`; this.calls = 0; }
      async chat(messages) { this.calls++; return { content: "ok" }; }
      async *chatStream() { this.calls++; yield { type: "done" }; }
    },
  }[typeName];
}

const CLASSES = Object.fromEntries(PROVIDER_TYPES.map((t) => [t, makeProviderClass(t)]));

/** Mirrors the patched `_createProvider` / `_createRawProvider` split. */
class FakeManager {
  constructor(policy = ozerTextPolicy()) { this.policy = policy; this.providers = new Map(); }

  _createRawProvider(config) {
    const Klass = CLASSES[config.type];
    if (!Klass) throw new Error(`Unknown provider type: ${config.type}`);
    return new Klass(config);
  }

  // The patch's shape: wrap after the switch, no try/catch fallback.
  _createProvider(id, config) {
    const raw = this._createRawProvider(config);
    if (!raw || typeof raw !== "object") {
      throw new Error(`Ozer: provider construction returned no object for type: ${config.type}`);
    }
    return wrapProviderWithPrivacyGate(raw, this.policy);
  }

  register(id, config) {
    this.providers.set(id, this._createProvider(id, config));
    return this.providers.get(id);
  }
}

const DENY = { evaluate: () => ({ allowed: false, reasons: ["denied for test"] }) };

// --- criteria 1 & 2 ---

test("1&2. all eight provider types come out of the factory GATED", () => {
  const mgr = new FakeManager();
  for (const type of PROVIDER_TYPES) {
    const p = mgr._createProvider(type, { type });
    assert.equal(p.__ozerPrivacyGated, true, `${type} was not gated`);
  }
});

test("2. what the manager STORES is the gated proxy, not the raw provider", () => {
  const mgr = new FakeManager();
  for (const type of PROVIDER_TYPES) mgr.register(type, { type });
  for (const [id, stored] of mgr.providers) {
    assert.equal(stored.__ozerPrivacyGated, true, `${id} stored ungated`);
  }
});

// --- criteria 3 & 4 ---

test("3&4. chat() and chatStream() both pass through the gate for every type", async () => {
  const mgr = new FakeManager(DENY);
  for (const type of PROVIDER_TYPES) {
    const p = mgr._createProvider(type, { type });
    await assert.rejects(() => p.chat([{ role: "user", content: "x" }], {}), PrivacyBlockedError,
      `${type}: chat() bypassed the gate`);
    await assert.rejects(async () => {
      for await (const _ of p.chatStream([{ role: "user", content: "x" }], {})) { /* drain */ }
    }, PrivacyBlockedError, `${type}: chatStream() bypassed the gate`);
  }
});

// --- criteria 5 & 6 ---

test("5. provider properties still behave identically through the gate", () => {
  const mgr = new FakeManager();
  const p = mgr._createProvider("openai", { type: "openai", baseUrl: "http://x" });
  assert.equal(p.model, "openai-model");
  assert.equal(p.config.baseUrl, "http://x");
});

test("6. constructor.name is unchanged — agent.js logs and traces depend on it", () => {
  const mgr = new FakeManager();
  for (const type of PROVIDER_TYPES) {
    const p = mgr._createProvider(type, { type });
    assert.equal(p.constructor.name, type, `${type}: constructor.name was corrupted`);
  }
});

// --- criterion 7: the reason for wrapping after the switch ---

test("7. a NINTH provider type added later is gated with no extra wiring", () => {
  // Simulates a future upstream `case 'brand_new':` in the switch.
  CLASSES.brand_new = makeProviderClass("brand_new");
  try {
    const p = new FakeManager()._createProvider("brand_new", { type: "brand_new" });
    assert.equal(p.__ozerPrivacyGated, true,
      "a provider added to the switch was NOT gated — wrapping is in the wrong place");
  } finally {
    delete CLASSES.brand_new;
  }
});

// --- criterion 8: fail-closed integration ---

test("8. FAIL-CLOSED: if gating cannot be applied, construction THROWS", () => {
  const mgr = new FakeManager(null); // an invalid policy
  assert.throws(() => mgr._createProvider("openai", { type: "openai" }), /policy/i);
});

test("8. FAIL-CLOSED: a factory returning a non-object throws rather than yielding it raw", () => {
  const mgr = new FakeManager();
  mgr._createRawProvider = () => undefined;
  assert.throws(() => mgr._createProvider("openai", { type: "openai" }), /returned no object/i);
});

test("8. there is NO catch-and-return-raw path — a failed wrap never yields an ungated provider", () => {
  const mgr = new FakeManager();
  mgr.policy = { /* no evaluate */ };
  let escaped = null;
  try {
    escaped = mgr._createProvider("openai", { type: "openai" });
  } catch {
    /* expected */
  }
  assert.equal(escaped, null, "an ungated provider escaped the factory — this is threat T17 at the provider layer");
});

test("unknown provider types still throw, as upstream already did", () => {
  assert.throws(() => new FakeManager()._createProvider("nope", { type: "nope" }), /Unknown provider type/);
});
