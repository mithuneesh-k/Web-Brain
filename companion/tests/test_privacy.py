import pytest

from companion.privacy.typed_action_guard import validate_typed_action
from companion.privacy.adapter_boundary import (
    AdapterBoundaryError,
    submit_to_local_execution_adapter,
)


def test_valid_click_action_is_valid():
    result = validate_typed_action(
        {"version": "1.0.0", "action": "click", "target_id": "el-1", "value": None}
    )
    assert result.valid is True


def test_valid_noop_action_is_valid():
    result = validate_typed_action(
        {"version": "1.0.0", "action": "noop", "target_id": None, "value": None}
    )
    assert result.valid is True


def test_unknown_action_type_is_rejected():
    result = validate_typed_action(
        {"version": "1.0.0", "action": "eval", "target_id": None, "value": "os.system('rm -rf /')"}
    )
    assert result.valid is False
    assert any("unknown action" in r.lower() for r in result.reasons)


def test_click_without_target_id_is_rejected():
    result = validate_typed_action(
        {"version": "1.0.0", "action": "click", "target_id": None, "value": None}
    )
    assert result.valid is False
    assert any("target_id" in r for r in result.reasons)


def test_noop_with_target_id_is_rejected():
    result = validate_typed_action(
        {"version": "1.0.0", "action": "noop", "target_id": "el-1", "value": None}
    )
    assert result.valid is False


def test_malformed_action_object_is_rejected():
    result = validate_typed_action({"not": "a typed action"})
    assert result.valid is False


# --- Test 12: browser-use integration boundary ---


def test_adapter_accepts_a_valid_typed_action():
    payload = {"version": "1.0.0", "action": "click", "target_id": "el-1", "value": None}
    accepted = submit_to_local_execution_adapter(payload)
    assert accepted["action"] == "click"


def test_adapter_rejects_a_screenshot_field():
    payload = {
        "version": "1.0.0",
        "action": "click",
        "target_id": "el-1",
        "value": None,
        "screenshot": "data:image/png;base64,aaaa",
    }
    with pytest.raises(AdapterBoundaryError):
        submit_to_local_execution_adapter(payload)


def test_adapter_rejects_any_unrecognized_key():
    payload = {
        "version": "1.0.0",
        "action": "click",
        "target_id": "el-1",
        "value": None,
        "raw_dom_text": "sensitive page content here",
    }
    with pytest.raises(AdapterBoundaryError):
        submit_to_local_execution_adapter(payload)
