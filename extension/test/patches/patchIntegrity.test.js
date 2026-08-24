/**
 * Structural guard on the WebBrain patch series.
 *
 * Ozer modifies WebBrain through a small, reviewable patch series rather
 * than a fork. That only stays trustworthy if the patches stay small and
 * touch only what they claim to. These tests are the guard: they run
 * offline and fail if a patch grows beyond its stated scope.
 *
 * They deliberately do NOT verify that a patch applies to upstream —
 * that needs the pinned checkout and is done by
 * `patches/verify-against-upstream.py`. This is the cheap check that
 * runs on every commit.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const PATCH_DIR = path.join(__dirname, "../../../patches");

function readPatch(name) {
  return fs.readFileSync(path.join(PATCH_DIR, name), "utf8");
}

function touchedFiles(patch) {
  return patch
    .split("\n")
    .filter((l) => l.startsWith("+++ b/"))
    .map((l) => l.slice("+++ b/".length).trim());
}

function addedLines(patch) {
  return patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
}

function removedLines(patch) {
  return patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
}

test("the patch series contains only the patches we know about", () => {
  const found = fs.readdirSync(PATCH_DIR).filter((f) => f.endsWith(".patch")).sort();
  assert.deepEqual(found, ["0001-default-on-screenshot-redaction.patch"]);
});

test("0001 touches exactly the four files it claims, in both browsers", () => {
  const files = touchedFiles(readPatch("0001-default-on-screenshot-redaction.patch")).sort();
  assert.deepEqual(files, [
    "src/chrome/src/agent/agent.js",
    "src/chrome/src/background.js",
    "src/firefox/src/agent/agent.js",
    "src/firefox/src/background.js",
  ]);
});

test("0001 changes the redaction default from false to true — and nothing else functional", () => {
  const patch = readPatch("0001-default-on-screenshot-redaction.patch");
  const removedCode = removedLines(patch)
    .map((l) => l.slice(1).trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
  const addedCode = addedLines(patch)
    .map((l) => l.slice(1).trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));

  // The ONLY non-comment lines touched must be the two defaults.
  assert.deepEqual(removedCode, [
    "this.screenshotRedaction = false;",
    "this.screenshotRedaction = false;",
  ]);
  assert.deepEqual(addedCode, [
    "this.screenshotRedaction = true;",
    "this.screenshotRedaction = true;",
  ]);
});

test("0001 stays small — a patch series that grows silently is a fork in disguise", () => {
  const patch = readPatch("0001-default-on-screenshot-redaction.patch");
  assert.ok(patch.split("\n").length < 120, "patch 0001 has grown unexpectedly large");
  assert.equal(addedLines(patch).filter((l) => l.slice(1).trim() === "this.screenshotRedaction = true;").length, 2);
});

test("every patch is attributable — each carries an OZER PATCH marker", () => {
  for (const f of fs.readdirSync(PATCH_DIR).filter((x) => x.endsWith(".patch"))) {
    const patch = readPatch(f);
    const id = f.slice(0, 4);
    assert.ok(
      addedLines(patch).some((l) => l.includes(`OZER PATCH ${id}`)),
      `${f} must mark its own additions with "OZER PATCH ${id}" so upstream code is distinguishable`
    );
  }
});

test("no patch touches WebBrain's redaction engine — Ozer verifies, it does not fork the transform", () => {
  // Architectural invariant from ADR 0005 / Phase 11B: WebBrain
  // transforms, Ozer verifies. If a patch ever edits the redaction
  // internals, that decision deserves its own ADR, not a silent diff.
  const forbidden = [
    "src/chrome/src/agent/screenshot-redaction.js",
    "src/firefox/src/agent/screenshot-redaction.js",
    "src/chrome/src/content/redaction-regions.js",
    "src/firefox/src/content/redaction-regions.js",
  ];
  for (const f of fs.readdirSync(PATCH_DIR).filter((x) => x.endsWith(".patch"))) {
    const files = touchedFiles(readPatch(f));
    for (const forbiddenPath of forbidden) {
      assert.ok(
        !files.includes(forbiddenPath),
        `${f} modifies ${forbiddenPath}; forking the redaction engine needs an ADR`
      );
    }
  }
});
