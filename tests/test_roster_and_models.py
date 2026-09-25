"""
test_roster_and_models.py - Unit and integration tests for roster CSV parsing,
user account lifecycle, project administration, and analytics metrics.
Covers:
- Header and identity string normalization (Turkish character transliteration).
- CSV roster parsing with Turkish and English column variations and edge cases.
- User synchronization, authentication, password change, and password reset.
- Team leadership assignment and role mappings.
- Project analytics (completion rate, overdue task detection, member progress).
"""
from __future__ import annotations

import sqlite3

import pandas as pd
import pytest

from constants import DEFAULT_PASSWORD
from models import (
    _parse_roster_df,
    authenticate_user,
    completion_percent,
    get_leader,
    load_roster_from_upload,
    member_progress,
    overdue_count,
    reset_password_to_default,
    set_leader,
    student_count,
    sync_auth_users,
    update_password,
    upsert_role,
    upsert_students,
)
from utils import is_admin_advisor, normalize_header, normalize_identity

# ═════════════════════════════════════════════════════════════════════════════
# Normalization & Auth Helpers
# ═════════════════════════════════════════════════════════════════════════════

class TestNormalization:
    def test_normalize_header_turkish_characters(self):
        raw = "  Öğrenci Adı_ÇŞĞIÖÜ - Test  "
        normalized = normalize_header(raw)
        assert "ö" not in normalized
        assert "ğ" not in normalized
        assert "ı" not in normalized
        assert "ş" not in normalized
        assert "ç" not in normalized
        assert "ü" not in normalized
        assert " " not in normalized
        assert "-" not in normalized
        assert normalized == "ogrenciadi_csgioutest"

    def test_normalize_identity(self):
        assert normalize_identity("Dr. UFUK ASIL") == "drufukasil"
        assert normalize_identity("  2021-001 / A  ") == "2021001a"

    def test_is_admin_advisor(self):
        assert is_admin_advisor("Dr. UFUK ASIL") is True
        assert is_admin_advisor("drufukasil") is True
        assert is_admin_advisor("drufukasl") is True
        assert is_admin_advisor("Dr. Other Advisor") is False


# ═════════════════════════════════════════════════════════════════════════════
# CSV Roster Parsing
# ═════════════════════════════════════════════════════════════════════════════

class TestRosterParsing:
    def test_parse_roster_turkish_headers(self):
        df_raw = pd.DataFrame({
            "Sıra": ["1", "2"],
            "Öğrenci No": ["???2021001", "2021002"],
            "Öğrenci Adı": ["Ahmet Yılmaz", "Ayşe Demir"],
            "Proje Adı": ["Drone Takip", "Drone Takip"],
            "Danışman Adı": ["Dr. Ufuk Asil", "Dr. Ufuk Asil"],
            "Program": ["Yazılım Müh.", "Yazılım Müh."],
        })
        parsed = _parse_roster_df(df_raw)
        assert list(parsed.columns) == [
            "row_no",
            "student_no",
            "student_name",
            "project_name",
            "advisor_name",
            "program",
        ]
        # Stripped leading ? marks from student numbers
        assert parsed.iloc[0]["student_no"] == "2021001"
        assert parsed.iloc[1]["student_no"] == "2021002"
        assert parsed.iloc[0]["row_no"] == 1
        assert parsed.iloc[1]["row_no"] == 2

    def test_parse_roster_english_headers(self):
        df_raw = pd.DataFrame({
            "Index": ["10"],
            "Student No": ["2022001"],
            "Student Name": ["John Doe"],
            "Project Name": ["AI Vision"],
            "Advisor Name": ["Dr. Ufuk Asil"],
            "Program": ["Computer Science"],
        })
        parsed = _parse_roster_df(df_raw)
        assert len(parsed) == 1
        assert parsed.iloc[0]["student_no"] == "2022001"
        assert parsed.iloc[0]["project_name"] == "AI Vision"
        assert parsed.iloc[0]["row_no"] == 10

    def test_parse_roster_filters_empty_records(self):
        df_raw = pd.DataFrame({
            "Sıra": ["1", "2", "3"],
            "Öğrenci No": ["2021001", "", "2021003"],
            "Öğrenci Adı": ["Ahmet", "Empty Student", "Can"],
            "Proje Adı": ["Project A", "Project B", ""],  # empty project name
            "Danışman Adı": ["Adv 1", "Adv 2", "Adv 3"],
            "Program": ["Prog 1", "Prog 2", "Prog 3"],
        })
        parsed = _parse_roster_df(df_raw)
        assert len(parsed) == 1
        assert parsed.iloc[0]["student_no"] == "2021001"

    def test_parse_roster_insufficient_columns_raises_error(self):
        df_raw = pd.DataFrame({
            "Col1": ["A"],
            "Col2": ["B"],
            "Col3": ["C"],
        })
        with pytest.raises(ValueError, match="CSV kolonlari yetersiz"):
            _parse_roster_df(df_raw)

    def test_load_roster_from_upload(self):
        csv_bytes = (
            "Sıra;Öğrenci No;Öğrenci Adı;Proje Adı;Danışman Adı;Program\n"
            "1;2021050;Burak Yılmaz;Robotics;Dr. UFUK ASIL;Software\n"
        ).encode("utf-8-sig")

        class MockUploadedFile:
            def getvalue(self):
                return csv_bytes

        df = load_roster_from_upload(MockUploadedFile())
        assert len(df) == 1
        assert df.iloc[0]["student_no"] == "2021050"
        assert df.iloc[0]["student_name"] == "Burak Yılmaz"


