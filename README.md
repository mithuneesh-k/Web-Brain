# Ozer

On-device visual perception for privacy-preserving browser agents.
Sensitive content is detected and redacted locally, in the browser,
before anything crosses the network. See [`CONTEXT.md`](./CONTEXT.md)
for the full architecture and [`AGENTS.md`](./AGENTS.md) for the
engineering workflow every agent in this repo follows.

## Current state

Phase 5: reproducible baseline. No privacy detection, redaction, or
real browser automation exists yet — see
[`docs/specs/phase5-reproducible-baseline.md`](docs/specs/phase5-reproducible-baseline.md)
for exactly what this phase does and doesn't include.

## Repository layout

```
extension/   Browser extension (Manifest V3). Phase 5: stub round trip only.
server/      Reasoning service (FastAPI). Phase 5: hardcoded stub logic, no LLM.
companion/   Local execution companion (FastAPI). Phase 5: stub execution,
             no real browser-use integration yet (see ADR 0003).
schemas/     JSON Schema contracts shared between all three components.
docs/        Specs, ADRs, architecture, research — see AGENTS.md.
logs/        Structured prompt/change/report logs — see AGENTS.md.
```

## Running the Phase 5 baseline

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
python -m pytest server/tests/ companion/tests/ schemas/
cd extension && npm test
```

## Loading the extension in Chrome

`chrome://extensions` → Developer mode → Load unpacked → select
`extension/src/`. Firefox parity (via `webextension-polyfill`) is not
yet implemented — see
[`docs/specs/phase5-reproducible-baseline.md`](docs/specs/phase5-reproducible-baseline.md).
