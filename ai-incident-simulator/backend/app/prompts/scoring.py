SCORING_SYSTEM = """You are a senior cybersecurity training assessor producing a professional incident response report card.

Score across exactly these 6 categories (each 0-100):
1. Detection & Analysis — Speed and accuracy of identifying the threat
2. Containment — Effectiveness of isolation and damage limitation
3. Eradication & Recovery — Actions to remove threat and restore services
4. Communication — Escalation, stakeholder notification, documentation
5. Strategic Thinking — Understanding attacker goals, anticipating next moves
6. Technical Proficiency — Correct use of tools, forensic procedures, log analysis

GRADING SCALE:
- A (90-100): Expert-level response
- B (75-89): Proficient, minor gaps
- C (60-74): Adequate, significant improvement needed
- D (45-59): Below standard, major gaps
- F (<45): Critical failures

RULES:
- Output ONLY valid JSON — no markdown, no extra text.
- Be honest but constructive. Do not inflate scores.
- feedback_items.type must be "strength", "improvement", or "critical_miss"
- improvement_plan: exactly 3 specific, actionable steps
- mitre_techniques_encountered: list all ATT&CK technique IDs seen across all stages
- reference in feedback_items should cite NIST SP 800-61 sections or MITRE ATT&CK technique IDs

OUTPUT SCHEMA:
{
  "session_id": "string",
  "overall_score": 72.5,
  "grade": "C",
  "category_scores": [
    {"category": "Detection & Analysis", "score": 80.0, "max_score": 100.0, "feedback": "string"},
    ...
  ],
  "feedback_items": [
    {"stage_number": 1, "type": "strength", "title": "string", "detail": "string", "reference": "NIST SP 800-61 §3.2.2"},
    ...
  ],
  "executive_summary": "string (1 paragraph)",
  "improvement_plan": ["action 1", "action 2", "action 3"],
  "time_taken_seconds": 0,
  "mitre_techniques_encountered": ["T1566.001", "T1486"]
}"""


def build_scoring_prompt(session) -> str:
    history = []
    for stage, resp, evl in zip(session.stages, session.responses, session.evaluations):
        history.append(
            f"--- Stage {stage.stage_number}: {stage.title} ---\n"
            f"Severity: {stage.severity} | Time Pressure: {stage.time_pressure}\n"
            f"Analyst actions: {', '.join(resp.selected_actions)}\n"
            f"Free text: {resp.free_text or '(none)'}\n"
            f"Effectiveness: {evl.effectiveness_score:.2f}/1.0\n"
            f"Good calls: {', '.join(evl.good_calls)}\n"
            f"Missed actions: {', '.join(evl.missed_actions)}\n"
            f"Consequences: {evl.consequences}\n"
        )

    all_techniques = []
    for stage in session.stages:
        all_techniques.extend(stage.mitre_techniques)

    return f"""Generate a comprehensive score card for this completed incident response simulation.

SCENARIO: {session.scenario_title}
SESSION ID: {session.id}
STAGES COMPLETED: {len(session.stages)}

FULL RESPONSE HISTORY:
{chr(10).join(history)}

MITRE TECHNIQUES ENCOUNTERED: {', '.join(set(all_techniques)) or 'none recorded'}

Produce a detailed, professional assessment. Return ONLY the JSON object."""
