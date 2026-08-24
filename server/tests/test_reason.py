import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import validate

from server.app import app

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = REPO_ROOT / "schemas"

client = TestClient(app)


def _load(name):
    return json.loads((SCHEMAS / name).read_text())


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_reason_returns_schema_valid_typed_action():
    sanitized_context = _load("examples/sanitized-context.example.json")
    action_schema = _load("typed-action.schema.json")

    resp = client.post("/reason", json=sanitized_context)

    assert resp.status_code == 200
    body = resp.json()
    validate(instance=body, schema=action_schema)
    assert body["action"] == "click"
    assert body["target_id"] == "el-1"


def test_reason_rejects_invalid_sanitized_context():
    resp = client.post("/reason", json={"not": "valid"})
    assert resp.status_code == 422


def test_reason_returns_noop_when_no_elements():
    empty_context = {
        "version": "1.1.0",
        "page_url_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b85",
        "elements": [],
        "privacy": {
            "redaction_applied": False,
            "redacted_regions": [],
            "redaction_types": [],
            "visual_context_version": "none",
        },
        "timestamp": "2026-08-24T00:00:00Z",
    }
    resp = client.post("/reason", json=empty_context)
    assert resp.status_code == 200
    body = resp.json()
    assert body["action"] == "noop"
    assert body["target_id"] is None


def test_reason_rejects_context_with_unexpected_field():
    """Phase 6, Threat T1: a screenshot-shaped field must be rejected at
    the schema level, before it could ever be logged or forwarded."""
    context = json.loads(
        (SCHEMAS / "examples/sanitized-context.example.json").read_text()
    )
    context["screenshot"] = "data:image/png;base64,aaaa"
    resp = client.post("/reason", json=context)
    assert resp.status_code == 422
