# Ayatrisya Chat Model Server - Request and Response Schemas
# Parent Company: Ametesx

from typing import List, Literal, Optional
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Chat Attachment
# ---------------------------------------------------------------------------
class ModelChatAttachment(BaseModel):
    name: str = Field(..., max_length=255)
    mimeType: str = Field(..., max_length=100)
    dataBase64: Optional[str] = Field(None, max_length=25_000_000)
    textContent: Optional[str] = Field(None, max_length=2_000_000)
    size: Optional[int] = Field(None, le=25_000_000)

# ---------------------------------------------------------------------------
# Chat Request & Response (SendModelChatBody / SendModelChatResponse)
# ---------------------------------------------------------------------------
class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=2_000_000)
    attachments: Optional[List[ModelChatAttachment]] = Field(None, max_length=10)

class SendModelChatBody(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=128)
    model: Literal["v1-fast", "v2-best"] = "v1-fast"
    mode: Literal["Normal", "Savage", "Joke"] = "Normal"
    stream: bool = False
    attachments: Optional[List[ModelChatAttachment]] = Field(None, max_length=10)

class SendModelChatResponse(BaseModel):
    text: str = Field(..., max_length=2_000_000)
    provider: Optional[str] = "ayatrisya-native"
    model: Optional[str] = None
    engine: Optional[str] = None

# ---------------------------------------------------------------------------
# Health Response (GetModelHealthResponse)
# Status must be 'ok' or 'not_ready'
# ---------------------------------------------------------------------------
class GetModelHealthResponse(BaseModel):
    status: Literal["ok", "not_ready"]
    model: Optional[str] = None
    readiness: Optional[str] = None
    parameter_count: Optional[str] = None
    device: Optional[str] = None
    error: Optional[str] = None

# ---------------------------------------------------------------------------
# Capabilities Response (GetModelCapabilitiesResponse)
# ---------------------------------------------------------------------------
class ModelCapabilityItem(BaseModel):
    id: Literal["v1-fast", "v2-best"]
    available: bool
    reason: Optional[str] = Field(None, max_length=300)
    streaming: Optional[bool] = True
    attachments: Optional[bool] = True
    modalities: Optional[List[str]] = Field(default_factory=lambda: ["chat"])

class GetModelCapabilitiesResponse(BaseModel):
    models: List[ModelCapabilityItem] = Field(..., max_length=2)
