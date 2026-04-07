import uuid
from datetime import datetime
from ..models.session import SimulationSession, SessionStatus
from ..models.scenario import ScenarioTemplate
from ..models.response import UserResponse
from ..models.score import ScoreCard
from ..store.memory import store
from .llm_chain import (
    generate_initial_stage,
    evaluate_response,
    generate_next_stage,
    generate_score,
)


def start_simulation(template: ScenarioTemplate) -> SimulationSession:
    """Create a new session and generate the first stage."""
    session = SimulationSession(
        id=str(uuid.uuid4()),
        scenario_template_id=template.id,
        scenario_title=template.title,
        total_stages=template.estimated_stages,
    )

    stage1 = generate_initial_stage(template)
    session.stages.append(stage1)
    store.put(session)
    return session


def process_response(session_id: str, selected_actions: list[str], free_text: str) -> tuple[SimulationSession, bool]:
    """
    Process the user's response to the current stage.
    Returns (updated_session, is_complete).
    """
    session = store.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")
    if session.status != SessionStatus.ACTIVE:
        raise ValueError(f"Session {session_id} is not active")

    current_stage = session.stages[session.current_stage - 1]

    # Record the user's response
    user_response = UserResponse(
        stage_number=session.current_stage,
        selected_actions=selected_actions,
        free_text=free_text,
    )
    session.responses.append(user_response)

    # Evaluate the response
    evaluation = evaluate_response(current_stage, user_response)
    session.evaluations.append(evaluation)

    # Determine if this was the final stage
    is_final = session.current_stage >= session.total_stages

    if is_final:
        # Generate final stage resolution, then score
        final_stage = generate_next_stage(session, evaluation, is_final=True)
        session.stages.append(final_stage)
        session.status = SessionStatus.COMPLETED
        session.updated_at = datetime.utcnow()
        store.put(session)
        return session, True
    else:
        # Generate the next stage
        next_stage = generate_next_stage(session, evaluation, is_final=False)
        session.stages.append(next_stage)
        session.current_stage += 1
        session.updated_at = datetime.utcnow()
        store.put(session)
        return session, False


def complete_and_score(session_id: str) -> ScoreCard:
    """Generate the final score card for a completed session."""
    session = store.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    time_taken = int((session.updated_at - session.created_at).total_seconds())

    score = generate_score(session)
    score.time_taken_seconds = time_taken
    return score
