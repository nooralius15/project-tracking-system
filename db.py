"""
db.py
SQLite connection management, schema initialisation, and low-level query helpers.
"""
from __future__ import annotations

import sqlite3
import threading
from datetime import date, datetime
from typing import Optional

import pandas as pd
import streamlit as st

from constants import DEFAULT_ADVISOR
from utils import now_ts

# ── Thread lock for write operations (re-entrant to prevent self-deadlocks) ───
_db_lock = threading.RLock()


# ── Connection factory ─────────────────────────────────────────────────────────

@st.cache_resource(show_spinner=False)
def _make_conn(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 30000;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA cache_size = -64000;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    conn.execute("PRAGMA wal_autocheckpoint = 1000;")
    _init_db(conn)
    return conn


def get_conn(db_path: str) -> sqlite3.Connection:
    conn = _make_conn(db_path)
    # Verify the cached connection is still alive after hot-reloads
    try:
        conn.execute("SELECT 1")
    except (sqlite3.InterfaceError, sqlite3.ProgrammingError):
        _make_conn.clear()
        conn = _make_conn(db_path)
    return conn


# ── Parameter normalisation ────────────────────────────────────────────────────

def to_sql_param(value: object) -> object:
    """Convert any Python value to a type that sqlite3 can accept."""
    if value is None:
        return None
    if isinstance(value, (str, int, float, bytes)):
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    try:
        if pd.isna(value):  # type: ignore[arg-type]
            return None
    except Exception:
        pass
    if hasattr(value, "item"):
        try:
            item_value = value.item()
            if isinstance(item_value, (str, int, float, bytes)) or item_value is None:
                return item_value
            return str(item_value)
        except Exception:
            pass
    return str(value)


# ── Query helpers ──────────────────────────────────────────────────────────────

def fetch_df(conn: sqlite3.Connection, query: str, params: tuple = ()) -> pd.DataFrame:
    """Run a SELECT and return a DataFrame. Falls back to cursor if read_sql fails."""
    safe_params = tuple(to_sql_param(p) for p in (params or ()))
    try:
        return pd.read_sql_query(query, conn, params=safe_params)
    except Exception:
        cursor = conn.execute(query, safe_params)
        rows = cursor.fetchall()
        columns = [col[0] for col in cursor.description] if cursor.description else []
        return pd.DataFrame(rows, columns=columns)


def db_lock() -> threading.RLock:
    """Expose the module-level re-entrant lock for use by writers in models.py."""
    return _db_lock


# ── Schema ────────────────────────────────────────────────────────────────────

def _ensure_students_schema(conn: sqlite3.Connection) -> None:
    info = conn.execute("PRAGMA table_info(students)").fetchall()
    if not info:
        return
    pk_cols = [row["name"] for row in info if int(row["pk"]) == 1]
    if pk_cols == ["row_no"]:
        return
    conn.executescript(
        """
        ALTER TABLE students RENAME TO students_old;
        CREATE TABLE students (
            row_no INTEGER PRIMARY KEY,
            student_no TEXT NOT NULL,
            student_name TEXT NOT NULL,
            project_name TEXT NOT NULL,
            advisor_name TEXT NOT NULL,
            program TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO students (
            row_no, student_no, student_name, project_name, advisor_name, program, created_at, updated_at
        )
        SELECT
            CAST(COALESCE(row_no, rowid) AS INTEGER),
            COALESCE(student_no, ''),
            COALESCE(student_name, ''),
            COALESCE(project_name, ''),
            COALESCE(advisor_name, ?),
            COALESCE(program, ''),
            COALESCE(created_at, ?),
            COALESCE(updated_at, ?)
        FROM students_old
        """,
        (DEFAULT_ADVISOR, now_ts(), now_ts()),
    )
    conn.execute("DROP TABLE students_old")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_advisor ON students(advisor_name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_students_project ON students(project_name)")
    conn.commit()


def _init_db(conn: sqlite3.Connection) -> None:
    with _db_lock:
        conn.executescript(
            """
        CREATE TABLE IF NOT EXISTS students (
            row_no INTEGER PRIMARY KEY,
            student_no TEXT NOT NULL,
            student_name TEXT NOT NULL,
            project_name TEXT NOT NULL,
            advisor_name TEXT NOT NULL,
            program TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_users (
            user_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('student', 'advisor')),
            display_name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            force_password_change INTEGER NOT NULL DEFAULT 1,
            is_active INTEGER NOT NULL DEFAULT 1,
            activation_token TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, role)
        );
        CREATE TABLE IF NOT EXISTS leaders (
            project_name TEXT PRIMARY KEY,
            student_no TEXT NOT NULL,
            assigned_by TEXT NOT NULL,
            assigned_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS member_roles (
            project_name TEXT NOT NULL,
            student_no TEXT NOT NULL,
            role TEXT NOT NULL,
            responsibility TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(project_name, student_no)
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            milestone_key TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            assignee_student_no TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'TODO',
            priority TEXT NOT NULL DEFAULT 'Orta',
            deadline TEXT,
            dependency_task_id INTEGER,
            evidence_required TEXT,
            evidence_link TEXT,
            evidence_file TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS weekly_updates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            student_no TEXT NOT NULL,
            task_id INTEGER,
            week_start TEXT NOT NULL,
            completed TEXT,
            blockers TEXT,
            next_step TEXT,
            evidence_link TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS advisor_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_name TEXT NOT NULL,
            advisor_name TEXT NOT NULL,
            feedback TEXT NOT NULL,
            action_item TEXT,
            revision_required INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS task_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL,
            project_name TEXT NOT NULL,
            author_id TEXT NOT NULL,
            author_role TEXT NOT NULL CHECK(author_role IN ('student', 'advisor', 'leader')),
            comment TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_students_advisor ON students(advisor_name);
        CREATE INDEX IF NOT EXISTS idx_students_project ON students(project_name);
        CREATE INDEX IF NOT EXISTS idx_auth_role ON auth_users(role);
        CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_name);
        CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_student_no);
        CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(project_name, milestone_key);
        CREATE INDEX IF NOT EXISTS idx_updates_project ON weekly_updates(project_name);
        CREATE INDEX IF NOT EXISTS idx_updates_student ON weekly_updates(student_no);
        CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_project ON advisor_feedback(project_name);
        CREATE INDEX IF NOT EXISTS idx_member_roles_student ON member_roles(student_no);
        """
        )
        conn.commit()
        _ensure_students_schema(conn)
        # Migrate: add evidence_file column if it doesn't exist yet
        try:
            conn.execute("ALTER TABLE tasks ADD COLUMN evidence_file TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass
        # Migrate: add last_login_at column for security tracking
        try:
            conn.execute("ALTER TABLE auth_users ADD COLUMN last_login_at TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass
        # Migrate: add activation_token column for first-time secure onboarding
        try:
            conn.execute("ALTER TABLE auth_users ADD COLUMN activation_token TEXT DEFAULT ''")
            conn.commit()
        except Exception:
            pass

