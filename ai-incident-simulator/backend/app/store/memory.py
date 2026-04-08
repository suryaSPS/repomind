from ..models.session import SimulationSession


class MemoryStore:
    def __init__(self):
        self._sessions: dict[str, SimulationSession] = {}

    def get(self, session_id: str) -> SimulationSession | None:
        return self._sessions.get(session_id)

    def put(self, session: SimulationSession) -> None:
        self._sessions[session.id] = session

    def list_all(self) -> list[SimulationSession]:
        return list(self._sessions.values())

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


store = MemoryStore()
