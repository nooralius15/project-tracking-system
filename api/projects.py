"""
api/projects.py
Project management endpoints: project lists, metrics, member rosters, leader & role assignments.
"""
from __future__ import annotations

import io
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
import pandas as pd

from api.deps import get_current_user, get_db, require_role
from api.schemas import (
    AddStudentRequest,
    AssignLeaderRequest,
    AssignRoleRequest,
    ProjectDetail,
    ProjectMember,
    ProjectSummary,
)
from db import fetch_df
from models import (
    add_single_student,
    build_project_metrics,
    completion_percent,
    ensure_database_synced,
    fetch_feedbacks,
    fetch_tasks,
    fetch_weekly_updates_for_project,
    get_leader,
    get_roster_from_db,
    get_student_memberships,
    load_roster_from_upload,
    set_leader,
    upsert_role,
    upsert_students,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectSummary])
def list_projects(current_user: dict = Depends(get_current_user), conn=Depends(get_db)):
    """List projects accessible to the authenticated user."""
    role = current_user["role"]
    user_id = current_user["user_id"]
    is_admin = current_user.get("is_admin", False)

    if role == "advisor":
        roster = get_roster_from_db(conn, None if is_admin else user_id)
    else:
        memberships = get_student_memberships(conn, user_id)
        if memberships.empty:
            return []
        project_names = set(memberships["project_name"].tolist())
        all_roster = get_roster_from_db(conn)
        roster = all_roster[all_roster["project_name"].isin(project_names)]

    if roster.empty:
        return []

    project_names = sorted(roster["project_name"].unique())
    metrics_df = build_project_metrics(conn, roster, project_names)

    summaries: List[ProjectSummary] = []
    for prj in project_names:
        grp = roster[roster["project_name"] == prj]
        adv_name = str(grp.iloc[0]["advisor_name"]) if not grp.empty else ""
        leader_sno = get_leader(conn, prj)
        leader_name = "-"
        if leader_sno:
            hit = grp[grp["student_no"].astype(str) == str(leader_sno)]
            leader_name = str(hit.iloc[0]["student_name"]) if not hit.empty else leader_sno

        metric_row = metrics_df[metrics_df["Proje"] == prj] if not metrics_df.empty else None
        completion = float(metric_row.iloc[0]["Tamamlanma %"]) if metric_row is not None and not metric_row.empty else 0.0
        risk = str(metric_row.iloc[0]["Risk"]) if metric_row is not None and not metric_row.empty else "Orta"
        overdue = int(metric_row.iloc[0]["Geciken Gorev"]) if metric_row is not None and not metric_row.empty else 0

        summaries.append(
            ProjectSummary(
                name=prj,
                leader=leader_name,
                leader_student_no=leader_sno,
                members_count=len(grp),
                completion_pct=completion,
                risk=risk,
                overdue_count=overdue,
                advisor_name=adv_name,
            )
        )
    return summaries