# ═════════════════════════════════════════════════════════════════════════════
# User Sync, Authentication & Password Management
# ═════════════════════════════════════════════════════════════════════════════

class TestAuthAndUsers:
    def test_sync_auth_users_and_authenticate(self, db_conn: sqlite3.Connection, sample_roster_df: pd.DataFrame):
        upsert_students(db_conn, sample_roster_df)
        assert student_count(db_conn) == 3
        sync_auth_users(db_conn)

        # 1. Student authentication with default password
        user = authenticate_user(db_conn, "2021001", "student", DEFAULT_PASSWORD)
        assert user is not None
        assert user["user_id"] == "2021001"
        assert user["role"] == "student"
        assert user["display_name"] == "Ahmet Yilmaz"
        assert user["force_password_change"] is True

        # 2. Advisor authentication (case insensitive)
        advisor = authenticate_user(db_conn, "dr. ufuk asil", "advisor", DEFAULT_PASSWORD)
        assert advisor is not None
        assert advisor["role"] == "advisor"

        # 3. Wrong password fails
        bad_auth = authenticate_user(db_conn, "2021001", "student", "WrongPass123")
        assert bad_auth is None

    def test_update_and_reset_password(self, seeded_db: sqlite3.Connection):
        user_id = "2021001"
        role = "student"
        new_pass = "MyNewSecurePassword999!"

        # Update password
        update_password(seeded_db, user_id, role, new_pass)

        # Old password no longer works
        assert authenticate_user(seeded_db, user_id, role, DEFAULT_PASSWORD) is None

        # New password works and force_password_change is now False
        user = authenticate_user(seeded_db, user_id, role, new_pass)
        assert user is not None
        assert user["force_password_change"] is False

        # Reset to default
        reset_ok = reset_password_to_default(seeded_db, user_id, role)
        assert reset_ok is True

        # Default password works again and force_password_change is True
        user_reset = authenticate_user(seeded_db, user_id, role, DEFAULT_PASSWORD)
        assert user_reset is not None
        assert user_reset["force_password_change"] is True

    def test_inactivated_students_cannot_authenticate(
        self, db_conn: sqlite3.Connection, sample_roster_df: pd.DataFrame
    ):
        upsert_students(db_conn, sample_roster_df)
        sync_auth_users(db_conn)
        assert authenticate_user(db_conn, "2021001", "student", DEFAULT_PASSWORD) is not None

        # Upsert roster omitting student 2021001
        reduced_roster = sample_roster_df[sample_roster_df["student_no"] != "2021001"]
        upsert_students(db_conn, reduced_roster)
        sync_auth_users(db_conn)

        # 2021001 should now be inactive and denied authentication
        auth_result = authenticate_user(db_conn, "2021001", "student", DEFAULT_PASSWORD)
        assert auth_result is None


