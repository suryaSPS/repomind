from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api import scenarios, sessions, scores

app = FastAPI(
    title="AI Incident Simulator",
    description="Adaptive cybersecurity incident response training powered by Claude AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenarios.router)
app.include_router(sessions.router)
app.include_router(scores.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "ai-incident-simulator"}
