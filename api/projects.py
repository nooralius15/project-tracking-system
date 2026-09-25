"""
api/projects.py
Project management endpoints: project lists, metrics, member rosters, leader & role assignments.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_db, require_role
from api.schemas import (
    AssignLeaderRequest,
    AssignRoleRequest,
    ProjectDetail,
    ProjectMember,
    ProjectSummary,
)
from db import fetch_df
from models import (
    build_project_metrics,
    get_leader,
    get_roster_from_db,
    get_student_memberships,
    set_leader,
    upsert_role,
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
