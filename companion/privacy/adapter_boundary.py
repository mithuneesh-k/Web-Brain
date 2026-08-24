"""The browser-use integration boundary (Threat T11,
docs/specs/phase6-threat-model.md).

Per docs/adr/0003-browser-use-integration-strategy.md, browser-use must
never receive raw screenshots or raw page content — only already-decided
TypedActions. This function is the single point that boundary is
enforced in code: it accepts *only* the four TypedAction keys and raises
on anything else, so a screenshot (or any other unexpected payload)
cannot structurally reach whatever sits behind it, whether that's today's
stub or a real browser-use instance in Phase 9.
"""

ALLOWED_KEYS = {"version", "action", "target_id", "value"}


class AdapterBoundaryError(Exception):
    """Raised when a payload attempts to cross the adapter boundary with
    a field outside the approved TypedAction contract."""


def submit_to_local_execution_adapter(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise AdapterBoundaryError("payload is not an object")

    unexpected = set(payload.keys()) - ALLOWED_KEYS
    if unexpected:
        raise AdapterBoundaryError(
            f"payload contains fields not permitted across the local execution adapter boundary: {unexpected}"
        )

    missing = ALLOWED_KEYS - set(payload.keys())
    if missing:
        raise AdapterBoundaryError(f"payload missing required TypedAction fields: {missing}")

    return dict(payload)
