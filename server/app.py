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


import httpx
import json

@app.post("/reason", response_model=TypedAction)
async def reason(context: SanitizedContext) -> TypedAction:
    if not context.elements:
        return TypedAction(action="noop", target_id=None, value=None)
    
    # We construct a prompt for the local model (OpenAI compatible endpoint)
    # The extension will send the user's prompt as the first element's text as a hack, or we can just make it generic.
    elements_text = json.dumps([el.model_dump() for el in context.elements])
    prompt = f"You are a browser automation agent. Given these elements:\n{elements_text}\nPick the ID of the most likely element the user wants to click, or type into. Output a JSON object with 'action' ('click', 'type', or 'noop'), 'target_id' (the element id), and 'value' (if typing)."
    
    try:
        # Assuming local model like Ollama on port 11434
        async with httpx.AsyncClient() as client:
            resp = await client.post("http://localhost:11434/v1/chat/completions", json={
                "model": "llama3.1", # Or whichever lightweight model is available
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"}
            }, timeout=30.0)
            
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                result = json.loads(content)
                return TypedAction(
                    action=result.get("action", "noop"),
                    target_id=result.get("target_id"),
                    value=result.get("value")
                )
    except Exception as e:
        print("Error calling local model:", e)
        
    # Fallback to stub behavior if model fails
    first = context.elements[0]
    return TypedAction(action="click", target_id=first.id, value=None)
