"""
api/schemas.py
Pydantic schemas for request validation and response serialisation.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ── Auth & Users ──────────────────────────────────────────────────────────────

class UserResponse(BaseModel):
    user_id: str
    role: str
    display_name: str
    force_password_change: bool = False
    is_active: bool = True
    is_admin: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class LoginRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class ChangePasswordRequest(BaseModel):
    new_password: str = Field(min_length=6, max_length=128)
    confirm_password: str = Field(min_length=6, max_length=128)


class ActivateAccountRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=50)
    token: str = Field(min_length=1, max_length=100)
    new_password: str = Field(min_length=6, max_length=128)


class AdvisorOption(BaseModel):
    user_id: str
    display_name: str


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectMember(BaseModel):
    student_no: str
    student_name: str
    role: str = "Üye"
    responsibility: Optional[str] = None
    program: Optional[str] = None


class ProjectSummary(BaseModel):
    name: str
    leader: str = "-"
    leader_student_no: Optional[str] = None
    members_count: int = 0
    completion_pct: float = 0.0
    risk: str = "Orta"
    overdue_count: int = 0
    advisor_name: str = ""


class ProjectDetail(ProjectSummary):
    members: List[ProjectMember] = []


class AssignLeaderRequest(BaseModel):
    student_no: str = Field(min_length=1, max_length=50)


class AssignRoleRequest(BaseModel):
    student_no: str = Field(min_length=1, max_length=50)
    role: str = Field(min_length=1, max_length=50)
    responsibility: Optional[str] = Field(default="", max_length=500)


# ── Tasks & Milestones ────────────────────────────────────────────────────────

class TaskResponse(BaseModel):
    id: int
    project_name: str
    milestone_key: str
    title: str
    description: Optional[str] = ""
    assignee_student_no: str
    assignee_name: Optional[str] = ""
    status: str
    priority: str
    deadline: Optional[str] = None
    dependency_task_id: Optional[int] = None
    evidence_required: Optional[str] = ""
    evidence_link: Optional[str] = ""
    evidence_file: Optional[str] = ""
    created_by: str
    created_at: str
    updated_at: str


class TaskCreateRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    milestone_key: str = Field(pattern="^M[1-6]$")
    title: str = Field(min_length=1, max_length=250)
    description: Optional[str] = Field(default="", max_length=2000)
    assignee_student_no: str = Field(min_length=1, max_length=50)
    priority: str = Field(default="Orta", max_length=20)
    deadline: Optional[str] = Field(default=None, max_length=50)
    dependency_task_id: Optional[int] = None
    evidence_required: Optional[str] = Field(default="", max_length=500)


class TaskUpdateRequest(BaseModel):
    status: str = Field(pattern="^(TODO|DOING|DONE)$")
    evidence_link: Optional[str] = Field(default="", max_length=1000)
    skip_milestone_check: bool = False


# ── Comments ──────────────────────────────────────────────────────────────────

class CommentResponse(BaseModel):
    id: int
    task_id: int
    project_name: str
    author_id: str
    author_role: str
    author_name: Optional[str] = None
    comment: str
    created_at: str


class CommentCreateRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)


# ── Weekly Updates ────────────────────────────────────────────────────────────

class WeeklyUpdateResponse(BaseModel):
    id: int
    project_name: str
    student_no: str
    student_name: Optional[str] = None
    task_id: Optional[int] = None
    task_title: Optional[str] = None
    week_start: str
    completed: Optional[str] = ""
    blockers: Optional[str] = ""
    next_step: Optional[str] = ""
    evidence_link: Optional[str] = ""
    created_at: str


class WeeklyUpdateRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    task_id: Optional[int] = None
    week_start: str = Field(min_length=1, max_length=50)
    completed: str = Field(min_length=1, max_length=5000)
    blockers: Optional[str] = Field(default="", max_length=2000)
    next_step: Optional[str] = Field(default="", max_length=2000)
    evidence_link: Optional[str] = Field(default="", max_length=1000)


# ── Advisor Feedback ──────────────────────────────────────────────────────────

class FeedbackResponse(BaseModel):
    id: int
    project_name: str
    advisor_name: str
    feedback: str
    action_item: Optional[str] = ""
    revision_required: bool = False
    created_at: str


class FeedbackCreateRequest(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    feedback: str = Field(min_length=1, max_length=5000)
    action_item: Optional[str] = Field(default="", max_length=2000)
    revision_required: bool = False


# ── AI Intelligence ───────────────────────────────────────────────────────────

class AIChatMessage(BaseModel):
    role: str
    content: str


class AIChatRequest(BaseModel):
    messages: List[AIChatMessage]
    project_name: Optional[str] = ""


class AIChatResponse(BaseModel):
    reply: str
    provider: str
    model: str


class AIAdvisorReportRequest(BaseModel):
    lang: str = "tr"


class AIAdvisorReportResponse(BaseModel):
    report: str
    provider: str
    model: str
