"""
conftest.py - Pytest fixtures for Capstone Project Tracking System.
"""
from __future__ import annotations

import sqlite3
from collections.abc import Generator

import pandas as pd
import pytest

import security
from db import _init_db
from models import (
    bootstrap_defaults,
    initialize_all_projects,
    sync_auth_users,
    upsert_students,
)


@pytest.fixture(autouse=True)
def clean_security_state() -> Generator[None, None, None]:
    """Ensure _login_attempts dictionary in security.py is reset before/after every test."""
    security._login_attempts.clear()
    yield
    security._login_attempts.clear()


@pytest.fixture
def db_conn() -> Generator[sqlite3.Connection, None, None]:
    """Provide an isolated in-memory SQLite database initialized with the latest schema."""
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _init_db(conn)
    yield conn
    conn.close()


@pytest.fixture
def sample_roster_df() -> pd.DataFrame:
    """Provide a standardized mock roster DataFrame representing student project teams."""
    data = [
        {
            "row_no": 1,
            "student_no": "2021001",
            "student_name": "Ahmet Yilmaz",
            "project_name": "Autonomous Drone Fleet",
            "advisor_name": "Dr. UFUK ASIL",
            "program": "Software Engineering",
        },
        {
            "row_no": 2,
            "student_no": "2021002",
            "student_name": "Ayse Demir",
            "project_name": "Autonomous Drone Fleet",
            "advisor_name": "Dr. UFUK ASIL",
            "program": "Software Engineering",
        },
        {
            "row_no": 3,
            "student_no": "2021003",
            "student_name": "Can Kaya",
            "project_name": "Smart Campus IoT",
            "advisor_name": "Dr. UFUK ASIL",
            "program": "Computer Engineering",
        },
    ]
    return pd.DataFrame(data)


@pytest.fixture
def seeded_db(db_conn: sqlite3.Connection, sample_roster_df: pd.DataFrame) -> sqlite3.Connection:
    """Provide an in-memory database pre-populated with roster, auth accounts, and milestone tasks."""
    upsert_students(db_conn, sample_roster_df)
    sync_auth_users(db_conn)
    bootstrap_defaults(db_conn, sample_roster_df)
    initialize_all_projects(db_conn, sample_roster_df)
    return db_conn
