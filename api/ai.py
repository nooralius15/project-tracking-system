"""
api/ai.py
AI Intelligence endpoints: portfolio synthesis and interactive chat assistant.
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_db, require_role
from api.schemas import (
    AIAdvisorReportRequest,
    AIAdvisorReportResponse,
    AIChatRequest,
    AIChatResponse,
)
from ai_client import (
    build_advisor_prompt,
    chat,
    generate,
    get_active_model_name,
    get_active_provider_name,
    get_chat_system_prompt,
)
from db import fetch_df
from models import build_project_metrics, get_leader, get_roster_from_db

router = APIRouter(prefix="/ai", tags=["AI Intelligence"])


@router.post("/advisor-report", response_model=AIAdvisorReportResponse)
def generate_advisor_portfolio_report(
    payload: AIAdvisorReportRequest,
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Generate comprehensive academic advisor portfolio diagnosis report."""
    advisor_name = current_user["user_id"]
    is_admin = current_user.get("is_admin", False)

    roster = get_roster_from_db(conn, None if is_admin else advisor_name)
    if roster.empty:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Raporlanacak proje bulunamadı.")

    projects = sorted(roster["project_name"].unique())
    summary_df = build_project_metrics(conn, roster, projects)

    projects_data = []
    for prj in projects:
        grp = roster[roster["project_name"] == prj]
        leader_sno = get_leader(conn, prj)
        leader_name = "-"
        if leader_sno:
            hit = grp[grp["student_no"].astype(str) == str(leader_sno)]
            leader_name = str(hit.iloc[0]["student_name"]) if not hit.empty else leader_sno

        metric_row = summary_df[summary_df["Proje"] == prj] if not summary_df.empty else None
        completion = float(metric_row.iloc[0]["Tamamlanma %"]) if metric_row is not None and not metric_row.empty else 0.0
        risk = str(metric_row.iloc[0]["Risk"]) if metric_row is not None and not metric_row.empty else "Orta"
        overdue = int(metric_row.iloc[0]["Geciken Gorev"]) if metric_row is not None and not metric_row.empty else 0

        projects_data.append({
            "name": prj,
            "leader": leader_name,
            "members": len(grp),
            "completion_pct": completion,
            "overdue_count": overdue,
            "risk": risk,
            "recent_activity": 0,
        })

    prompt = build_advisor_prompt(advisor_name, projects_data, lang=payload.lang)
    report_text = generate(prompt)

    return AIAdvisorReportResponse(
        report=report_text,
        provider=get_active_provider_name(),
        model=get_active_model_name(),
    )


@router.post("/chat", response_model=AIChatResponse)
def ai_assistant_chat(
    payload: AIChatRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Conversational assistant aware of the active user role and project context."""
    user_id = current_user["user_id"]
    role = current_user["role"]
    display_name = current_user["display_name"]
    project_name = payload.project_name or ""

    # Check if student is a team leader
    effective_role = role
    if role == "student" and project_name:
        leader_sno = get_leader(conn, project_name)
        if leader_sno == user_id:
            effective_role = "leader"

    sys_prompt = get_chat_system_prompt(role=effective_role, display_name=display_name, project_name=project_name)

    messages = [{"role": "system", "content": sys_prompt}]
    for m in payload.messages:
        messages.append({"role": m.role, "content": m.content})

    reply = chat(messages)

    return AIChatResponse(
        reply=reply,
        provider=get_active_provider_name(),
        model=get_active_model_name(),
    )
