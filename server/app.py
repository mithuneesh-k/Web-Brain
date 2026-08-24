"""Ozer reasoning server — Phase 5/6 stub.

STUB: /reason does not call any LLM. It deterministically picks the
first element in a SanitizedContext and returns a click action for it,
or noop if there are none. Real reasoning arrives in Phase 8.

Phase 6: SanitizedContext is v1.1.0 (privacy metadata required). The
server validates schema shape via Pydantic (extra="forbid") but does
NOT re-run the extension-side egress gate's pattern checks — see
docs/architecture/trust-boundaries.md, Threat T9, for this stated gap.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SanitizedElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: Literal["button", "link", "textbox", "checkbox", "radio", "combobox", "heading", "text", "image"]
    text: str
    redacted: bool = False


class PrivacyMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    redaction_applied: bool
    redacted_regions: list[str]
    redaction_types: list[Literal["pii", "authentication", "financial", "visual_identity"]]
    visual_context_version: str


class SanitizedContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str = Field(pattern=r"^1\.1\.0$")
    page_url_hash: str = Field(min_length=1)
    elements: list[SanitizedElement]
    privacy: PrivacyMetadata
    timestamp: str


class TypedAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: str = "1.0.0"
    action: Literal["click", "noop"]
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
