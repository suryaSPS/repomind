from fastapi import APIRouter, HTTPException
from ..models.score import ScoreCard
from ..models.session import SessionStatus
from ..store.memory import store
from ..engine.simulation import complete_and_score

router = APIRouter(prefix="/api/sessions", tags=["scores"])


@router.get("/{session_id}/score", response_model=ScoreCard)
async def get_score(session_id: str):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    if session.status != SessionStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Score is only available after the simulation is completed",
        )

    try:
        score = complete_and_score(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring failed: {e}")

    return score
