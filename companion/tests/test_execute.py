import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import validate

from companion.app import app

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMAS = REPO_ROOT / "schemas"

client = TestClient(app)


def _load(name):
    return json.loads((SCHEMAS / name).read_text())


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_execute_click_returns_schema_valid_result():
    typed_action = _load("examples/typed-action.example.json")
    result_schema = _load("execution-result.schema.json")

    resp = client.post("/execute", json=typed_action)

    assert resp.status_code == 200
    body = resp.json()
    validate(instance=body, schema=result_schema)
    assert body["status"] == "ok"
    assert "el-1" in body["detail"]


def test_execute_noop_returns_ok():
    noop_action = {
        "version": "1.0.0",
        "action": "noop",
        "target_id": None,
        "value": None,
    }
    resp = client.post("/execute", json=noop_action)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_execute_rejects_invalid_typed_action():
    resp = client.post("/execute", json={"not": "valid"})
    assert resp.status_code == 422
