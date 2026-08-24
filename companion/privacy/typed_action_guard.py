"""TypedAction security contract — companion-side allowlist and shape
guard. Fail-closed: any unrecognized action type, inconsistent
target_id, or malformed input is rejected, never assumed safe.

See docs/specs/privacy-contract.md, "Server Action Security."
"""

from dataclasses import dataclass, field

ALLOWED_ACTIONS = {"click", "noop"}
ACTIONS_REQUIRING_TARGET = {"click"}
ACTIONS_FORBIDDING_TARGET = {"noop"}


@dataclass
class ValidationResult:
    valid: bool
    reasons: list[str] = field(default_factory=list)


def validate_typed_action(action: object) -> ValidationResult:
    try:
        if not isinstance(action, dict):
            return ValidationResult(False, ["typed action is not an object"])

        required_keys = {"version", "action", "target_id", "value"}
        if set(action.keys()) - required_keys:
            return ValidationResult(
                False, [f"unexpected keys on typed action: {set(action.keys()) - required_keys}"]
            )
        if required_keys - set(action.keys()):
            return ValidationResult(
                False, [f"missing required keys on typed action: {required_keys - set(action.keys())}"]
            )

        act = action.get("action")
        if act not in ALLOWED_ACTIONS:
            return ValidationResult(False, [f"unknown action type: {act!r}"])

        target_id = action.get("target_id")
        if act in ACTIONS_REQUIRING_TARGET and target_id is None:
            return ValidationResult(False, [f"action {act!r} requires a non-null target_id"])
        if act in ACTIONS_FORBIDDING_TARGET and target_id is not None:
            return ValidationResult(False, [f"action {act!r} must not have a target_id"])

        return ValidationResult(True, [])
    except Exception as exc:  # fail-closed on any unexpected error
        return ValidationResult(False, [f"internal error during typed action validation: {exc}"])
