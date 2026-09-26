"""
constants.py
All application-wide constants and configuration.
Values are loaded from the .env file (via python-dotenv) with sensible defaults.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env file from the project root (same directory as this file).
# Values already set in the shell environment take precedence.
load_dotenv(Path(__file__).with_name(".env"), override=False)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def _env_set(key: str, default: set[str]) -> set[str]:
    raw = _env(key)
    if not raw:
        return default
    return {item.strip() for item in raw.split(",") if item.strip()}


# ── Paths ─────────────────────────────────────────────────────────────────────
DB_PATH: str = _env("DB_PATH", "project_tracker.db")

UPLOADS_DIR = Path(_env("UPLOADS_DIR", "uploads"))
UPLOADS_DIR.mkdir(exist_ok=True)

# ── Auth / User defaults ───────────────────────────────────────────────────────
DEFAULT_ADVISOR: str = _env("DEFAULT_ADVISOR", "Dr. UFUK ASIL")
DEFAULT_PASSWORD: str = _env("DEFAULT_PASSWORD", "12345")
MIN_PASSWORD_LEN: int = _env_int("MIN_PASSWORD_LEN", 6)

# Admin keys (normalized lowercase, no spaces)
ADMIN_ADVISOR_KEYS: set[str] = _env_set("ADMIN_ADVISOR_KEYS", {"drufukasil", "drufukasl"})

# ── Security ──────────────────────────────────────────────────────────────────
SESSION_TIMEOUT_MINUTES: int = _env_int("SESSION_TIMEOUT_MINUTES", 30)
MAX_LOGIN_ATTEMPTS: int = _env_int("MAX_LOGIN_ATTEMPTS", 5)
LOCKOUT_MINUTES: int = _env_int("LOCKOUT_MINUTES", 5)
COOKIE_SECRET: str = _env("COOKIE_SECRET", "bpt-s3cr3t-k3y-ch4ng3-m3")

# ── Task / Status ──────────────────────────────────────────────────────────────
STATUS_OPTIONS = ["TODO", "DOING", "DONE"]

STATUS_LABELS = {
    "TODO": "YAPILACAK",
    "DOING": "DEVAM EDIYOR",
    "DONE": "TAMAMLANDI",
}

STATUS_LABELS_EN = {
    "TODO": "TO DO",
    "DOING": "IN PROGRESS",
    "DONE": "DONE",
}

STATUS_TRANSITIONS: dict[str, set[str]] = {
    "TODO": {"TODO", "DOING"},
    "DOING": {"TODO", "DOING", "DONE"},
    "DONE": {"DOING", "DONE"},
}

# ── Roles / Priorities ────────────────────────────────────────────────────────
ROLE_OPTIONS = ["Lider", "Uye", "Arastirma", "Yazilim", "DevOps", "Test", "Veri", "Sunum", "Diger"]
PRIORITY_OPTIONS = ["Dusuk", "Orta", "Yuksek"]

# ── Milestones ────────────────────────────────────────────────────────────────
MILESTONES: list[tuple[str, str]] = [
    ("M1", "Literatur taramasi"),
    ("M2", "Algoritma ve uygulama plani"),
    ("M3", "Uygulamayi boot etme"),
    ("M4", "Uygulamayi deneme ve sonuclari degerlendirme"),
    ("M5", "Hatalari duzeltme ve tekrar deneme"),
    ("M6", "Proje yazimi ve final rapor"),
]
MILESTONE_LABELS: dict[str, str] = {key: label for key, label in MILESTONES}
MILESTONE_ORDER: dict[str, int] = {key: idx for idx, (key, _) in enumerate(MILESTONES)}

# ── i18n ──────────────────────────────────────────────────────────────────────
LANGUAGE_STATE_KEY = "ui_language"
DEFAULT_LANGUAGE: str = _env("DEFAULT_LANGUAGE", "tr")
LANGUAGE_OPTIONS = {"Turkce": "tr", "English": "en"}
TRANSLATION_FILE = Path(__file__).with_name("translations_tr_en.json")

# ── AI / LLM Configuration ───────────────────────────────────────────────────
AI_PROVIDER: str = _env("AI_PROVIDER", "auto").lower()
GEMINI_API_KEY: str = _env("GEMINI_API_KEY", "") or _env("GOOGLE_API_KEY", "")
GEMINI_MODEL: str = _env("GEMINI_MODEL", "gemini-3.8-flash")
OLLAMA_BASE_URL: str = _env("OLLAMA_BASE_URL", _env("OLLAMA_BASE", "http://localhost:11434"))
OLLAMA_MODEL: str = _env("OLLAMA_MODEL", _env("DEFAULT_MODEL", "llama3.2:3b"))
GROQ_API_KEY: str = _env("GROQ_API_KEY", "")
GROQ_MODEL: str = _env("GROQ_MODEL", "llama-3.3-70b-versatile")
OPENAI_API_KEY: str = _env("OPENAI_API_KEY", "")
OPENAI_MODEL: str = _env("OPENAI_MODEL", "gpt-4o-mini")


def get_ai_secret(key: str, default: str = "") -> str:
    """Safely fetch a secret from env, or from st.secrets if running in Streamlit."""
    val = os.environ.get(key, "").strip()
    if val:
        return val
    try:
        import streamlit as st
        if hasattr(st, "secrets") and key in st.secrets:
            return str(st.secrets[key]).strip()
    except Exception:
        pass
    return default

