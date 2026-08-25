import json
from pathlib import Path

from jsonschema import validate

SCHEMAS_DIR = Path(__file__).resolve().parent


def _load(name):
    return json.loads((SCHEMAS_DIR / name).read_text())


def test_sanitized_context_example_matches_schema():
    schema = _load("sanitized-context.schema.json")
    example = _load("examples/sanitized-context.example.json")
    validate(instance=example, schema=schema)


def test_typed_action_example_matches_schema():
    schema = _load("typed-action.schema.json")
    example = _load("examples/typed-action.example.json")
    validate(instance=example, schema=schema)


def test_execution_result_example_matches_schema():
    schema = _load("execution-result.schema.json")
    example = _load("examples/execution-result.example.json")
    validate(instance=example, schema=schema)
