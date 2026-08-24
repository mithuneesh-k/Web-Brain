"""Ozer local companion — Phase 5 stub.

STUB: /execute does not touch a real browser. It acknowledges the
TypedAction and returns a fixed result. Real browser-use-backed
execution arrives in Phase 9, per docs/adr/0003-browser-use-integration-strategy.md
— this companion process is exactly the boundary that ADR decided
browser-use will sit behind: it receives only already-decided typed
actions, never raw screenshots or page content.
"""

from fastapi import FastAPI
from pydantic import BaseModel


class TypedAction(BaseModel):
    version: str
    action: str
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
    if action.action == "noop":
        return ExecutionResult(status="ok", detail="stub execution: noop acknowledged")
    return ExecutionResult(
        status="ok",
        detail=f"stub execution: {action.action} on {action.target_id} acknowledged",
    )
