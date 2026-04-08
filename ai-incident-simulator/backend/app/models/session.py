from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field
from .scenario import ScenarioStage
from .response import UserResponse, ResponseEvaluation


class SessionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class SimulationSession(BaseModel):
    id: str
    scenario_template_id: str
    scenario_title: str
    status: SessionStatus = SessionStatus.ACTIVE
    current_stage: int = 1
    total_stages: int = 6
    stages: list[ScenarioStage] = Field(default_factory=list)
    responses: list[UserResponse] = Field(default_factory=list)
    evaluations: list[ResponseEvaluation] = Field(default_factory=list)
    conversation_history: list[dict] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
