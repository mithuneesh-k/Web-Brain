# Ozer

On-device visual perception for privacy-preserving browser agents.
Sensitive content is detected and redacted locally, in the browser,
before anything crosses the network. See [`CONTEXT.md`](./CONTEXT.md)
for the full architecture and [`AGENTS.md`](./AGENTS.md) for the
engineering workflow every agent in this repo follows.

## Current state

**Privacy pipeline status:** Tier 1 and Tier 2 sensitive regions are now
mapped from real browser geometry to screenshot coordinates and redacted
locally. Tested with real browser-rendered geometry, including
fractional DPR. Full extension integration, real screenshot capture, and
Tier 3 face detection are still in progress.

The precise scope of what is and isn't verified — including phrasing
that would be false if written today — is in
[`CONTEXT.md`](./CONTEXT.md) under *Current Privacy Verification
Status*. Read that before quoting any number from this project.

Architecture direction: WebBrain (pinned at v32.2.3) is the browser-agent
foundation; Ozer is the local privacy layer that constrains what that
agent may reveal. See
[`docs/adr/0006-pin-webbrain-v32-2-3.md`](docs/adr/0006-pin-webbrain-v32-2-3.md).

## Repository layout

```
extension/   Ozer's privacy layer. src/detection (Tier 1 pattern + Tier 2
             semantic + DOM->pixel geometry + region producer),
             src/redaction (text masking + visual pixel redaction),
             src/privacy (egress gate, log sanitiser, single approved
             transport client). Not yet loaded as a real extension.
server/      Reasoning service (FastAPI). Stub logic, no LLM yet.
companion/   Local execution companion (FastAPI). Stub execution; the
             adapter boundary that a real agent would sit behind.
schemas/     JSON Schema contracts shared between all three components.
docs/        Specs, ADRs, architecture, research — see AGENTS.md.
logs/        Structured prompt/change/report logs — see AGENTS.md.
```

## Running the local baseline

Requires Python `>=3.11,<4.0` and Node `>=20`.

```bash
pip install -r server/requirements.txt
pip install -r companion/requirements.txt

# terminal 1
python -m uvicorn server.app:app --host 127.0.0.1 --port 8001

# terminal 2
python -m uvicorn companion.app:app --host 127.0.0.1 --port 8002

# terminal 3 — drive the real round trip (extension logic, real HTTP)
node -e "require('./extension/src/roundtrip.js').runRoundTrip({fetch, serverUrl:'http://127.0.0.1:8001', companionUrl:'http://127.0.0.1:8002'}).then(r=>console.log(JSON.stringify(r,null,2)))"
```

## Tests

```bash
python -m pytest server/tests/ companion/tests/ schemas/   # 21 tests
cd extension && npm test                                    # 120 tests
```

The end-to-end privacy check is
`extension/test/integration/realPagePipeline.test.js`: real
browser-captured geometry -> detection -> pixel boxes -> redaction,
asserting sensitive pixels are destroyed and the rest survive.

Visual proof of the redactor (writes before/after PNGs, no deps):

```bash
node extension/demo/render-redaction-demo.js
```

## Loading the extension in Chrome

`chrome://extensions` → Developer mode → Load unpacked → select
`extension/src/`. Firefox parity (via `webextension-polyfill`) is not
yet implemented — see
[`docs/specs/phase5-reproducible-baseline.md`](docs/specs/phase5-reproducible-baseline.md).
