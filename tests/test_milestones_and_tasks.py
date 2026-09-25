"""
test_milestones_and_tasks.py - Unit and integration tests for milestone state machine and task logic.
Covers:
- Finite State Machine transitions (STATUS_TRANSITIONS) and allowed choices.
- Sequential milestone progression constraints (M1 -> M2 -> ... -> M6).
- Evidence requirements (link or file) for task completion (DONE).
- Task comment threading and timeline retrieval.
"""
from __future__ import annotations

import sqlite3

from constants import (
    STATUS_LABELS,
    STATUS_LABELS_EN,
    STATUS_OPTIONS,
    STATUS_TRANSITIONS,
)
from models import (
    add_task_comment,
    fetch_task_comments,
    fetch_tasks,
    update_task,
)
from utils import allowed_status_options, status_tr

# ═════════════════════════════════════════════════════════════════════════════
# Status Transitions & Options
# ═════════════════════════════════════════════════════════════════════════════

class TestStatusTransitions:
    def test_status_transitions_rules(self):
        assert STATUS_TRANSITIONS["TODO"] == {"TODO", "DOING"}
        assert STATUS_TRANSITIONS["DOING"] == {"TODO", "DOING", "DONE"}
        assert STATUS_TRANSITIONS["DONE"] == {"DOING", "DONE"}

    def test_allowed_status_options_standard(self):
        assert allowed_status_options("TODO") == ["TODO", "DOING"]
        assert allowed_status_options("DOING") == ["TODO", "DOING", "DONE"]
        assert allowed_status_options("DONE") == ["DOING", "DONE"]

    def test_allowed_status_options_fallback_on_invalid_status(self):
        # Fallback to full STATUS_OPTIONS when DB has an irregular value
        assert allowed_status_options("CORRUPTED_STATUS") == list(STATUS_OPTIONS)

    def test_status_tr_default_turkish(self, monkeypatch):
        import i18n
        monkeypatch.setattr(i18n, "is_english_ui", lambda: False)

        for status, tr_label in STATUS_LABELS.items():
            assert status_tr(status) == tr_label

        # Unknown fallback returns original
        assert status_tr("NON_EXISTENT") == "NON_EXISTENT"

    def test_status_tr_english(self, monkeypatch):
        import i18n
        monkeypatch.setattr(i18n, "is_english_ui", lambda: True)

        for status, en_label in STATUS_LABELS_EN.items():
            assert status_tr(status) == en_label


# ═════════════════════════════════════════════════════════════════════════════
# Milestone State Machine & Task Update Validation
# ═════════════════════════════════════════════════════════════════════════════

