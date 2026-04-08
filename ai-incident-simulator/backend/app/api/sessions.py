from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..models.session import SimulationSession
from ..models.response import ResponseEvaluation
from ..models.scenario import ScenarioStage
from ..store.memory import store
from ..engine.simulation import start_simulation, process_response
from .scenarios import get_template

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    scenario_id: str


class RespondRequest(BaseModel):
    selected_actions: list[str]
    free_text: str = ""


class RespondResponse(BaseModel):
    evaluation: ResponseEvaluation
    next_stage: ScenarioStage | None
    is_complete: bool
    session: SimulationSession


@router.post("", response_model=SimulationSession, status_code=201)
async def create_session(body: CreateSessionRequest):
    try:
        template = get_template(body.scenario_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        session = start_simulation(template)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start simulation: {e}")

    return session


@router.get("/{session_id}", response_model=SimulationSession)
async def get_session(session_id: str):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return session


@router.post("/{session_id}/respond", response_model=RespondResponse)
async def respond_to_stage(session_id: str, body: RespondRequest):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")

    if not body.selected_actions:
        raise HTTPException(status_code=400, detail="At least one action must be selected")

    try:
        updated_session, is_complete = process_response(
            session_id, body.selected_actions, body.free_text
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {e}")

    # The latest evaluation is always the last one added
    evaluation = updated_session.evaluations[-1]

    # The next stage is the last stage in the list (stage just generated)
    # When complete, this is the resolution stage
    next_stage = updated_session.stages[-1] if is_complete or len(updated_session.stages) > len(updated_session.responses) else None

    return RespondResponse(
        evaluation=evaluation,
        next_stage=next_stage,
        is_complete=is_complete,
        session=updated_session,
    )
