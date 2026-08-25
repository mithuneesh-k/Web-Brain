"""Ozer local companion — Phase 5/6 stub.

STUB: /execute does not touch a real browser. It acknowledges the
TypedAction and returns a fixed result. Real browser-use-backed
execution arrives in Phase 9, per docs/adr/0003-browser-use-integration-strategy.md
— this companion process is exactly the boundary that ADR decided
browser-use will sit behind: it receives only already-decided typed
actions, never raw screenshots or page content.

Phase 6: every request is re-validated by validate_typed_action()
(defense-in-depth beyond Pydantic schema shape) and routed through
submit_to_local_execution_adapter() — the same boundary function that
will sit in front of real browser-use in Phase 9 (Threat T11,
docs/specs/phase6-threat-model.md).
"""

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict

from companion.privacy.adapter_boundary import (
    AdapterBoundaryError,
    submit_to_local_execution_adapter,
)
from companion.privacy.typed_action_guard import validate_typed_action


class TypedAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str
    action: Literal["click", "noop"]
    target_id: str | None
    value: str | None


class ExecutionResult(BaseModel):
    version: str = "1.0.0"
    status: str
    detail: str


app = FastAPI(title="ozer-companion", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/execute", response_model=ExecutionResult)
def execute(action: TypedAction) -> ExecutionResult:
    action_dict = action.model_dump()

    guard_result = validate_typed_action(action_dict)
    if not guard_result.valid:
        raise HTTPException(status_code=400, detail=guard_result.reasons)

    try:
        accepted = submit_to_local_execution_adapter(action_dict)
    except AdapterBoundaryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if accepted["action"] == "noop":
        return ExecutionResult(status="ok", detail="stub execution: noop acknowledged")
    return ExecutionResult(
        status="ok",
        detail=f"stub execution: {accepted['action']} on {accepted['target_id']} acknowledged",
    )
