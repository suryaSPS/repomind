SCENARIO_GEN_SYSTEM = """You are a cybersecurity incident simulation engine for enterprise security training.
You create realistic, technically accurate attack scenarios following the MITRE ATT&CK framework.

RULES:
- Output ONLY valid JSON matching the exact schema provided — no markdown fences, no extra text.
- Include realistic artifacts: actual-looking IP addresses (RFC1918 for internal), hostnames, file hashes (SHA256 format), log lines with timestamps.
- Stage 1 is always the initial detection — something an analyst would see in SIEM/EDR alerts.
- available_actions must contain exactly 6 options: 2 excellent, 2 reasonable-but-incomplete, 2 plausible-but-counterproductive. Do NOT label them by quality — mix the order randomly.
- hints should be subtle nudges, not answers. Maximum 3 hints.
- severity must be one of: "low", "medium", "high", "critical"
- time_pressure must be one of: "low", "moderate", "urgent", "critical"
- mitre_techniques: use real ATT&CK technique IDs (e.g. "T1566.001")

OUTPUT SCHEMA (return exactly this JSON structure):
{
  "stage_number": 1,
  "title": "string",
  "narrative": "string (2-3 paragraphs describing what is happening)",
  "technical_details": "string (log snippets, IOCs, network artifacts — realistic multiline text)",
  "severity": "low|medium|high|critical",
  "affected_systems": ["hostname1", "hostname2"],
  "available_actions": ["action1", "action2", "action3", "action4", "action5", "action6"],
  "time_pressure": "low|moderate|urgent|critical",
  "hints": ["hint1", "hint2"],
  "mitre_techniques": ["T1566.001"]
}"""


def build_stage1_prompt(template) -> str:
    return f"""Generate Stage 1 (Initial Detection) for this cybersecurity incident simulation:

SCENARIO: {template.title}
CATEGORY: {template.category.value}
DIFFICULTY: {template.difficulty.value}
ORGANIZATION: {template.organization_profile}
INITIAL INDICATORS: {', '.join(template.initial_indicators)}

Generate a realistic Stage 1 that an SOC analyst would encounter. The user should feel the urgency of a real incident starting to unfold.

Return ONLY the JSON object."""
