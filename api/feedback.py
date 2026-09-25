"""
api/feedback.py
Advisor review and feedback endpoints.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.deps import get_current_user, get_db, require_role
from api.schemas import FeedbackCreateRequest, FeedbackResponse
from db import fetch_df
from models import add_feedback, fetch_feedbacks

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.get("", response_model=List[FeedbackResponse])
def get_project_feedbacks(
    project_name: str = Query(...),
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Retrieve all advisor feedback for a given project with access checks."""
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
                detail="Bu projenin geri bildirimlerini görüntüleme yetkiniz yok.",
            )

    df = fetch_feedbacks(conn, clean_prj)
    if df.empty:
        return []

    feedbacks: List[FeedbackResponse] = []
    for _, r in df.iterrows():
        feedbacks.append(
            FeedbackResponse(
                id=int(r["id"]),
                project_name=clean_prj,
                advisor_name=str(r["advisor_name"]),
                feedback=str(r["feedback"]),
                action_item=str(r.get("action_item") or ""),
                revision_required=bool(r.get("revision_required", 0)),
                created_at=str(r["created_at"]),
            )
        )
    return feedbacks


@router.post("", response_model=dict)
def submit_advisor_feedback(
    payload: FeedbackCreateRequest,
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Submit formal advisor feedback for a project with advisor assignment verification."""
    clean_prj = payload.project_name.strip()
    feedback_text = payload.feedback.strip()
    if not feedback_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geri bildirim metni boş olamaz.")

    proj_check = conn.execute("SELECT 1 FROM students WHERE project_name = ?", (clean_prj,)).fetchone()
    if not proj_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    if not current_user.get("is_admin", False):
        adv_check = conn.execute(
            "SELECT 1 FROM students WHERE project_name = ? AND lower(advisor_name) = lower(?)",
            (clean_prj, current_user["user_id"]),
        ).fetchone()
        if not adv_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yetkisiz işlem: Bu projenin danışmanı değilsiniz.",
            )

    add_feedback(
        conn=conn,
        project_name=clean_prj,
        advisor_name=current_user["user_id"],
        feedback=feedback_text,
        action_item=(payload.action_item or "").strip(),
        revision_required=payload.revision_required,
    )
    return {"message": "Geri bildirim başarıyla kaydedildi."}
