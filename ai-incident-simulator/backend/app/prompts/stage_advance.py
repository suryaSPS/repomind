STAGE_ADVANCE_SYSTEM = """You are continuing a live cybersecurity incident simulation. You are the adversary AND the environment.

CRITICAL RULES — THE SCENARIO ADAPTS:
- If effectiveness_score >= 0.7: the defender contained this vector well → the attacker PIVOTS to a different technique or system. The attack becomes more sophisticated.
- If effectiveness_score 0.4-0.69: partial containment → the attacker exploits the gaps the defender left open. Escalate through the missed actions.
- If effectiveness_score < 0.4: poor response → the attack ESCALATES dramatically. The attacker gains significant ground.

NARRATIVE CONTINUITY:
- Reference previous stages and analyst actions explicitly. Make it feel like a continuous story.
- Introduce new technical artifacts (new IPs, new files, new log entries) that are consistent with the evolving attack.
- Each stage should feel more intense than the last (unless the defender is doing extremely well).

OUTPUT SCHEMA (same as stage 1):
{
  "stage_number": <N>,
  "title": "string",
  "narrative": "string (2-3 paragraphs — must reference what happened in previous stages)",
  "technical_details": "string (new log snippets, IOCs — different from previous stages)",
  "severity": "low|medium|high|critical",
  "affected_systems": ["hostname1", "hostname2"],
  "available_actions": ["action1", "action2", "action3", "action4", "action5", "action6"],
  "time_pressure": "low|moderate|urgent|critical",
  "hints": ["hint1", "hint2"],
  "mitre_techniques": ["T1486", "T1078"]
}

Return ONLY the JSON object — no markdown, no extra text."""


def build_next_stage_prompt(session, evaluation, is_final: bool) -> str:
    history_summary = []
    for i, (stage, resp, evl) in enumerate(
        zip(session.stages, session.responses, session.evaluations)
    ):
        history_summary.append(
            f"Stage {stage.stage_number} ({stage.title}): "
            f"Analyst actions: {', '.join(resp.selected_actions)}. "
            f"Effectiveness: {evl.effectiveness_score:.1f}/1.0. "
            f"Consequences: {evl.consequences}"
        )

    final_instruction = (
        "This is the FINAL STAGE. Bring the scenario to a climactic resolution — "
        "either the analyst achieves containment or the attacker completes their objective. "
        "Make it dramatic and consequential."
        if is_final
        else f"Generate Stage {session.current_stage + 1}."
    )

    return f"""Scenario: {session.scenario_title}

FULL HISTORY:
{chr(10).join(history_summary)}

Latest response effectiveness: {evaluation.effectiveness_score:.1f}/1.0
Consequences of latest response: {evaluation.consequences}

{final_instruction} The attack trajectory should reflect the cumulative quality of the analyst's responses.

Return ONLY the JSON object."""
