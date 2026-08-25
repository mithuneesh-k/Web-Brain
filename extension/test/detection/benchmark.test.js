const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { detectSensitiveElements } = require("../../src/detection/domDetector.js");

const fixturePath = path.join(__dirname, "../fixtures/detection-benchmark.json");
const { cases } = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function runBenchmark() {
  const elements = cases.map((c) => c.element);
  const results = detectSensitiveElements(elements);
  const byId = new Map(results.map((r) => [r.id, r]));

  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let trueNegative = 0;
  const misclassified = [];

  for (const c of cases) {
    const got = byId.get(c.id);
    const expected = c.expected_sensitive;
    const actual = got.sensitive;

    if (expected && actual) truePositive += 1;
    else if (!expected && !actual) trueNegative += 1;
    else if (!expected && actual) {
      falsePositive += 1;
      misclassified.push({ id: c.id, expected, actual, types: got.types });
    } else if (expected && !actual) {
      falseNegative += 1;
      misclassified.push({ id: c.id, expected, actual, types: got.types });
    }

    if (expected && actual && c.expected_type) {
      assert.ok(
        got.types.includes(c.expected_type),
        `case ${c.id}: expected type "${c.expected_type}" in ${JSON.stringify(got.types)}`
      );
    }
  }

  const precision = truePositive / (truePositive + falsePositive) || 0;
  const recall = truePositive / (truePositive + falseNegative) || 0;

  return { truePositive, falsePositive, falseNegative, trueNegative, precision, recall, misclassified };
}

test("Tier 1 detector: recall and precision on the synthetic benchmark fixture set", () => {
  const metrics = runBenchmark();

  assert.equal(
    metrics.misclassified.length,
    0,
    `misclassified cases: ${JSON.stringify(metrics.misclassified, null, 2)}`
  );
  assert.equal(metrics.recall, 1, `recall was ${metrics.recall}`);
  assert.equal(metrics.precision, 1, `precision was ${metrics.precision}`);

  // eslint-disable-next-line no-console
  console.log(
    `[benchmark] TP=${metrics.truePositive} FP=${metrics.falsePositive} FN=${metrics.falseNegative} TN=${metrics.trueNegative} recall=${metrics.recall} precision=${metrics.precision}`
  );
});

module.exports = { runBenchmark };
