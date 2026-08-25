# Engineering Report

## Run
0010-phase7-local-detection

## Objective
Phase 7 (Tier 1 only, per explicit user scoping): build real,
benchmarkable DOM/pattern-based sensitive-data detection, a redactor
producing gate-passing output, and a single enforced egress client
(`OzerPrivacyClient`) closing Phase 6's Threat T9 gap for the real code
path that exists. Tier 2/3 (structural/semantic, visual/ML) explicitly
deferred.

## Starting Commit
`23803d73f81eaf6e9186cc1d7c2d11dec1c33cee` (`main`, matched local and
`origin/main`).

## Changes
See `logs/changes/0010-phase7-local-detection.md` for the full file
list. Summary: a spec, three new modules (`domDetector.js`,
`redactor.js`, `ozerPrivacyClient.js`), `roundtrip.js` refactored to use
the new client, 25 new tests plus a benchmark, and a synthetic labeled
fixture set.

## Verification
- Pre-work: `git status` clean, `git fetch origin` no new commits, local
  HEAD == `origin/main` == `23803d7`, confirmed before starting.
- **TDD, detector**: wrote `domDetector.test.js` (16 tests, one positive
  + one negative per Tier 1 category, plus a mixed case) before
  `domDetector.js` existed. Confirmed RED. Implemented. Re-ran — 2
  failures found:
  1. The Luhn-invalid negative test for credit cards initially failed
     because the phone-shaped pattern was broad enough (7–20 digits) to
     also match a 16-digit non-card number, misclassifying it as a
     phone number. Fixed by bounding phone detection to 7–15 digits
     (ITU E.164's real maximum), re-verified all 16 tests pass.
  2. The benchmark (see below) then caught a second bug the unit tests
     hadn't: a `name="api_token"` field wasn't matched by the original
     `API_KEY_FIELD_RE` (`/api.?key|access.?token|secret.?key/i` — no
     `api.?token` alternative). Fixed by adding it, re-verified.
  Both fixes are the kind of real bug TDD is supposed to surface —
  documented here rather than silently corrected without mention.
- **TDD, redactor**: wrote `redactor.test.js` (5 tests) before
  `redactor.js` existed, including a test that runs the *actual*
  `assertSafeForEgress()` gate against the redactor's output — not a
  shape assertion, a real integration check between the two Phase 6/7
  modules. Confirmed RED, implemented, confirmed GREEN.
- **TDD, OzerPrivacyClient**: wrote `ozerPrivacyClient.test.js` (3
  tests) before the client existed: (1) full pipeline with a sensitive
  element, proving detection→redaction→gate all run and the result is
  masked before ever reaching the mocked `fetch`; (2) a gate-blocking
  case proving zero network calls happen when blocked; (3) a **source-
  scan test** that reads `roundtrip.js`'s actual file content and fails
  if it contains a direct `fetch()` call against the server URL — this
  is the concrete regression test for Threat T9's gap on this code
  path. Confirmed RED (client didn't exist), implemented, confirmed
  GREEN — then refactored `roundtrip.js` itself to use the client, and
  the source-scan test passed against the real refactored file, not
  just a synthetic string.
- **Benchmark**: built `extension/test/fixtures/detection-benchmark.json`
  (17 cases: 10 positive spanning all 6 Tier 1 categories, 7 negative
  including a deliberately Luhn-invalid 16-digit adversarial case) and
  `benchmark.test.js`, which computes true/false positive/negative
  counts and asserts recall/precision — both 100% on this fixture set
  after the two bug fixes above. Documented in the spec that 100% on a
  deterministic, exact-match rule set over a hand-labeled fixture set is
  expected by construction, not a claim about real-world data recall.
- **Full regression**: `python -m pytest server/tests/ companion/tests/
  schemas/` → 21 passed (unchanged from Phase 6). `node --test` across
  all extension test files → 41 passed (egressGate 10 + logSanitizer 3
  + ozerPrivacyClient 3 + domDetector 16 + benchmark 1 + redactor 5 +
  roundtrip 3). **62 total across both languages, zero failures, zero
  external model dependency in any test.**
- **Real, live, unmocked end-to-end re-verification**: started `server/`
  and `companion/` as real processes again, ran the actual (refactored)
  `roundtrip.js` against them with real `fetch` — captured genuine
  output showing the full pipeline (fixed stub elements → detection →
  redaction → gate → `OzerPrivacyClient` → real HTTP → server stub
  reasoning → companion stub execution) still works end-to-end after
  the refactor.
- **Fixture review before staging**: confirmed every "sensitive-shaped"
  string in the new test/fixture files is either a well-known public
  test value (Luhn-valid card numbers `4111111111111111` and
  `5500000000000004`, the standard payment-industry test numbers) or an
  obviously fake placeholder (`fakePassw0rd!`, `sk-fakeFAKEfakeFAKE...`)
  — no real credential shape was used anywhere.
- **Graphify**: not run, consistent with the Phase 6 decision — the
  fixture file adds more fake-shaped secret strings to the set
  `.graphifyignore` doesn't yet exclude by filename pattern.

## Tests
62 total (41 JS via `node --test`, 21 Python via `pytest`), all passing.
25 of the JS tests are new this phase. Zero external model dependency.

## Metrics
Detection benchmark: TP=10, FP=0, FN=0, TN=7, recall=1.0, precision=1.0
on the 17-case synthetic fixture set (logged by the benchmark test
itself at run time). Wall-clock performance not measured (deferred to
Phase 10, per the Phase 5/6/7 specs' consistent scoping) — architecturally
notable that Tier 1 detection is pure synchronous regex/attribute
checks with no model load or inference step, by construction.

## Evidence
See "Verification" above for exact commands, results, and the two bugs
found and fixed. Full detail in `docs/specs/phase7-local-detection.md`.

## Failures
Two real implementation bugs, both caught by tests before being
considered fixed (see "Verification," detector RED/GREEN cycle) — not
defects that shipped, but worth recording as genuine TDD value, not
hidden as if the implementation were correct on the first attempt.

## Remaining Work
1. Tier 2 (structural/semantic signals: autocomplete attributes beyond
   OTP, ARIA labels generally, form context, hidden-field policy) and
   Tier 3 (visual/vision-model detection) — explicitly deferred, per
   the user's own ordering.
2. `OzerPrivacyClient` enforcement is scoped to the one existing code
   path (`roundtrip.js`); a repo-wide guarantee (e.g. a lint rule
   banning direct `fetch()` calls outside the client module) is a
   reasonable future addition, not built here.
3. Graphify policy for synthetic-secret-bearing test fixtures — still
   open, still deferred deliberately.
4. Per user's own recommendation: next is either continuing Phase 7 with
   Tier 2, or moving toward Phase 8 — awaiting direction rather than
   assuming.

## Final Status
VERIFIED. Tier 1 detection, redaction, and the enforced single egress
client are all real, tested, and wired into the actual live code path —
re-proven by a genuine live end-to-end HTTP round trip, not just unit
tests in isolation. The benchmark gives Ozer its first measurable
recall/precision number, directly traceable to SIH judging metric 2, on
a deterministic, no-model detector — exactly the "cheap, high
confidence, measurable" foundation the user asked Phase 7 to establish
before any visual/ML work begins. Two real bugs were found and fixed
during this phase's own TDD cycle, which is recorded as evidence the
process is working, not omitted.
