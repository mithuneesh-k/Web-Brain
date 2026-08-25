const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SRC_ROOT = path.join(__dirname, "../../src");
const APPROVED_TRANSPORT_FILE = path.join(SRC_ROOT, "privacy", "ozerPrivacyClient.js").replace(/\\/g, "/");

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listJsFiles(full));
    } else if (entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Strips // line comments, /* block comments *\/, and string/template
 * literal contents so a fetch(...) mention in a docstring or a string
 * doesn't produce a false positive. Not a full JS parser — sufficient
 * for this repo's code style (no unusual regex-with-slashes edge cases
 * near "fetch").
 */
function stripCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

test("no file under extension/src/ calls fetch(...) directly except the approved transport module", () => {
  const files = listJsFiles(SRC_ROOT);
  const violations = [];

  for (const file of files) {
    const normalized = file.replace(/\\/g, "/");
    if (normalized === APPROVED_TRANSPORT_FILE) continue;

    const source = fs.readFileSync(file, "utf8");
    const codeOnly = stripCommentsAndStrings(source);
    if (/\bfetch\s*\(/.test(codeOnly)) {
      violations.push(normalized);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `direct fetch() calls found outside the approved transport module (extension/src/privacy/ozerPrivacyClient.js): ${JSON.stringify(violations)}`
  );
});

test("sanity check: the scanner actually detects a direct fetch() call when one is present", () => {
  // Proves this test isn't vacuously passing (e.g. due to a path bug) —
  // a deliberately-constructed violating snippet must be caught.
  const violatingSource = 'async function bad() {\n  return fetch("http://example.com");\n}\n';
  const codeOnly = stripCommentsAndStrings(violatingSource);
  assert.ok(/\bfetch\s*\(/.test(codeOnly), "scanner failed to detect an obvious direct fetch() call");
});

test("sanity check: the scanner ignores fetch( mentioned only in a comment or string", () => {
  const benignSource = '// call fetch(...) somewhere else\nconst note = "please call fetch(url)";\n';
  const codeOnly = stripCommentsAndStrings(benignSource);
  assert.ok(!/\bfetch\s*\(/.test(codeOnly), "scanner false-positived on a comment/string mention of fetch(");
});
