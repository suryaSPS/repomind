import type {
  ScenarioTemplate,
  SimulationSession,
  ScoreCard,
  ResponseEvaluation,
  ScenarioStage,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getScenarios(): Promise<ScenarioTemplate[]> {
    return fetchJSON("/api/scenarios");
  },

  getScenario(id: string): Promise<ScenarioTemplate> {
    return fetchJSON(`/api/scenarios/${id}`);
  },

  createSession(scenarioId: string): Promise<SimulationSession> {
    return fetchJSON("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  },

  getSession(id: string): Promise<SimulationSession> {
    return fetchJSON(`/api/sessions/${id}`);
  },

  submitResponse(
    sessionId: string,
    selectedActions: string[],
    freeText: string
  ): Promise<{
    evaluation: ResponseEvaluation;
    next_stage: ScenarioStage | null;
    is_complete: boolean;
    session: SimulationSession;
  }> {
    return fetchJSON(`/api/sessions/${sessionId}/respond`, {
      method: "POST",
      body: JSON.stringify({ selected_actions: selectedActions, free_text: freeText }),
    });
  },

  getScore(sessionId: string): Promise<ScoreCard> {
    return fetchJSON(`/api/sessions/${sessionId}/score`);
  },
};
