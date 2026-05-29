from datetime import datetime

from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    answer: int = Field(..., ge=0, le=1_000_000)
    category: str | None = Field(None, max_length=255)


class QuestionResponse(BaseModel):
    id: int
    text: str
    answer: int
    category: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
