"""
tests/test_api.py
Comprehensive integration tests for FastAPI REST API endpoints.
Tests authentication, authorization, project listings, task mutations, and IDOR prevention.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app
from constants import DEFAULT_PASSWORD


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_swagger_docs(client):
    response = client.get("/docs")
    assert response.status_code == 200


def test_frontend_static_serving(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    assert "<div id=\"root\">" in response.text or "vite" in response.text or "index" in response.text


def test_list_advisors(client):
    response = client.get("/api/auth/advisors")
    assert response.status_code == 200
    advisors = response.json()
    assert isinstance(advisors, list)
    assert len(advisors) > 0
    assert any("UFUK ASIL" in a["display_name"] for a in advisors)


def test_advisor_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"user_id": "Dr. UFUK ASIL", "role": "advisor", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["role"] == "advisor"
    assert data["user"]["is_admin"] is True


def test_student_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"user_id": "210208001", "role": "student", "password": "password123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"


def test_login_invalid_password_fails(client):
    response = client.post(
        "/api/auth/login",
        json={"user_id": "210208001", "role": "student", "password": "wrong_password_xyz"},
    )
    assert response.status_code == 401


def test_get_me_protected(client):
    # 1. Unauthenticated fails
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401

    # 2. Authenticated succeeds
    login_resp = client.post(
        "/api/auth/login",
        json={"user_id": "Dr. UFUK ASIL", "role": "advisor", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_resp = client.get("/api/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["user_id"] == "Dr. UFUK ASIL"


def test_advisor_list_projects(client):
    login_resp = client.post(
        "/api/auth/login",
        json={"user_id": "Dr. UFUK ASIL", "role": "advisor", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/projects", headers=headers)
    assert resp.status_code == 200
    projects = resp.json()
    assert isinstance(projects, list)
    assert len(projects) > 0
    assert any("Autonomous Drone Delivery System" in p["name"] for p in projects)


def test_project_detail(client):
    login_resp = client.post(
        "/api/auth/login",
        json={"user_id": "210208001", "role": "student", "password": "password123"},
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get("/api/projects/Autonomous Drone Delivery System", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Autonomous Drone Delivery System"
    assert len(data["members"]) > 0


def test_tasks_flow_and_idor_prevention(client):
    # Login as leader (210208001, project: Autonomous Drone Delivery System)
    leader_login = client.post(
        "/api/auth/login",
        json={"user_id": "210208001", "role": "student", "password": "password123"},
    )
    leader_token = leader_login.json()["access_token"]
    leader_headers = {"Authorization": f"Bearer {leader_token}"}

    # Fetch tasks for this project
    tasks_resp = client.get("/api/tasks?project_name=Autonomous Drone Delivery System", headers=leader_headers)
    assert tasks_resp.status_code == 200
    tasks = tasks_resp.json()
    assert len(tasks) > 0
    task_id = tasks[0]["id"]

    # Leader can update task with skip_milestone_check
    update_resp = client.patch(
        f"/api/tasks/{task_id}",
        json={"status": "DOING", "skip_milestone_check": True},
        headers=leader_headers,
    )
    assert update_resp.status_code == 200

    # Threaded comments
    comment_post = client.post(
        f"/api/tasks/{task_id}/comments",
        json={"comment": "FastAPI integration test comment"},
        headers=leader_headers,
    )
    assert comment_post.status_code == 200

    comments_get = client.get(f"/api/tasks/{task_id}/comments", headers=leader_headers)
    assert comments_get.status_code == 200
    assert any(c["comment"] == "FastAPI integration test comment" for c in comments_get.json())


# ═════════════════════════════════════════════════════════════════════════════
# Helper Functions for Expanded Tests
# ═════════════════════════════════════════════════════════════════════════════

def _get_auth_headers(client, user_id: str, role: str, password: str = "password123") -> dict:
    resp = client.post(
        "/api/auth/login",
        json={"user_id": user_id, "role": role, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {user_id} ({role}): {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ═════════════════════════════════════════════════════════════════════════════
# Expanded Test Suite: 401 & 403 Unauthorized Access Attempts
# ═════════════════════════════════════════════════════════════════════════════

def test_unauthorized_token_missing_and_invalid(client):
    import datetime
    from api.deps import create_access_token

    # 1. Missing Authorization header (401)
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/tasks").status_code == 401
    assert client.get("/api/weekly").status_code == 401

    # 2. Forged / malformed token (401)
    malformed_headers = {"Authorization": "Bearer forged.invalid.token"}
    assert client.get("/api/auth/me", headers=malformed_headers).status_code == 401
    assert client.get("/api/projects", headers=malformed_headers).status_code == 401

    # 3. Expired JWT token (401)
    expired_token = create_access_token(
        {"sub": "210208001", "role": "student"},
        expires_delta=datetime.timedelta(seconds=-60),
    )
    expired_headers = {"Authorization": f"Bearer {expired_token}"}
    assert client.get("/api/auth/me", headers=expired_headers).status_code == 401
    assert client.get("/api/projects", headers=expired_headers).status_code == 401


def test_forbidden_role_restrictions(client):
    student_headers = _get_auth_headers(client, "210208001", "student", "password123")

    # 1. Student attempting advisor-only leader assignment (403)
    resp_leader = client.post(
        "/api/projects/Autonomous Drone Delivery System/leader",
        json={"student_no": "210208002"},
        headers=student_headers,
    )
    assert resp_leader.status_code == 403

    # 2. Student attempting advisor-only formal feedback (403)
    resp_feedback = client.post(
        "/api/feedback",
        json={"project_name": "Autonomous Drone Delivery System", "feedback": "Student feedback"},
        headers=student_headers,
    )
    assert resp_feedback.status_code == 403

    # 3. Student attempting advisor-only AI diagnosis report (403)
    resp_ai = client.post(
        "/api/ai/advisor-report",
        json={"lang": "tr"},
        headers=student_headers,
    )
    assert resp_ai.status_code == 403


def test_idor_task_updates_and_comments(client):
    # Member in Autonomous Drone Delivery System (not the leader)
    member_headers = _get_auth_headers(client, "210208002", "student", "password123")
    # Student in a completely different project (Healthcare AI Diagnostic Assistant)
    other_student_headers = _get_auth_headers(client, "210208004", "student", "12345")

    # Task 37 belongs to 210208001 (leader)
    # Regular member 210208002 attempting to update leader's task -> 403
    idor_update = client.patch(
        "/api/tasks/37",
        json={"status": "DOING"},
        headers=member_headers,
    )
    assert idor_update.status_code == 403

    # Student from another project attempting to update task 37 -> 403
    cross_proj_update = client.patch(
        "/api/tasks/37",
        json={"status": "DOING"},
        headers=other_student_headers,
    )
    assert cross_proj_update.status_code == 403

    # Non-existent task update -> 404
    not_found_update = client.patch(
        "/api/tasks/999999",
        json={"status": "DOING"},
        headers=member_headers,
    )
    assert not_found_update.status_code == 404

    # Cross-project student viewing comments of task 43 (Drone project) -> 403
    cross_comments_get = client.get("/api/tasks/43/comments", headers=other_student_headers)
    assert cross_comments_get.status_code == 403

    # Cross-project student posting comment on task 43 -> 403
    cross_comment_post = client.post(
        "/api/tasks/43/comments",
        json={"comment": "Cross-project unauthorized comment"},
        headers=other_student_headers,
    )
    assert cross_comment_post.status_code == 403


def test_idor_cross_project_isolation(client):
    other_student_headers = _get_auth_headers(client, "210208004", "student", "12345")

    # 1. Accessing project detail of a project the student is not enrolled in -> 403
    detail_resp = client.get(
        "/api/projects/Autonomous Drone Delivery System",
        headers=other_student_headers,
    )
    assert detail_resp.status_code == 403

    # 2. Accessing task list of another project -> 403
    tasks_resp = client.get(
        "/api/tasks?project_name=Autonomous Drone Delivery System",
        headers=other_student_headers,
    )
    assert tasks_resp.status_code == 403

    # 3. Accessing feedback of another project -> 403
    feedback_resp = client.get(
        "/api/feedback?project_name=Autonomous Drone Delivery System",
        headers=other_student_headers,
    )
    assert feedback_resp.status_code == 403

    # 4. Submitting weekly progress for another project -> 403
    weekly_resp = client.post(
        "/api/weekly",
        json={
            "project_name": "Autonomous Drone Delivery System",
            "week_start": "2026-09-21",
            "completed": "Unauthorized update attempt",
        },
        headers=other_student_headers,
    )
    assert weekly_resp.status_code == 403


# ═════════════════════════════════════════════════════════════════════════════
# Expanded Test Suite: Milestone Sequential Gating
# ═════════════════════════════════════════════════════════════════════════════

def test_illegal_milestone_skipping_by_regular_student(client):
    member_headers = _get_auth_headers(client, "210208002", "student", "password123")

    # Task 44 is M2 for 210208002, while Task 43 (M1) is still TODO
    # Transitioning to DOING directly without completing M1 must fail with 400
    skip_attempt = client.patch(
        "/api/tasks/44",
        json={"status": "DOING", "skip_milestone_check": False},
        headers=member_headers,
    )
    assert skip_attempt.status_code == 400
    assert "milestone" in skip_attempt.json()["detail"].lower()

    # Regular student attempting to bypass via skip_milestone_check=True must still fail with 400
    bypass_attempt = client.patch(
        "/api/tasks/44",
        json={"status": "DOING", "skip_milestone_check": True},
        headers=member_headers,
    )
    assert bypass_attempt.status_code == 400
    assert "milestone" in bypass_attempt.json()["detail"].lower()


# ═════════════════════════════════════════════════════════════════════════════
# Expanded Test Suite: Evidence Upload Validation
# ═════════════════════════════════════════════════════════════════════════════

def test_evidence_upload_validation(client):
    from pathlib import Path
    member_headers = _get_auth_headers(client, "210208002", "student", "password123")
    other_student_headers = _get_auth_headers(client, "210208004", "student", "12345")

    # 1. Disallowed file extensions (.exe, .sh, .py) -> 400
    files_exe = {"file": ("exploit.exe", b"MZexecutabledata", "application/x-msdownload")}
    resp_exe = client.post("/api/tasks/43/evidence", files=files_exe, headers=member_headers)
    assert resp_exe.status_code == 400
    assert "Desteklenmeyen dosya türü" in resp_exe.json()["detail"]

    files_sh = {"file": ("script.sh", b"#!/bin/bash\necho hi", "application/x-sh")}
    resp_sh = client.post("/api/tasks/43/evidence", files=files_sh, headers=member_headers)
    assert resp_sh.status_code == 400

    files_py = {"file": ("backdoor.py", b"import os; os.system('ls')", "text/x-python")}
    resp_py = client.post("/api/tasks/43/evidence", files=files_py, headers=member_headers)
    assert resp_py.status_code == 400

    # 2. Empty file (0 bytes) -> 400
    files_empty = {"file": ("empty.pdf", b"", "application/pdf")}
    resp_empty = client.post("/api/tasks/43/evidence", files=files_empty, headers=member_headers)
    assert resp_empty.status_code == 400
    assert "boş olamaz" in resp_empty.json()["detail"].lower()

    # 3. Disallowed MIME type with allowed extension -> 400
    files_mime = {"file": ("fake.pdf", b"%PDF-mock", "application/x-shockwave-flash")}
    resp_mime = client.post("/api/tasks/43/evidence", files=files_mime, headers=member_headers)
    assert resp_mime.status_code == 400
    assert "MIME" in resp_mime.json()["detail"]

    # 4. IDOR check: student from other project uploading evidence -> 403
    files_valid = {"file": ("report.pdf", b"%PDF-1.4 test report content", "application/pdf")}
    resp_idor = client.post("/api/tasks/43/evidence", files=files_valid, headers=other_student_headers)
    assert resp_idor.status_code == 403

    # 5. Nonexistent task ID -> 404
    resp_not_found = client.post("/api/tasks/999999/evidence", files=files_valid, headers=member_headers)
    assert resp_not_found.status_code == 404

    # 6. Valid PDF upload -> 200
    files_pdf = {"file": ("verified_report.pdf", b"%PDF-1.4 genuine academic report", "application/pdf")}
    resp_valid_pdf = client.post("/api/tasks/43/evidence", files=files_pdf, headers=member_headers)
    assert resp_valid_pdf.status_code == 200
    data_pdf = resp_valid_pdf.json()
    assert "file_path" in data_pdf
    pdf_path = Path(data_pdf["file_path"])
    assert pdf_path.exists()
    pdf_path.unlink(missing_ok=True)

    # 7. Valid PNG upload -> 200
    files_png = {"file": ("test_diagram.png", b"\x89PNG\r\n\x1a\n test png data", "image/png")}
    resp_valid_png = client.post("/api/tasks/43/evidence", files=files_png, headers=member_headers)
    assert resp_valid_png.status_code == 200
    png_path = Path(resp_valid_png.json()["file_path"])
    assert png_path.exists()
    png_path.unlink(missing_ok=True)


# ═════════════════════════════════════════════════════════════════════════════
# Expanded Test Suite: Login Rate Limiting
# ═════════════════════════════════════════════════════════════════════════════

def test_login_rate_limiting(client):
    import uuid
    from security import clear_login_attempts

    test_user = f"ratelimit_api_user_{uuid.uuid4().hex[:6]}"
    clear_login_attempts(test_user)

    try:
        # First 5 attempts must return 401 Unauthorized
        for _ in range(5):
            resp = client.post(
                "/api/auth/login",
                json={"user_id": test_user, "role": "student", "password": "wrong_password_xyz"},
            )
            assert resp.status_code == 401

        # 6th attempt must be locked out with 429 Too Many Requests
        locked_resp = client.post(
            "/api/auth/login",
            json={"user_id": test_user, "role": "student", "password": "wrong_password_xyz"},
        )
        assert locked_resp.status_code == 429
        assert "Çok fazla başarısız" in locked_resp.json()["detail"]
    finally:
        clear_login_attempts(test_user)


# ═════════════════════════════════════════════════════════════════════════════
# Expanded Test Suite: Role Assignment & Project Integrity
# ═════════════════════════════════════════════════════════════════════════════

def test_project_leadership_and_role_assignment(client):
    adv_headers = _get_auth_headers(client, "Dr. UFUK ASIL", "advisor", "password123")
    leader_headers = _get_auth_headers(client, "210208001", "student", "password123")
    member_headers = _get_auth_headers(client, "210208002", "student", "password123")

    # 1. Regular member cannot assign roles (403)
    resp_forbidden = client.post(
        "/api/projects/Autonomous Drone Delivery System/roles",
        json={"student_no": "210208003", "role": "Yazilim", "responsibility": "Backend"},
        headers=member_headers,
    )
    assert resp_forbidden.status_code == 403

    # 2. Leader can assign roles to members of their project (200)
    resp_success = client.post(
        "/api/projects/Autonomous Drone Delivery System/roles",
        json={"student_no": "210208002", "role": "Test", "responsibility": "Quality Assurance"},
        headers=leader_headers,
    )
    assert resp_success.status_code == 200

    # 3. Leader assigning role to student outside the project -> 400
    resp_foreign = client.post(
        "/api/projects/Autonomous Drone Delivery System/roles",
        json={"student_no": "999999999", "role": "Yazilim"},
        headers=leader_headers,
    )
    assert resp_foreign.status_code == 400

    # 4. Advisor can reassign project leader (200)
    resp_assign = client.post(
        "/api/projects/Autonomous Drone Delivery System/leader",
        json={"student_no": "210208002"},
        headers=adv_headers,
    )
    assert resp_assign.status_code == 200

    # 5. Advisor assigning non-member student as leader -> 400
    resp_invalid_leader = client.post(
        "/api/projects/Autonomous Drone Delivery System/leader",
        json={"student_no": "999999999"},
        headers=adv_headers,
    )
    assert resp_invalid_leader.status_code == 400

    # Revert leader assignment back to original
    client.post(
        "/api/projects/Autonomous Drone Delivery System/leader",
        json={"student_no": "210208001"},
        headers=adv_headers,
    )


def test_weekly_and_feedback_foreign_key_integrity(client):
    adv_headers = _get_auth_headers(client, "Dr. UFUK ASIL", "advisor", "password123")
    member_headers = _get_auth_headers(client, "210208002", "student", "password123")

    # 1. Weekly update with nonexistent project -> 404
    resp_no_prj = client.post(
        "/api/weekly",
        json={"project_name": "Ghost Project NonExistent", "week_start": "2026-09-21", "completed": "Work"},
        headers=member_headers,
    )
    assert resp_no_prj.status_code == 404

    # 2. Weekly update with nonexistent task_id -> 404
    resp_no_task = client.post(
        "/api/weekly",
        json={
            "project_name": "Autonomous Drone Delivery System",
            "task_id": 999999,
            "week_start": "2026-09-21",
            "completed": "Work",
        },
        headers=member_headers,
    )
    assert resp_no_task.status_code == 404

    # 3. Weekly update with task belonging to a different project -> 400
    # Task 91 belongs to Healthcare AI Diagnostic Assistant
    resp_cross_task = client.post(
        "/api/weekly",
        json={
            "project_name": "Autonomous Drone Delivery System",
            "task_id": 91,
            "week_start": "2026-09-21",
            "completed": "Cross project task log attempt",
        },
        headers=member_headers,
    )
    assert resp_cross_task.status_code == 400

    # 4. Advisor feedback with nonexistent project -> 404
    resp_fb_no_prj = client.post(
        "/api/feedback",
        json={"project_name": "Ghost Project NonExistent", "feedback": "Review feedback"},
        headers=adv_headers,
    )
    assert resp_fb_no_prj.status_code == 404

