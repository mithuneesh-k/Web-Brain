"""Regenerate the real-capture fixtures used by
extension/test/integration/realScreenshotPipeline.test.js.

Captures a real browser screenshot AND the real getBoundingClientRect()
values in the SAME session, so pixels and geometry are guaranteed to
describe the same render. That coupling is the whole point: geometry
captured separately from pixels could silently drift and the test would
still pass while proving nothing.

    pip install playwright && playwright install chromium
    python extension/tools/capture-fixture.py

Writes extension/test/fixtures/real-capture.png and
extension/test/fixtures/real-capture-geometry.json.
"""

import json
import pathlib

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "extension" / "test" / "fixtures"
PAGE = FIXTURES / "sensitive-page.html"

VIEWPORT = {"width": 800, "height": 600}
DEVICE_SCALE_FACTOR = 1.25  # deliberately fractional — the leak-prone case

EXTRACT = """() => {
  const out = { dpr: window.devicePixelRatio, scrollX: window.scrollX, scrollY: window.scrollY,
                vw: window.innerWidth, vh: window.innerHeight, elements: [] };
  document.querySelectorAll('input, button, header, footer, p, label').forEach((e, i) => {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    out.elements.push({
      id: e.id || (e.tagName.toLowerCase() + '-' + i),
      role: e.tagName === 'INPUT' ? 'textbox' : (e.tagName === 'BUTTON' ? 'button' : 'text'),
      type: e.getAttribute('type') || '',
      name: e.getAttribute('name') || '',
      autocomplete: e.getAttribute('autocomplete') || '',
      ariaLabel: e.getAttribute('aria-label') || '',
      text: e.tagName === 'INPUT' ? (e.value || '') : (e.textContent || '').trim().slice(0, 120),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height }
    });
  });
  return out;
}"""

NOTE = (
    "REAL getBoundingClientRect() values captured in the SAME browser session that "
    "produced real-capture.png, so geometry and pixels are guaranteed consistent. "
    "Fixture page content is synthetic. Regenerate: python extension/tools/capture-fixture.py"
)


def main() -> None:
    with sync_playwright() as p:
        browser = None
        for launch_args in ({"channel": "chrome"}, {}):
            try:
                browser = p.chromium.launch(**launch_args)
                break
            except Exception as exc:  # noqa: BLE001 - report and try the fallback
                print(f"launch {launch_args or 'bundled'} failed: {str(exc)[:120]}")
        if browser is None:
            raise SystemExit("no usable Chromium; run: playwright install chromium")

        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE_FACTOR)
        page.goto(PAGE.as_uri())
        page.wait_for_load_state("networkidle")
        geometry = page.evaluate(EXTRACT)
        page.screenshot(path=str(FIXTURES / "real-capture.png"))
        browser.close()

    geometry["_note"] = NOTE
    (FIXTURES / "real-capture-geometry.json").write_text(json.dumps(geometry, indent=1))

    print(f"dpr={geometry['dpr']} viewport={geometry['vw']}x{geometry['vh']} "
          f"elements={len(geometry['elements'])}")
    print(f"wrote {FIXTURES / 'real-capture.png'}")
    print(f"wrote {FIXTURES / 'real-capture-geometry.json'}")


if __name__ == "__main__":
    main()
