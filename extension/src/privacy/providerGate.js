/**
 * Privacy provider decorator — the text-path enforcement seam.
 *
 * Phase 12D traced where provider-bound text converges. The answer was
 * not the message builders (129 sites) and not the two
 * `*WithCostAllowance` wrappers — the main streaming path bypasses its
 * own wrapper and calls `provider.chatStream` directly. The only seam
 * that cannot be bypassed is **the provider object itself**, which every
 * path must call and which is constructed in one place
 * (`providers/manager.js`).
 *
 * Wrapping there makes the invariant structural rather than remembered:
 *
 *   No provider can receive a message without passing Ozer's policy.
 *
 * A future call site added to `agent.js` is covered automatically,
 * because the gate lives inside the object being called.
 *
 * WHY A PROXY, NOT A WRAPPER CLASS: `agent.js` reads many provider
 * properties — `model`, `supportsTools`, `supportsVision`,
 * `supportsDocuments`, `constructor.name` for logging, and more. An
 * explicit wrapper class must enumerate them, and any omission breaks
 * the agent subtly and late. A Proxy forwards everything except the two
 * gated methods, so nothing can be silently dropped.
 *
 * SCOPE: this is plumbing. It deliberately ships with a placeholder
 * policy. The text-path *policy* — what counts as sensitive in prose,
 * and how user-authored intent differs from ambient page context — is a
 * genuinely hard question and is decided separately, with its own tests.
 * Baking a guess about user intent into the enforcement layer would be
 * the wrong order.
 */

class PrivacyBlockedError extends Error {
  constructor(reasons) {
    // The message must never contain payload content — a thrown error
    // ends up in logs, and a blocked request must not leak there.
    super(`blocked by Ozer privacy policy (${reasons.length} reason(s))`);
    this.name = "PrivacyBlockedError";
    this.reasons = reasons;
  }
}

/**
 * Placeholder policy: allows everything, unchanged.
 *
 * It exists so the plumbing can be proven before the policy is decided.
 * `isPlaceholder` is asserted by tests so this cannot quietly become the
 * shipped default without someone noticing.
 */
const ALLOW_ALL_POLICY = Object.freeze({
  isPlaceholder: true,
  evaluate: () => ({ allowed: true, reasons: [] }),
});

const GATED_FLAG = "__ozerPrivacyGated";

/**
 * Run the policy and normalise its verdict. Any deviation — a throw, a
 * malformed verdict, malformed replacement messages — is a BLOCK.
 * Never returns the original messages as a fallback.
 */
function evaluateOrBlock(policy, messages, context) {
  let verdict;
  try {
    verdict = policy.evaluate(messages, context);
  } catch (err) {
    throw new PrivacyBlockedError([
      `privacy policy threw during evaluation: ${err && err.message}`,
    ]);
  }

  if (!verdict || typeof verdict !== "object" || typeof verdict.allowed !== "boolean") {
    throw new PrivacyBlockedError([
      "privacy policy returned a malformed verdict; refusing to infer intent",
    ]);
  }
  if (verdict.allowed !== true) {
    const reasons = Array.isArray(verdict.reasons) && verdict.reasons.length
      ? verdict.reasons
      : ["privacy policy denied this request"];
    throw new PrivacyBlockedError(reasons);
  }

  // A policy may rewrite messages (e.g. redact). If it does, the
  // rewritten form is the only thing the provider may see.
  if (verdict.messages !== undefined) {
    if (!Array.isArray(verdict.messages)) {
      throw new PrivacyBlockedError([
        "privacy policy allowed the request but returned malformed replacement messages",
      ]);
    }
    return verdict.messages;
  }
  return messages;
}

/**
 * @param {object} provider - anything implementing BaseLLMProvider's chat/chatStream
 * @param {{evaluate: Function}} policy
 * @returns {object} a transparent proxy that gates both entry points
 */
function wrapProviderWithPrivacyGate(provider, policy) {
  if (!provider || typeof provider !== "object") {
    throw new Error("wrapProviderWithPrivacyGate: provider must be an object");
  }
  if (provider[GATED_FLAG]) {
    throw new Error("wrapProviderWithPrivacyGate: provider is already gated; refusing to stack gates");
  }
  if (typeof provider.chat !== "function" && typeof provider.chatStream !== "function") {
    throw new Error("wrapProviderWithPrivacyGate: provider exposes neither chat nor chatStream");
  }
  if (!policy || typeof policy.evaluate !== "function") {
    throw new Error("wrapProviderWithPrivacyGate: a policy with an evaluate() function is required");
  }

  const gatedChat = async function (messages, options) {
    const safe = evaluateOrBlock(policy, messages, { method: "chat" });
    return provider.chat(safe, options);
  };

  const gatedChatStream = async function* (messages, options) {
    // Evaluated BEFORE the inner generator is created, so a blocked
    // request never reaches the provider and never emits partial output.
    const safe = evaluateOrBlock(policy, messages, { method: "chatStream" });
    yield* provider.chatStream(safe, options);
  };

  return new Proxy(provider, {
    get(target, prop, receiver) {
      if (prop === GATED_FLAG) return true;
      if (prop === "chat" && typeof target.chat === "function") return gatedChat;
      if (prop === "chatStream" && typeof target.chatStream === "function") return gatedChatStream;
      // Deliberately NOT bound to `target`. Two reasons, one of them
      // security-relevant:
      //   1. Binding also binds `constructor`, so `constructor.name`
      //      becomes "bound OpenAICompatibleProvider" — silently
      //      corrupting every agent.js log line and trace record that
      //      reads it.
      //   2. Leaving `this` as the proxy means an internal
      //      `this.chat(...)` from within the provider is ALSO gated.
      //      Binding to target would hand such a call the ungated
      //      method, which is precisely the bypass this module exists
      //      to prevent.
      // Caveat: a provider using ECMAScript private fields (`#x`) would
      // break under a Proxy. WebBrain's providers use ordinary
      // properties (`this.config`), so this does not currently apply —
      // but it is the thing to check if a future provider misbehaves.
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
    has(target, prop) {
      return prop === GATED_FLAG ? true : Reflect.has(target, prop);
    },
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { wrapProviderWithPrivacyGate, PrivacyBlockedError, ALLOW_ALL_POLICY };
} else {
  self.wrapProviderWithPrivacyGate = wrapProviderWithPrivacyGate;
  self.PrivacyBlockedError = PrivacyBlockedError;
  self.ALLOW_ALL_POLICY = ALLOW_ALL_POLICY;
}
