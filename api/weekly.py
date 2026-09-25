"""
api/weekly.py
Weekly progress update endpoints.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.deps import get_current_user, get_db
from api.schemas import WeeklyUpdateRequest, WeeklyUpdateResponse
from db import fetch_df
from models import add_weekly_update, fetch_weekly_updates_for_project

router = APIRouter(prefix="/weekly", tags=["Weekly Updates"])


@router.get("", response_model=List[WeeklyUpdateResponse])
def get_weekly_updates(
    project_name: Optional[str] = Query(None),
    student_no: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Retrieve weekly updates filtered by project or student with authorization checks."""
    if project_name:
        clean_prj = project_name.strip()
        proj_check = conn.execute("SELECT 1 FROM students WHERE project_name = ?", (clean_prj,)).fetchone()
        if not proj_check:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

        if current_user["role"] == "student":
            stu_check = conn.execute(
                "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
                (clean_prj, current_user["user_id"]),
            ).fetchone()
            if not stu_check:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu projenin haftalık raporlarını görüntüleme yetkiniz yok.",
                )
        df = fetch_weekly_updates_for_project(conn, clean_prj)
    elif student_no:
        clean_sno = student_no.strip()
        if current_user["role"] == "student" and clean_sno != current_user["user_id"]:
            # Student can only view other students' updates if they are their project leader
            leader_match = conn.execute(
                """
                SELECT 1 FROM leaders l
                JOIN students s ON l.project_name = s.project_name
                WHERE l.student_no = ? AND s.student_no = ?
                """,
                (current_user["user_id"], clean_sno),
            ).fetchone()
            if not leader_match:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Yalnızca kendi veya lideri olduğunuz grubun haftalık raporlarını görüntüleyebilirsiniz.",
                )
        df = fetch_df(
            conn,
            "SELECT * FROM weekly_updates WHERE student_no = ? ORDER BY week_start DESC, id DESC",
            (clean_sno,),
        )
    elif current_user["role"] == "student":
        df = fetch_df(
            conn,
            "SELECT * FROM weekly_updates WHERE student_no = ? ORDER BY week_start DESC, id DESC",
            (current_user["user_id"],),
        )
    else:
        df = fetch_df(conn, "SELECT * FROM weekly_updates ORDER BY week_start DESC, id DESC LIMIT 100")

    if df.empty:
        return []

    # Map student names and task titles
    roster_df = fetch_df(conn, "SELECT student_no, student_name FROM students")
    name_map = dict(zip(roster_df["student_no"].astype(str), roster_df["student_name"].astype(str)))
    tasks_df = fetch_df(conn, "SELECT id, title FROM tasks")
    task_map = dict(zip(tasks_df["id"].astype(int), tasks_df["title"].astype(str)))

    entries: List[WeeklyUpdateResponse] = []
    for _, r in df.iterrows():
        sno = str(r["student_no"])
        tid = int(r["task_id"]) if r.get("task_id") and str(r["task_id"]).isdigit() else None
        entries.append(
            WeeklyUpdateResponse(
                id=int(r["id"]),
                project_name=str(r["project_name"]),
                student_no=sno,
                student_name=name_map.get(sno, sno),
                task_id=tid,
                task_title=task_map.get(tid) if tid else None,
                week_start=str(r["week_start"]),
                completed=str(r.get("completed") or ""),
                blockers=str(r.get("blockers") or ""),
                next_step=str(r.get("next_step") or ""),
                evidence_link=str(r.get("evidence_link") or ""),
                created_at=str(r["created_at"]),
            )
        )
    return entries


@router.post("", response_model=dict)
def submit_weekly_update(
    payload: WeeklyUpdateRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Submit a weekly progress diary entry with project enrollment and task FK validation."""
    user_id = current_user["user_id"]
    if current_user["role"] != "student":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yalnızca öğrenciler haftalık rapor girebilir.")

    clean_project = payload.project_name.strip()
    completed_text = payload.completed.strip()
    if not completed_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tamamlanan çalışmalar açıklaması boş olamaz.")

    # 1. Project existence check
    proj_check = conn.execute("SELECT 1 FROM students WHERE project_name = ?", (clean_project,)).fetchone()
    if not proj_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    # 2. Student enrollment check (IDOR protection)
    stu_check = conn.execute(
        "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
        (clean_project, user_id),
    ).fetchone()
    if not stu_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu proje için haftalık rapor girme yetkiniz yok veya projeye dahil değilsiniz.",
        )

    # 3. Foreign key verification for task_id (if provided)
    if payload.task_id is not None:
        task_row = conn.execute("SELECT id, project_name FROM tasks WHERE id = ?", (payload.task_id,)).fetchone()
        if not task_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen görev bulunamadı.")
        if str(task_row["project_name"]).strip() != clean_project:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Görev belirtilen projeye ait değil.")

    add_weekly_update(
        conn=conn,
        project_name=clean_project,
        student_no=user_id,
        task_id=payload.task_id,
        week_start=payload.week_start.strip(),
        completed=completed_text,
        blockers=(payload.blockers or "").strip(),
        next_step=(payload.next_step or "").strip(),
        evidence_link=(payload.evidence_link or "").strip(),
    )
    return {"message": "Haftalık ilerleme kaydedildi."}