@router.get("/roster/students-search")
def search_students(
    q: str = "",
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Search students by name or student number across advisor's projects (or all if admin)."""
    user_id = current_user["user_id"]
    role = current_user["role"]
    is_admin = current_user.get("is_admin", False)

    if role == "advisor":
        roster = get_roster_from_db(conn, None if is_admin else user_id)
    else:
        memberships = get_student_memberships(conn, user_id)
        if memberships.empty:
            return []
        project_names = set(memberships["project_name"].tolist())
        all_roster = get_roster_from_db(conn)
        roster = all_roster[all_roster["project_name"].isin(project_names)]

    if roster.empty or not q.strip():
        return []

    q_clean = q.strip().lower()
    matches = roster[
        roster["student_name"].astype(str).str.lower().str.contains(q_clean, na=False)
        | roster["student_no"].astype(str).str.strip().str.contains(q_clean, na=False)
    ]
    if matches.empty:
        return []

    results = []
    for _, stu_row in matches.iterrows():
        sno = str(stu_row["student_no"]).strip()
        sname = str(stu_row["student_name"]).strip()
        pname = str(stu_row["project_name"]).strip()
        prog = str(stu_row.get("program") or "")
        adv = str(stu_row.get("advisor_name") or "")

        leader_sno = get_leader(conn, pname)
        is_stu_leader = (leader_sno == sno)

        role_df = fetch_df(conn, "SELECT student_no, role, responsibility FROM member_roles WHERE project_name = ?", (pname,))
        stu_role_row = role_df[role_df["student_no"].astype(str) == sno]
        stu_role = str(stu_role_row.iloc[0]["role"]) if not stu_role_row.empty else ("Lider" if is_stu_leader else "Üye")
        stu_resp = str(stu_role_row.iloc[0]["responsibility"]) if not stu_role_row.empty else "—"

        tasks_df = fetch_tasks(conn, pname)
        my_tasks_df = tasks_df[tasks_df["assignee_student_no"].astype(str) == sno] if not tasks_df.empty else pd.DataFrame()

        my_tasks = []
        if not my_tasks_df.empty:
            for _, t in my_tasks_df.iterrows():
                my_tasks.append({
                    "id": int(t["id"]),
                    "milestone_key": str(t["milestone_key"]),
                    "title": str(t["title"]),
                    "status": str(t["status"]),
                    "priority": str(t["priority"]),
                    "deadline": str(t.get("deadline") or ""),
                    "evidence_link": str(t.get("evidence_link") or ""),
                    "evidence_file": str(t.get("evidence_file") or ""),
                })

        team = roster[roster["project_name"] == pname].sort_values("row_no")
        team_members = []
        for _, tm in team.iterrows():
            tm_sno = str(tm["student_no"])
            tm_role_row = role_df[role_df["student_no"].astype(str) == tm_sno]
            tm_role = str(tm_role_row.iloc[0]["role"]) if not tm_role_row.empty else ("Lider" if tm_sno == leader_sno else "Üye")
            tm_resp = str(tm_role_row.iloc[0]["responsibility"]) if not tm_role_row.empty else ""
            team_members.append({
                "student_no": tm_sno,
                "student_name": str(tm["student_name"]),
                "role": tm_role,
                "responsibility": tm_resp,
                "program": str(tm.get("program") or ""),
            })

        weekly_df = fetch_weekly_updates_for_project(conn, pname, sno)
        weekly_updates = []
        if not weekly_df.empty:
            for _, w in weekly_df.iterrows():
                weekly_updates.append({
                    "week_start": str(w["week_start"]),
                    "completed": str(w.get("completed") or ""),
                    "blockers": str(w.get("blockers") or ""),
                    "next_step": str(w.get("next_step") or ""),
                    "evidence_link": str(w.get("evidence_link") or ""),
                    "created_at": str(w.get("created_at") or ""),
                })

        fb_df = fetch_feedbacks(conn, pname)
        feedbacks = []
        if not fb_df.empty:
            for _, fb in fb_df.iterrows():
                feedbacks.append({
                    "id": int(fb["id"]),
                    "project_name": str(fb["project_name"]),
                    "advisor_name": str(fb["advisor_name"]),
                    "feedback": str(fb["feedback"]),
                    "action_item": str(fb.get("action_item") or ""),
                    "revision_required": bool(fb.get("revision_required", 0)),
                    "created_at": str(fb.get("created_at") or ""),
                })

        results.append({
            "student_no": sno,
            "student_name": sname,
            "project_name": pname,
            "program": prog,
            "advisor_name": adv,
            "role": stu_role,
            "responsibility": stu_resp,
            "is_leader": is_stu_leader,
            "assigned_tasks_count": len(my_tasks_df),
            "completed_tasks_count": int((my_tasks_df["status"] == "DONE").sum()) if not my_tasks_df.empty else 0,
            "completion_pct": completion_percent(my_tasks_df) if not my_tasks_df.empty else 0.0,
            "tasks": my_tasks,
            "team_members": team_members,
            "weekly_updates": weekly_updates,
            "feedbacks": feedbacks,
        })
    return results


@router.post("/students")
def add_student(
    payload: AddStudentRequest,
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Add a new student to a project (Advisor only)."""
    sno = payload.student_no.strip()
    sname = payload.student_name.strip()
    pname = payload.project_name.strip()
    prog = (payload.program or "").strip()
    advisor_name = current_user["user_id"]

    if not sno or not sname or not pname:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Öğrenci No, Adı ve Proje Adı zorunludur.")

    existing_check = conn.execute(
        "SELECT COUNT(*) AS cnt FROM students WHERE student_no = ? AND project_name = ?",
        (sno, pname),
    ).fetchone()["cnt"]
    if int(existing_check) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{sno} numaralı öğrenci zaten '{pname}' projesinde kayıtlı.",
        )

    add_single_student(conn, sno, sname, pname, advisor_name, prog)
    ensure_database_synced(conn, force=True)
    return {"message": f"{sname} ({sno}) başarıyla '{pname}' projesine eklendi."}


@router.post("/roster/upload-csv")
async def upload_roster_csv(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Upload or update student roster via CSV file (Advisor only)."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yalnızca .csv dosyaları yüklenebilir.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yüklenen dosya boş.")

    try:
        new_roster = load_roster_from_upload(io.BytesIO(content))
        count = upsert_students(conn, new_roster)
        ensure_database_synced(conn, force=True)
        return {"message": f"{count} öğrenci kaydı güncellendi.", "count": count}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"CSV işleme hatası: {str(e)}")


@router.get("/{project_name}", response_model=ProjectDetail)
def get_project_detail(project_name: str, current_user: dict = Depends(get_current_user), conn=Depends(get_db)):
    """Retrieve full project details including member list and assigned roles."""
    all_roster = get_roster_from_db(conn)
    grp = all_roster[all_roster["project_name"] == project_name]
    if grp.empty:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    # IDOR check: students can only view their own project details
    if current_user["role"] == "student":
        stu_match = conn.execute(
            "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
            (project_name, current_user["user_id"]),
        ).fetchone()
        if not stu_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu projenin detaylarını görüntüleme yetkiniz yok.",
            )

    adv_name = str(grp.iloc[0]["advisor_name"]) if not grp.empty else ""
    leader_sno = get_leader(conn, project_name)
    leader_name = "-"
    if leader_sno:
        hit = grp[grp["student_no"].astype(str) == str(leader_sno)]
        leader_name = str(hit.iloc[0]["student_name"]) if not hit.empty else leader_sno

    # Members & roles
    roles_df = fetch_df(conn, "SELECT student_no, role, responsibility FROM member_roles WHERE project_name = ?", (project_name,))
    role_map = {str(r["student_no"]): (str(r["role"]), str(r.get("responsibility") or "")) for _, r in roles_df.iterrows()}

    members: List[ProjectMember] = []
    for _, row in grp.iterrows():
        sno = str(row["student_no"])
        sname = str(row["student_name"])
        prog = str(row.get("program") or "")
        r_title, r_resp = role_map.get(sno, ("Lider" if sno == leader_sno else "Üye", ""))
        members.append(ProjectMember(
            student_no=sno,
            student_name=sname,
            role=r_title,
            responsibility=r_resp,
            program=prog,
        ))

    metrics_df = build_project_metrics(conn, all_roster, [project_name])
    metric_row = metrics_df[metrics_df["Proje"] == project_name] if not metrics_df.empty else None
    completion = float(metric_row.iloc[0]["Tamamlanma %"]) if metric_row is not None and not metric_row.empty else 0.0
    risk = str(metric_row.iloc[0]["Risk"]) if metric_row is not None and not metric_row.empty else "Orta"
    overdue = int(metric_row.iloc[0]["Geciken Gorev"]) if metric_row is not None and not metric_row.empty else 0

    return ProjectDetail(
        name=project_name,
        leader=leader_name,
        leader_student_no=leader_sno,
        members_count=len(grp),
        completion_pct=completion,
        risk=risk,
        overdue_count=overdue,
        advisor_name=adv_name,
        members=members,
    )


@router.post("/{project_name}/leader")
def assign_leader(
    project_name: str,
    payload: AssignLeaderRequest,
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Assign or reassign the team leader for a project (Advisor only)."""
    # 1. Verify project exists
    proj_check = conn.execute("SELECT 1 FROM students WHERE project_name = ?", (project_name,)).fetchone()
    if not proj_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    # 2. Verify advisor authorization for this project
    if not current_user.get("is_admin", False):
        adv_match = conn.execute(
            "SELECT 1 FROM students WHERE project_name = ? AND lower(advisor_name) = lower(?)",
            (project_name, current_user["user_id"]),
        ).fetchone()
        if not adv_match:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yetkisiz işlem: Bu projenin danışmanı değilsiniz.",
            )

    # 3. Verify target student is part of the project
    match = conn.execute(
        "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
        (project_name, payload.student_no.strip()),
    ).fetchone()
    if not match:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Öğrenci bu projeye dahil değil.")

    set_leader(conn, project_name, payload.student_no.strip(), assigned_by=current_user["user_id"])
    return {"message": "Grup lideri başarıyla atandı."}


@router.post("/{project_name}/roles")
def assign_member_role(
    project_name: str,
    payload: AssignRoleRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Assign roles and responsibilities to project members (Leader or Advisor)."""
    user_id = current_user["user_id"]
    role = current_user["role"]

    # 1. Verify project exists
    proj_check = conn.execute("SELECT 1 FROM students WHERE project_name = ?", (project_name,)).fetchone()
    if not proj_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    # 2. Verify caller authorization
    if role == "student":
        leader_sno = get_leader(conn, project_name)
        if leader_sno != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yalnızca grup lideri veya danışman rol atayabilir.")
    elif role == "advisor":
        if not current_user.get("is_admin", False):
            adv_match = conn.execute(
                "SELECT 1 FROM students WHERE project_name = ? AND lower(advisor_name) = lower(?)",
                (project_name, user_id),
            ).fetchone()
            if not adv_match:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz işlem: Bu projenin danışmanı değilsiniz.")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz rol.")

    # 3. Verify target student is enrolled in this project
    match = conn.execute(
        "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
        (project_name, payload.student_no.strip()),
    ).fetchone()
    if not match:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Öğrenci bu projeye dahil değil.")

    upsert_role(conn, project_name, payload.student_no.strip(), payload.role.strip(), (payload.responsibility or "").strip())
    return {"message": "Üye rolü güncellendi."}