class TestMilestoneTaskEnforcement:
    def test_update_nonexistent_task(self, db_conn: sqlite3.Connection):
        success, msg = update_task(db_conn, task_id=99999, status="DOING", evidence_link="")
        assert success is False
        assert "Gorev bulunamadi" in msg

    def test_illegal_status_jump_rejected(self, seeded_db: sqlite3.Connection):
        # Initial task for Ahmet Yilmaz (M1) is TODO. Trying to jump straight to DONE without DOING
        # Note: STATUS_TRANSITIONS["TODO"] does NOT permit "DONE" directly
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        m1_task = tasks[tasks["assignee_student_no"] == "2021001"].iloc[0]
        task_id = int(m1_task["id"])

        success, msg = update_task(
            seeded_db,
            task_id=task_id,
            status="DONE",
            evidence_link="https://github.com/sample/repo",
        )
        assert success is False
        assert "Durum gecisi gecersiz" in msg

    def test_evidence_required_for_done_transition(self, seeded_db: sqlite3.Connection):
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        m1_task = tasks[tasks["assignee_student_no"] == "2021001"].iloc[0]
        task_id = int(m1_task["id"])

        # 1. Valid transition TODO -> DOING
        success, _ = update_task(seeded_db, task_id=task_id, status="DOING", evidence_link="")
        assert success is True

        # 2. Try transitioning DOING -> DONE without any evidence link or file
        success, msg = update_task(seeded_db, task_id=task_id, status="DONE", evidence_link="   ")
        assert success is False
        assert "kanit" in msg.lower()

        # 3. Transition DOING -> DONE with link succeeds
        success, _ = update_task(
            seeded_db,
            task_id=task_id,
            status="DONE",
            evidence_link="https://github.com/project/m1_evidence",
        )
        assert success is True

    def test_evidence_file_satisfies_done_transition(self, seeded_db: sqlite3.Connection):
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        m1_task = tasks[tasks["assignee_student_no"] == "2021001"].iloc[0]
        task_id = int(m1_task["id"])

        update_task(seeded_db, task_id=task_id, status="DOING", evidence_link="")
        success, msg = update_task(
            seeded_db,
            task_id=task_id,
            status="DONE",
            evidence_link="",
            evidence_file="uploads/report_m1.pdf",
        )
        assert success is True
        assert msg == "ok"

    def test_sequential_milestone_progression_blocked_if_previous_incomplete(
        self, seeded_db: sqlite3.Connection
    ):
        student_no = "2021001"
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        student_tasks = tasks[tasks["assignee_student_no"] == student_no]

        m1_task = student_tasks[student_tasks["milestone_key"] == "M1"].iloc[0]
        m2_task = student_tasks[student_tasks["milestone_key"] == "M2"].iloc[0]

        # M1 is currently TODO. Attempting to start M2 (TODO -> DOING) must be blocked
        success, msg = update_task(
            seeded_db,
            task_id=int(m2_task["id"]),
            status="DOING",
            evidence_link="",
        )
        assert success is False
        assert "Onceki milestone tamamlanmadan" in msg

        # Move M1 to DOING (still not DONE)
        update_task(seeded_db, task_id=int(m1_task["id"]), status="DOING", evidence_link="")

        # Attempting M2 should still be blocked because M1 is DOING, not DONE
        success, msg = update_task(
            seeded_db,
            task_id=int(m2_task["id"]),
            status="DOING",
            evidence_link="",
        )
        assert success is False
        assert "Onceki milestone tamamlanmadan" in msg

        # Finish M1 properly
        success_m1, _ = update_task(
            seeded_db,
            task_id=int(m1_task["id"]),
            status="DONE",
            evidence_link="https://evidence.org/m1",
        )
        assert success_m1 is True

        # Now M2 can advance to DOING!
        success_m2, msg_m2 = update_task(
            seeded_db,
            task_id=int(m2_task["id"]),
            status="DOING",
            evidence_link="",
        )
        assert success_m2 is True
        assert msg_m2 == "ok"

    def test_skip_milestone_check_allows_bypass(self, seeded_db: sqlite3.Connection):
        student_no = "2021001"
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        m3_task = tasks[
            (tasks["assignee_student_no"] == student_no) & (tasks["milestone_key"] == "M3")
        ].iloc[0]

        # With skip_milestone_check=True (advisor override), M3 can transition directly to DOING
        success, msg = update_task(
            seeded_db,
            task_id=int(m3_task["id"]),
            status="DOING",
            evidence_link="",
            skip_milestone_check=True,
        )
        assert success is True
        assert msg == "ok"

    def test_revert_from_done_to_doing(self, seeded_db: sqlite3.Connection):
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        m1_task = tasks[tasks["assignee_student_no"] == "2021001"].iloc[0]
        task_id = int(m1_task["id"])

        update_task(seeded_db, task_id=task_id, status="DOING", evidence_link="")
        update_task(seeded_db, task_id=task_id, status="DONE", evidence_link="https://evidence.org")

        # Moving from DONE back to DOING is permitted in STATUS_TRANSITIONS
        success, msg = update_task(seeded_db, task_id=task_id, status="DOING", evidence_link="")
        assert success is True
        assert msg == "ok"


# ═════════════════════════════════════════════════════════════════════════════
# Task Comments
# ═════════════════════════════════════════════════════════════════════════════

class TestTaskComments:
    def test_add_and_fetch_task_comments(self, seeded_db: sqlite3.Connection):
        tasks = fetch_tasks(seeded_db, "Autonomous Drone Fleet")
        task_id = int(tasks.iloc[0]["id"])

        add_task_comment(
            seeded_db,
            task_id=task_id,
            project_name="Autonomous Drone Fleet",
            author_id="2021001",
            author_role="student",
            comment="Started preliminary literature search.",
        )
        add_task_comment(
            seeded_db,
            task_id=task_id,
            project_name="Autonomous Drone Fleet",
            author_id="Dr. UFUK ASIL",
            author_role="advisor",
            comment="Please ensure IEEE citations are included.",
        )

        comments_df = fetch_task_comments(seeded_db, task_id)
        assert len(comments_df) == 2
        assert comments_df.iloc[0]["author_id"] == "2021001"
        assert comments_df.iloc[0]["comment"] == "Started preliminary literature search."
        assert comments_df.iloc[1]["author_id"] == "Dr. UFUK ASIL"
        assert comments_df.iloc[1]["author_role"] == "advisor"
