from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class StatsResponse(BaseModel):
    game_count: int


class LeaderboardEntry(BaseModel):
    rank: int
    nickname: str
    games_played: int
    wins: int
    losses: int
    win_rate: float
    total_score: int


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]


class CsvImportResponse(BaseModel):
    added: int
    errors: list[str]


class RecentGameEntry(BaseModel):
    id: int
    player1_nickname: str
    player2_nickname: str
    player1_score: int
    player2_score: int
    winner_nickname: str | None
    ended_at: datetime | None


class RecentGamesResponse(BaseModel):
    games: list[RecentGameEntry]


class QuestionCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    answer: int = Field(..., ge=0, le=1_000_000)
    category: str | None = Field(None, max_length=255)

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        # Reject whitespace-only text (mirrors the nickname check) and store the
        # trimmed value so a question of only spaces cannot be persisted.
        stripped = v.strip()
        if not stripped:
            raise ValueError("Текст вопроса не может быть пустым")
        return stripped


class QuestionResponse(BaseModel):
    id: int
    text: str
    answer: int
    category: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
