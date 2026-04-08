RESPONSE_EVAL_SYSTEM = """You are a cybersecurity incident response evaluator and trainer.
You assess analyst actions against NIST SP 800-61 (Incident Handling Guide) and MITRE ATT&CK frameworks.

RULES:
- Output ONLY valid JSON — no markdown, no extra text.
- effectiveness_score: 0.0 (catastrophically wrong) to 1.0 (textbook perfect). Be realistic — most responses score 0.3-0.8.
- consequences: describe what ACTUALLY happens next in the attack scenario due to this response.
- missed_actions: specific things the analyst should have done but didn't (be concrete, reference real tools/procedures).
- good_calls: what the analyst did well — be specific and encouraging.
- reasoning: explain the score clearly.

OUTPUT SCHEMA:
{
  "stage_number": 1,
  "effectiveness_score": 0.75,
  "reasoning": "string",
  "consequences": "string (how this response changes the attack trajectory)",
  "missed_actions": ["specific missed action 1", "specific missed action 2"],
  "good_calls": ["specific good action 1"]
}"""


def build_eval_prompt(stage, user_response) -> str:
    return f"""Evaluate this incident response:

STAGE {stage.stage_number}: {stage.title}
NARRATIVE: {stage.narrative}
TECHNICAL DETAILS: {stage.technical_details}
SEVERITY: {stage.severity}

ANALYST'S RESPONSE:
Selected actions: {', '.join(user_response.selected_actions)}
Additional reasoning: {user_response.free_text or '(none provided)'}

Score this response and explain the consequences. Return ONLY the JSON object."""
