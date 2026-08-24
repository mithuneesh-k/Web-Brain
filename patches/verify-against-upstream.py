"""Verify Ozer's patch series applies cleanly to pinned WebBrain v32.2.3.

Fetches only the files the patches touch (not the 1.2 GB repo), applies
the series, and asserts the intended effect. Network required.

    python patches/verify-against-upstream.py

Exit 0 = every patch applies and produces the expected result.
"""

import pathlib
import subprocess
import sys
import tempfile
import urllib.request

# Pinned by docs/adr/0006-pin-webbrain-v32-2-3.md. Do not float this.
SHA = "52fb7914611717f2e9774dc137036a074b293b1d"
RAW = "https://raw.githubusercontent.com/webbrain-one/webbrain/{sha}/{path}"

FILES = [
    "src/chrome/src/agent/agent.js",
    "src/chrome/src/background.js",
    "src/firefox/src/agent/agent.js",
    "src/firefox/src/background.js",
]

# What must be true AFTER the series is applied.
EXPECTED = [
    ("src/chrome/src/agent/agent.js", "this.screenshotRedaction = true;"),
    ("src/firefox/src/agent/agent.js", "this.screenshotRedaction = true;"),
]
# What must NOT survive.
FORBIDDEN = [
    ("src/chrome/src/agent/agent.js", "this.screenshotRedaction = false;"),
    ("src/firefox/src/agent/agent.js", "this.screenshotRedaction = false;"),
]

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATCH_DIR = ROOT / "patches"


def main() -> int:
    patches = sorted(PATCH_DIR.glob("*.patch"))
    if not patches:
        print("no patches found")
        return 1

    with tempfile.TemporaryDirectory() as tmp:
        work = pathlib.Path(tmp)
        print(f"pinned SHA {SHA}")
        for rel in FILES:
            dest = work / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            url = RAW.format(sha=SHA, path=rel)
            with urllib.request.urlopen(url) as resp:  # noqa: S310 - fixed, pinned host
                dest.write_bytes(resp.read())
            print(f"  fetched {rel}")

        for patch in patches:
            check = subprocess.run(
                ["git", "apply", "--check", str(patch)],
                cwd=work, capture_output=True, text=True,
            )
            if check.returncode != 0:
                print(f"FAIL {patch.name} does not apply cleanly:\n{check.stderr}")
                return 1
            subprocess.run(["git", "apply", str(patch)], cwd=work, check=True)
            print(f"  applied {patch.name}")

        ok = True
        for rel, needle in EXPECTED:
            if needle not in (work / rel).read_text(encoding="utf-8", errors="replace"):
                print(f"FAIL expected {needle!r} in {rel}")
                ok = False
        for rel, needle in FORBIDDEN:
            if needle in (work / rel).read_text(encoding="utf-8", errors="replace"):
                print(f"FAIL {needle!r} still present in {rel}")
                ok = False

        if not ok:
            return 1

    print(f"OK: {len(patches)} patch(es) apply to {SHA} with the expected effect")
    return 0


if __name__ == "__main__":
    sys.exit(main())