# ═════════════════════════════════════════════════════════════════════════════
# Project Teams & Leadership
# ═════════════════════════════════════════════════════════════════════════════

class TestProjectLeadership:
    def test_leadership_bootstrap_and_update(self, seeded_db: sqlite3.Connection):
        project = "Autonomous Drone Fleet"
        # First student in row_no order is 2021001
        assert get_leader(seeded_db, project) == "2021001"

        # Reassign leader to 2021002
        set_leader(seeded_db, project, "2021002", assigned_by="Dr. UFUK ASIL")
        assert get_leader(seeded_db, project) == "2021002"

        # Update member role
        upsert_role(seeded_db, project, "2021002", "Lider", "Yeniden atanan grup lideri.")
        roles_df = pd.read_sql_query(
            "SELECT role, responsibility FROM member_roles WHERE project_name = ? AND student_no = ?",
            seeded_db,
            params=(project, "2021002"),
        )
        assert len(roles_df) == 1
        assert roles_df.iloc[0]["role"] == "Lider"
        assert roles_df.iloc[0]["responsibility"] == "Yeniden atanan grup lideri."


# ═════════════════════════════════════════════════════════════════════════════
# Metrics Calculations
# ═════════════════════════════════════════════════════════════════════════════

class TestProjectMetrics:
    def test_completion_percent(self):
        assert completion_percent(pd.DataFrame()) == 0.0

        tasks_df = pd.DataFrame([
            {"status": "DONE"},
            {"status": "DOING"},
            {"status": "TODO"},
            {"status": "DONE"},
        ])
        # 2 out of 4 = 50.0%
        assert completion_percent(tasks_df) == 50.0

    def test_overdue_count(self):
        assert overdue_count(pd.DataFrame()) == 0

        yesterday = (pd.Timestamp.today() - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
        tomorrow = (pd.Timestamp.today() + pd.Timedelta(days=1)).strftime("%Y-%m-%d")

        tasks_df = pd.DataFrame([
            {"deadline": yesterday, "status": "TODO"},   # Overdue
            {"deadline": yesterday, "status": "DOING"},  # Overdue
            {"deadline": yesterday, "status": "DONE"},   # Completed, not overdue
            {"deadline": tomorrow, "status": "TODO"},    # Future, not overdue
            {"deadline": None, "status": "TODO"},        # No deadline, not overdue
        ])
        assert overdue_count(tasks_df) == 2

    def test_member_progress(self):
        members_df = pd.DataFrame([
            {"row_no": 1, "student_no": "2021001", "student_name": "Ahmet"},
            {"row_no": 2, "student_no": "2021002", "student_name": "Ayse"},
        ])
        tasks_df = pd.DataFrame([
            {"assignee_student_no": "2021001", "status": "DONE"},
            {"assignee_student_no": "2021001", "status": "DOING"},
            {"assignee_student_no": "2021002", "status": "TODO"},
        ])

        progress_df = member_progress(members_df, tasks_df)
        assert len(progress_df) == 2
        ahmet_row = progress_df[progress_df["Ogrenci No"] == "2021001"].iloc[0]
        assert ahmet_row["Atanan Gorev"] == 2
        assert ahmet_row["Tamamlanan"] == 1
        assert ahmet_row["Ilerleme %"] == 50.0

        ayse_row = progress_df[progress_df["Ogrenci No"] == "2021002"].iloc[0]
        assert ayse_row["Atanan Gorev"] == 1
        assert ayse_row["Tamamlanan"] == 0
        assert ayse_row["Ilerleme %"] == 0.0
