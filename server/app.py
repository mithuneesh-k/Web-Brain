"""Ozer reasoning server — Phase 5 stub.

STUB: /reason does not call any LLM. It deterministically picks the
first element in a SanitizedContext and returns a click action for it,
or noop if there are none. Real reasoning arrives in Phase 8.
"""

from pydantic import BaseModel, Field


class SanitizedElement(BaseModel):
    id: str
    role: str
    text: str


class SanitizedContext(BaseModel):
    version: str = Field(pattern=r"^1\.0\.0$")
    page_url_hash: str = Field(min_length=1)
    elements: list[SanitizedElement]
    timestamp: str


class TypedAction(BaseModel):
    version: str = "1.0.0"
    action: str
    target_id: str | None
    value: str | None


from fastapi import FastAPI

app = FastAPI(title="ozer-server", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/reason", response_model=TypedAction)
def reason(context: SanitizedContext) -> TypedAction:
    if not context.elements:
        return TypedAction(action="noop", target_id=None, value=None)
    first = context.elements[0]
    return TypedAction(action="click", target_id=first.id, value=None)
