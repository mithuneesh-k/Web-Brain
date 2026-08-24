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
