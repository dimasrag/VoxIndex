from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
from sqlalchemy import inspect, text

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.models import Base, engine
from app.api import auth as auth_router
from app.api import voice_refs as voice_refs_router
from app.api import synthesis as synthesis_router
from app.api import admin as admin_router

app = FastAPI(title="Voice Synthesis API")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}

def _parse_origins(raw_origins: str):
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:5173", "http://127.0.0.1:5173"]


frontend_origins = _parse_origins(
    os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STORAGE_PATH = os.getenv("STORAGE_PATH", "../storage")
OUTPUTS_PATH = os.path.join(STORAGE_PATH, "outputs")
VOICE_REFS_PATH = os.path.join(STORAGE_PATH, "voice_refs")

AVATARS_PATH = os.path.join(STORAGE_PATH, "avatars")
os.makedirs(AVATARS_PATH, exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=AVATARS_PATH), name="avatars")

os.makedirs(OUTPUTS_PATH, exist_ok=True)
os.makedirs(VOICE_REFS_PATH, exist_ok=True)

app.mount("/static/outputs", StaticFiles(directory=OUTPUTS_PATH), name="outputs")
app.mount("/static/voice_refs", StaticFiles(directory=VOICE_REFS_PATH), name="voice_refs")


def _ensure_user_admin_column():
    with engine.begin() as connection:
        inspector = inspect(connection)
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "is_admin" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))

def _ensure_avatar_column():
    with engine.begin() as connection:
        inspector = inspect(connection)
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        if "avatar_filename" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_filename VARCHAR"))


@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    _ensure_user_admin_column()
    _ensure_avatar_column()
    os.makedirs(OUTPUTS_PATH, exist_ok=True)
    os.makedirs(VOICE_REFS_PATH, exist_ok=True)

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(voice_refs_router.router, prefix="/api/voice-refs", tags=["voice-refs"])
app.include_router(synthesis_router.router, prefix="/api/synthesis", tags=["synthesis"])
app.include_router(admin_router.router, prefix="/api/admin", tags=["admin"])
