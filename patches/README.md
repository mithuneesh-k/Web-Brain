# WebBrain patch series

Ozer modifies WebBrain through a **small, reviewable patch series**, not
a fork.

Pinned target: **WebBrain v32.2.3**, commit
`52fb7914611717f2e9774dc137036a074b293b1d` (MIT) — see
[`docs/adr/0006-pin-webbrain-v32-2-3.md`](../docs/adr/0006-pin-webbrain-v32-2-3.md).

## Why a patch series rather than a fork

- **Auditable.** Every Ozer modification to upstream is one reviewable
  diff. A reader can see the entire delta in seconds.
- **Small.** A fork of a fast-moving 1.2 GB project is permanent merge
  burden. The patches are ~60 lines.
- **Licence-clean.** Nothing is vendored, so MIT attribution stays
  simple and the derived-work surface stays minimal.
- **Honest about the boundary.** ADR 0005's split — *WebBrain
  transforms, Ozer verifies* — is visible in the fact that the patches
  do not touch WebBrain's redaction engine at all.

## The patches

### `0001-default-on-screenshot-redaction.patch`

Flips `this.screenshotRedaction` from `false` to `true` in both the
Chrome and Firefox agents, and corrects the now-wrong "OFF by default"
comments in both `background.js` files.

**Why.** Phase 11A found that WebBrain's screenshot redaction — which is
genuinely good, fail-closed, with a TOCTOU guard — is **off by default**.
On a stock install, raw screenshots including visible passwords, tokens,
OTPs and faces reach the configured provider. The machinery existed; it
just wasn't on.

The principle, from ADR 0005: *privacy is not a feature the user must
remember to enable; it is the default policy governing what page-derived
data may leave the device.*

**An explicit user choice still wins.** `background.js` only overrides
the default when a stored value exists, so someone who deliberately
turned redaction off keeps it off.

**Known behavioural consequence, stated up front:** with redaction on,
the `/screenshot` path will now *refuse* to capture on pages the
collector cannot inspect, rather than silently sending an unredacted
image. That is the correct trade — but it is a visible UX change, not a
free win, and users will encounter it.

### `0002-gate-provider-construction.patch`

Wraps every provider constructed by `ProviderManager._createProvider()`
in Ozer's privacy gate, in both browsers.

**Why here.** Phase 12D traced the provider-bound text path and found
129 message-construction sites, 3 dispatch sites, and — decisively —
that the **main streaming path bypasses its own
`_chatStreamWithCostAllowance` wrapper**, calling `provider.chatStream`
directly. The provider object is the only seam every path must cross,
and this factory is where all eight types are built. Wrapping here makes
the invariant structural: *no provider can receive a message without
passing Ozer's policy.*

**Why after the switch, not per `case`.** A ninth provider type added
upstream is then gated automatically. Eight per-case wraps would leave
the ninth silently ungated — enforced by test.

**No try/catch.** If gating cannot be applied, construction throws. A
`catch → return raw provider` fallback would recreate threat T17 at the
provider layer. Also enforced by test.

**This patch contains no policy.** It imports `ozerTextPolicy()`, which
currently returns a placeholder that allows everything. Text policy —
detection, provenance, and intent — is decided separately.

## Installing Ozer's modules (required by 0002)

Patch 0002 imports from `../ozer/`, so Ozer's privacy modules must be
copied into each extension tree before the patched build will load:

```bash
# from the WebBrain checkout, with OZER=/path/to/Ozer
for B in chrome firefox; do
  mkdir -p "src/$B/src/ozer"
  cp "$OZER"/extension/src/privacy/providerGate.js  "src/$B/src/ozer/"
  cp "$OZER"/extension/src/privacy/textPolicy.js    "src/$B/src/ozer/"
done
```

Ozer's modules are dual-environment (CommonJS for `node --test`, plain
globals otherwise); the ESM `import` in the patch expects the extension
build to treat them as modules. **Not yet validated in a real extension
load** — see the limitation note below.

## Verifying

Offline, on every commit (structural guard — scope, size, attribution,
and that no patch touches the redaction engine):

```bash
cd extension && npm test        # extension/test/patches/patchIntegrity.test.js
```

Against real upstream (network; fetches only the four touched files):

```bash
python patches/verify-against-upstream.py
```

## Applying to a checkout

```bash
git clone https://github.com/webbrain-one/webbrain.git
cd webbrain && git checkout 52fb7914611717f2e9774dc137036a074b293b1d
git apply /path/to/Ozer/patches/*.patch
```

## Rules for adding a patch

1. Keep it minimal and single-purpose.
2. Mark every added line's block with `OZER PATCH NNNN` so upstream code
   stays distinguishable — enforced by test.
3. **Never modify WebBrain's redaction engine**
   (`agent/screenshot-redaction.js`, `content/redaction-regions.js`).
   Ozer verifies; it does not fork the transform. Changing that needs an
   ADR — enforced by test.
4. Re-run both verifications above.
