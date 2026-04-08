import json
import re
import logging
from anthropic import Anthropic
from ..config import settings
from ..models.scenario import ScenarioStage, ScenarioTemplate
from ..models.response import UserResponse, ResponseEvaluation
from ..models.score import ScoreCard
from ..prompts.scenario_gen import SCENARIO_GEN_SYSTEM, build_stage1_prompt
from ..prompts.response_eval import RESPONSE_EVAL_SYSTEM, build_eval_prompt
from ..prompts.stage_advance import STAGE_ADVANCE_SYSTEM, build_next_stage_prompt
from ..prompts.scoring import SCORING_SYSTEM, build_scoring_prompt

logger = logging.getLogger(__name__)

client = Anthropic(api_key=settings.anthropic_api_key)
MODEL = "claude-sonnet-4-6"


def _extract_json(text: str) -> str:
    """Extract JSON from text, handling markdown code fences."""
    # Try to find JSON in code fences first
    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence_match:
        return fence_match.group(1)
    # Otherwise find the first { ... } block
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        return brace_match.group(0)
    return text


def _parse_with_retry(text: str, model_cls, attempt: int = 0):
    """Parse JSON response into a Pydantic model, retrying once on failure."""
    try:
        raw = _extract_json(text)
        data = json.loads(raw)
        return model_cls(**data)
    except Exception as e:
        if attempt == 0:
            logger.warning(f"JSON parse failed (attempt 1), retrying: {e}")
            raise _RetryNeeded(text)
        raise ValueError(f"Failed to parse LLM response after retry: {e}\nRaw: {text[:500]}")


class _RetryNeeded(Exception):
    def __init__(self, original_text: str):
        self.original_text = original_text


def _call_claude(system: str, messages: list[dict], max_tokens: int = 4096) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def generate_initial_stage(template: ScenarioTemplate) -> ScenarioStage:
    user_msg = build_stage1_prompt(template)
    messages = [{"role": "user", "content": user_msg}]

    text = _call_claude(SCENARIO_GEN_SYSTEM, messages)
    try:
        return _parse_with_retry(text, ScenarioStage)
    except _RetryNeeded:
        retry_messages = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Your response contained invalid JSON. Return ONLY the JSON object with no additional text or markdown."},
        ]
        text2 = _call_claude(SCENARIO_GEN_SYSTEM, retry_messages)
        return _parse_with_retry(text2, ScenarioStage, attempt=1)


def evaluate_response(stage: ScenarioStage, user_response: UserResponse) -> ResponseEvaluation:
    user_msg = build_eval_prompt(stage, user_response)
    messages = [{"role": "user", "content": user_msg}]

    text = _call_claude(RESPONSE_EVAL_SYSTEM, messages)
    try:
        return _parse_with_retry(text, ResponseEvaluation)
    except _RetryNeeded:
        retry_messages = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Return ONLY the JSON object — no markdown, no extra text."},
        ]
        text2 = _call_claude(RESPONSE_EVAL_SYSTEM, retry_messages)
        return _parse_with_retry(text2, ResponseEvaluation, attempt=1)


def generate_next_stage(session, evaluation: ResponseEvaluation, is_final: bool) -> ScenarioStage:
    user_msg = build_next_stage_prompt(session, evaluation, is_final)
    messages = [{"role": "user", "content": user_msg}]

    text = _call_claude(STAGE_ADVANCE_SYSTEM, messages)
    try:
        return _parse_with_retry(text, ScenarioStage)
    except _RetryNeeded:
        retry_messages = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Return ONLY the JSON object — no markdown, no extra text."},
        ]
        text2 = _call_claude(STAGE_ADVANCE_SYSTEM, retry_messages)
        return _parse_with_retry(text2, ScenarioStage, attempt=1)


def generate_score(session) -> ScoreCard:
    user_msg = build_scoring_prompt(session)
    messages = [{"role": "user", "content": user_msg}]

    text = _call_claude(SCORING_SYSTEM, messages, max_tokens=6000)
    try:
        return _parse_with_retry(text, ScoreCard)
    except _RetryNeeded:
        retry_messages = messages + [
            {"role": "assistant", "content": text},
            {"role": "user", "content": "Return ONLY the JSON object — no markdown, no extra text."},
        ]
        text2 = _call_claude(SCORING_SYSTEM, retry_messages, max_tokens=6000)
        return _parse_with_retry(text2, ScoreCard, attempt=1)
