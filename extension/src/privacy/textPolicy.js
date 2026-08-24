/**
 * Text-path privacy policy — DELIBERATELY NOT IMPLEMENTED YET.
 *
 * `providerGate.js` proves the enforcement mechanism. This module is
 * where the *policy* will live, and it currently returns a placeholder
 * that allows everything unchanged.
 *
 * That separation is intentional, not unfinished work. Deciding what
 * counts as sensitive in free-form text is a genuinely harder problem
 * than the image path faced, and guessing at it inside the enforcement
 * layer would be the wrong order. Three concepts must stay distinct:
 *
 *   1. DETECTION — what sensitive information is present. Ozer's Tier 1
 *      and Tier 2 detectors answer this for DOM *fields*. They were
 *      built for attributes and short values, and it is unproven that
 *      they behave sensibly on prose.
 *
 *   2. PROVENANCE AND INTENT — where did this text come from, and did
 *      the user intend the model to have it?
 *
 *        page / DOM / AX tree / tool output
 *            -> ambient untrusted context -> sanitise by policy
 *
 *        user-authored instruction
 *            -> intentional context -> preserve unless restricted
 *
 *      A user who types "tell me my bank balance" may want the model to
 *      use exactly the value a DOM policy would strip. Applying the
 *      field policy to prose would turn Ozer from a privacy system into
 *      something that randomly breaks tasks. Provenance is the
 *      distinction that makes this tractable — and WebBrain does not
 *      currently carry provenance on message content, so acquiring it
 *      is itself a piece of work.
 *
 *   3. ENFORCEMENT — providerGate.js. Already built and tested.
 *
 * An asymmetry worth recording: on the image path Ozer *verifies* a
 * transform WebBrain already performs. On the text path there is no
 * upstream transformer, so Ozer may have to both sanitise and verify.
 * That is a real difference in role, and it should be decided
 * explicitly rather than inherited by analogy.
 */

const { ALLOW_ALL_POLICY } = require("./providerGate.js");

/**
 * The policy handed to the provider gate.
 *
 * Currently the placeholder. It is returned through a function (rather
 * than exported as a constant) so that swapping in a real policy is a
 * one-line change here and requires no patch to WebBrain.
 *
 * @returns {{evaluate: Function, isPlaceholder?: boolean}}
 */
function ozerTextPolicy() {
  return ALLOW_ALL_POLICY;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ozerTextPolicy };
} else {
  self.ozerTextPolicy = ozerTextPolicy;
}
