from datetime import datetime
from pydantic import BaseModel, Field


class UserResponse(BaseModel):
    stage_number: int
    selected_actions: list[str]
    free_text: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ResponseEvaluation(BaseModel):
    stage_number: int
    effectiveness_score: float  # 0.0 - 1.0
    reasoning: str
    consequences: str
    missed_actions: list[str]
    good_calls: list[str]
