export type AttackCategory =
  | "ransomware"
  | "phishing"
  | "supply_chain"
  | "insider_threat"
  | "advanced_persistent_threat"
  | "ddos"
  | "zero_day";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Severity = "low" | "medium" | "high" | "critical";
export type TimePressure = "low" | "moderate" | "urgent" | "critical";
export type SessionStatus = "active" | "completed" | "abandoned";

export interface ScenarioTemplate {
  id: string;
  title: string;
  category: AttackCategory;
  difficulty: Difficulty;
  description: string;
  organization_profile: string;
  initial_indicators: string[];
  estimated_stages: number;
}

export interface ScenarioStage {
  stage_number: number;
  title: string;
  narrative: string;
  technical_details: string;
  severity: Severity;
  affected_systems: string[];
  available_actions: string[];
  time_pressure: TimePressure;
  hints: string[];
  mitre_techniques: string[];
}

export interface UserResponse {
  stage_number: number;
  selected_actions: string[];
  free_text: string;
  timestamp: string;
}

export interface ResponseEvaluation {
  stage_number: number;
  effectiveness_score: number;
  reasoning: string;
  consequences: string;
  missed_actions: string[];
  good_calls: string[];
}

export interface SimulationSession {
  id: string;
  scenario_template_id: string;
  scenario_title: string;
  status: SessionStatus;
  current_stage: number;
  total_stages: number;
  stages: ScenarioStage[];
  responses: UserResponse[];
  evaluations: ResponseEvaluation[];
  created_at: string;
  updated_at: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  max_score: number;
  feedback: string;
}

export interface FeedbackItem {
  stage_number: number;
  type: "strength" | "improvement" | "critical_miss";
  title: string;
  detail: string;
  reference: string;
}

export interface ScoreCard {
  session_id: string;
  overall_score: number;
  grade: string;
  category_scores: CategoryScore[];
  feedback_items: FeedbackItem[];
  executive_summary: string;
  improvement_plan: string[];
  time_taken_seconds: number;
  mitre_techniques_encountered: string[];
}
