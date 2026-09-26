"""
server.py
FastAPI application entrypoint for Bitirme Projesi Takip Sistemi.
Serves the REST API and the compiled React frontend.
"""
from __future__ import annotations

import datetime
from pathlib import Path
import platform
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.ai import router as ai_router
from api.auth import router as auth_router
from api.feedback import router as feedback_router
from api.projects import router as projects_router
from api.tasks import router as tasks_router
from api.weekly import router as weekly_router
from constants import DB_PATH, UPLOADS_DIR
from db import get_conn
from models import ensure_database_synced

SERVER_START_TIME = datetime.datetime.now(datetime.timezone.utc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database schema and tables exist
    conn = get_conn(DB_PATH)
    ensure_database_synced(conn)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Bitirme Projesi Takip API",
    description="REST API for Capstone Project Tracking and Academic Intelligence System",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount API Routers ─────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(weekly_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
app.include_router(ai_router, prefix="/api")

# ── Mount Uploads Directory ───────────────────────────────────────────────────
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Bitirme Projesi Takip API", "version": "2.0.0"}


@app.get("/api/health/system")
def system_health_telemetry():
    """IT Operations Telemetry: Real-time database metrics, disk storage, and uptime."""
    now = datetime.datetime.now(datetime.timezone.utc)
    uptime_sec = int((now - SERVER_START_TIME).total_seconds())

    db_file = Path(DB_PATH)
    db_size_kb = round(db_file.stat().st_size / 1024, 2) if db_file.exists() else 0

    conn = get_conn(DB_PATH)
    try:
        integrity_row = conn.execute("PRAGMA integrity_check").fetchone()
        integrity = integrity_row[0] if integrity_row else "unknown"
    except Exception:
        integrity = "unknown"

    students_count = conn.execute("SELECT count(*) FROM students").fetchone()[0]
    projects_count = conn.execute("SELECT count(DISTINCT project_name) FROM students").fetchone()[0]
    tasks_count = conn.execute("SELECT count(*) FROM tasks").fetchone()[0]

    disk = shutil.disk_usage(str(db_file.parent.resolve()))
    disk_free_gb = round(disk.free / (1024**3), 2)
    disk_total_gb = round(disk.total / (1024**3), 2)

    return {
        "status": "healthy",
        "app": "Bitirme Projesi Takip API",
        "version": "2.0.0",
        "uptime_seconds": uptime_sec,
        "runtime": {
            "python": platform.python_version(),
            "os": platform.system(),
            "platform": platform.platform(),
        },
        "database": {
            "path": str(DB_PATH),
            "size_kb": db_size_kb,
            "integrity": integrity,
            "students_count": students_count,
            "projects_count": projects_count,
            "tasks_count": tasks_count,
        },
        "storage": {
            "disk_free_gb": disk_free_gb,
            "disk_total_gb": disk_total_gb,
            "uploads_dir": str(UPLOADS_DIR),
        },
    }


# ── Mount Frontend (if built) ─────────────────────────────────────────────────
FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
