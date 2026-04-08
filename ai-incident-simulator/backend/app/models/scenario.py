from enum import Enum
from pydantic import BaseModel


class AttackCategory(str, Enum):
    RANSOMWARE = "ransomware"
    PHISHING = "phishing"
    SUPPLY_CHAIN = "supply_chain"
    INSIDER_THREAT = "insider_threat"
    APT = "advanced_persistent_threat"
    DDOS = "ddos"
    ZERO_DAY = "zero_day"


class Difficulty(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class ScenarioTemplate(BaseModel):
    id: str
    title: str
    category: AttackCategory
    difficulty: Difficulty
    description: str
    organization_profile: str
    initial_indicators: list[str]
    estimated_stages: int


class ScenarioStage(BaseModel):
    stage_number: int
    title: str
    narrative: str
    technical_details: str
    severity: str  # "low" | "medium" | "high" | "critical"
    affected_systems: list[str]
    available_actions: list[str]
    time_pressure: str  # "low" | "moderate" | "urgent" | "critical"
    hints: list[str]
    mitre_techniques: list[str] = []
