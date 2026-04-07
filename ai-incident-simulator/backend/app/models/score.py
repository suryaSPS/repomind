from pydantic import BaseModel


class CategoryScore(BaseModel):
    category: str
    score: float
    max_score: float = 100.0
    feedback: str


class FeedbackItem(BaseModel):
    stage_number: int
    type: str  # "strength" | "improvement" | "critical_miss"
    title: str
    detail: str
    reference: str


class ScoreCard(BaseModel):
    session_id: str
    overall_score: float
    grade: str
    category_scores: list[CategoryScore]
    feedback_items: list[FeedbackItem]
    executive_summary: str
    improvement_plan: list[str]
    time_taken_seconds: int
    mitre_techniques_encountered: list[str]
