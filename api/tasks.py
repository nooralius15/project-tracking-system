"""
api/tasks.py
Task management endpoints: task lists, creation, status updates with IDOR checks, evidence upload, comments.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from api.deps import get_current_user, get_db
from api.schemas import (
    CommentCreateRequest,
    CommentResponse,
    TaskCreateRequest,
    TaskResponse,
    TaskUpdateRequest,
)
from constants import UPLOADS_DIR
from db import fetch_df
from models import (
    add_task_comment,
    create_task,
    fetch_task_comments,
    fetch_tasks,
    get_leader,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

ALLOWED_MIME_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".docx", ".zip"
}
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/pjpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream",
}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB limit


@router.get("", response_model=List[TaskResponse])
def get_tasks(
    project_name: Optional[str] = Query(None),
    assignee_student_no: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Retrieve tasks with optional filters for project and assignee."""
    if project_name:
        if current_user["role"] == "student":
            stu_match = conn.execute(
                "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
                (project_name, current_user["user_id"]),
            ).fetchone()
            if not stu_match:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bu projenin görevlerini görüntüleme yetkiniz yok.",
                )
        tasks_df = fetch_tasks(conn, project_name)
    elif current_user["role"] == "student":
        # All tasks assigned to this student
        tasks_df = fetch_df(
            conn,
            "SELECT * FROM tasks WHERE assignee_student_no = ? ORDER BY milestone_key, id",
            (current_user["user_id"],),
        )
    else:
        # All tasks across projects
        tasks_df = fetch_df(conn, "SELECT * FROM tasks ORDER BY project_name, milestone_key, id")

    if tasks_df.empty:
        return []

    if assignee_student_no:
        tasks_df = tasks_df[tasks_df["assignee_student_no"] == assignee_student_no]

    # Map assignee names
    roster_df = fetch_df(conn, "SELECT student_no, student_name FROM students")
    name_map = dict(zip(roster_df["student_no"].astype(str), roster_df["student_name"].astype(str)))

    tasks: List[TaskResponse] = []
    for _, t in tasks_df.iterrows():
        sno = str(t.get("assignee_student_no", ""))
        tasks.append(
            TaskResponse(
                id=int(t["id"]),
                project_name=str(t["project_name"]),
                milestone_key=str(t["milestone_key"]),
                title=str(t["title"]),
                description=str(t.get("description") or ""),
                assignee_student_no=sno,
                assignee_name=name_map.get(sno, sno),
                status=str(t["status"]),
                priority=str(t["priority"]),
                deadline=str(t.get("deadline") or "") or None,
                dependency_task_id=int(t["dependency_task_id"]) if t.get("dependency_task_id") else None,
                evidence_required=str(t.get("evidence_required") or ""),
                evidence_link=str(t.get("evidence_link") or ""),
                evidence_file=str(t.get("evidence_file") or ""),
                created_by=str(t.get("created_by") or ""),
                created_at=str(t.get("created_at") or t.get("updated_at") or ""),
                updated_at=str(t.get("updated_at") or ""),
            )
        )
    return tasks


@router.post("", response_model=TaskResponse)
def create_new_task(
    payload: TaskCreateRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Create a new task within a project (Leader or Advisor)."""
    user_id = current_user["user_id"]
    role = current_user["role"]

    # 1. Project existence check
    proj_check = conn.execute(
        "SELECT 1 FROM students WHERE project_name = ?",
        (payload.project_name.strip(),),
    ).fetchone()
    if not proj_check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı.")

    # 2. Authorization check
    if role == "student":
        leader_sno = get_leader(conn, payload.project_name)
        if leader_sno != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yalnızca grup lideri veya danışman görev oluşturabilir.")
    elif role != "advisor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz rol.")

    # 3. Assignee foreign-key check
    assignee_check = conn.execute(
        "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
        (payload.project_name.strip(), payload.assignee_student_no.strip()),
    ).fetchone()
    if not assignee_check:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Atanan öğrenci bu projeye dahil değil.")

    # 4. Dependency task check
    if payload.dependency_task_id:
        dep = conn.execute("SELECT project_name FROM tasks WHERE id = ?", (payload.dependency_task_id,)).fetchone()
        if not dep:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bağımlı görev bulunamadı.")
        if str(dep["project_name"]).strip() != payload.project_name.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bağımlı görev farklı bir projeye ait.")

    new_task_id = create_task(
        conn=conn,
        project_name=payload.project_name.strip(),
        milestone_key=payload.milestone_key,
        title=payload.title.strip(),
        description=(payload.description or "").strip(),
        assignee_student_no=payload.assignee_student_no.strip(),
        priority=payload.priority,
        deadline=payload.deadline,
        dependency_task_id=payload.dependency_task_id,
        evidence_required=(payload.evidence_required or "").strip(),
        created_by=user_id,
    )
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (new_task_id,)).fetchone()
    return TaskResponse(
        id=int(row["id"]),
        project_name=str(row["project_name"]),
        milestone_key=str(row["milestone_key"]),
        title=str(row["title"]),
        description=str(row.get("description") or ""),
        assignee_student_no=str(row["assignee_student_no"]),
        status=str(row["status"]),
        priority=str(row["priority"]),
        deadline=str(row.get("deadline") or "") or None,
        dependency_task_id=int(row["dependency_task_id"]) if row.get("dependency_task_id") else None,
        evidence_required=str(row.get("evidence_required") or ""),
        evidence_link=str(row.get("evidence_link") or ""),
        evidence_file=str(row.get("evidence_file") or ""),
        created_by=str(row["created_by"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


@router.patch("/{task_id}")
def update_existing_task(
    task_id: int,
    payload: TaskUpdateRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Update task status with strict IDOR caller authorization and milestone dependency checks."""
    user_id = current_user["user_id"]
    role = current_user["role"]

    # 1. Existence check
    task_row = conn.execute(
        "SELECT status, project_name, milestone_key, assignee_student_no FROM tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    if not task_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı.")

    project_name = str(task_row["project_name"])
    assignee_no = str(task_row["assignee_student_no"])

    # 2. Authorization check (IDOR rules)
    effective_role = role
    if role == "student":
        leader_sno = get_leader(conn, project_name)
        is_leader = (leader_sno == user_id)
        is_assignee = (assignee_no == user_id)

        if not is_leader and not is_assignee:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yetkisiz işlem: Yalnızca kendi görevinizi veya lideri olduğunuz projenin görevlerini güncelleyebilirsiniz.",
            )
        if is_leader:
            effective_role = "leader"
        else:
            effective_role = "student"
    elif role == "advisor":
        effective_role = "advisor"
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz kullanıcı rolü.")

    # 3. Sequential milestone gating: regular students cannot skip checks
    can_skip = payload.skip_milestone_check if effective_role in ("advisor", "leader") else False

    ok, msg = update_task(
        conn=conn,
        task_id=task_id,
        status=payload.status,
        evidence_link=payload.evidence_link or "",
        skip_milestone_check=can_skip,
        caller_id=user_id,
        caller_role=effective_role,
    )
    if not ok:
        if "yetkisiz" in msg.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"message": "Görev başarıyla güncellendi."}


@router.post("/{task_id}/evidence")
async def upload_task_evidence(
    task_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Upload evidence file (image, PDF, archive) for a task with strict validation."""
    # 1. Task existence check
    task_row = conn.execute(
        "SELECT project_name, assignee_student_no FROM tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    if not task_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı.")

    # 2. Authorization check (IDOR protection)
    user_id = current_user["user_id"]
    role = current_user["role"]
    if role == "student":
        leader_sno = get_leader(conn, str(task_row["project_name"]))
        is_leader = (leader_sno == user_id)
        is_assignee = (str(task_row["assignee_student_no"]) == user_id)
        if not is_leader and not is_assignee:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Yetkisiz işlem: Bu görev için kanıt yükleme yetkiniz bulunmamaktadır.",
            )
    elif role != "advisor":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz rol.")

    # 3. Filename sanitization & extension check
    raw_name = file.filename or ""
    clean_name = Path(raw_name.replace("\x00", "")).name
    ext = Path(clean_name).suffix.lower()
    if not ext or ext not in ALLOWED_MIME_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Desteklenmeyen dosya türü: '{ext}'. İzin verilen uzantılar: {', '.join(sorted(ALLOWED_MIME_EXTENSIONS))}",
        )

    # 4. MIME content_type check
    if file.content_type:
        content_type = file.content_type.lower().split(";")[0].strip()
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Desteklenmeyen MIME türü: '{content_type}'.",
            )

    # 5. File size & empty content check
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yüklenen dosya boş olamaz.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dosya boyutu 15MB sınırını aşıyor.")

    # 6. Save with unguessable safe name
    safe_name = f"task_{task_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOADS_DIR / safe_name
    dest.write_bytes(content)

    file_path = str(dest)
    conn.execute(
        "UPDATE tasks SET evidence_file = ?, updated_at = datetime('now') WHERE id = ?",
        (file_path, task_id),
    )
    conn.commit()
    return {"message": "Kanıt dosyası başarıyla yüklendi.", "file_path": file_path}


@router.get("/{task_id}/comments", response_model=List[CommentResponse])
def get_task_comments(
    task_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Retrieve threaded comments for a specific task."""
    task_row = conn.execute("SELECT project_name FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı.")

    if current_user["role"] == "student":
        stu_check = conn.execute(
            "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
            (str(task_row["project_name"]), current_user["user_id"]),
        ).fetchone()
        if not stu_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu görevin yorumlarını görüntüleme yetkiniz yok.",
            )

    df = fetch_task_comments(conn, task_id)
    if df.empty:
        return []

    # Map author names
    roster_df = fetch_df(conn, "SELECT student_no, student_name FROM students")
    name_map = dict(zip(roster_df["student_no"].astype(str), roster_df["student_name"].astype(str)))

    comments: List[CommentResponse] = []
    for _, r in df.iterrows():
        author_id = str(r["author_id"])
        comments.append(
            CommentResponse(
                id=int(r["id"]),
                task_id=int(r["task_id"]),
                project_name=str(task_row["project_name"]),
                author_id=author_id,
                author_role=str(r["author_role"]),
                author_name=name_map.get(author_id, author_id),
                comment=str(r["comment"]),
                created_at=str(r["created_at"]),
            )
        )
    return comments


@router.post("/{task_id}/comments")
def post_task_comment(
    task_id: int,
    payload: CommentCreateRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Post a comment to a task with project affiliation verification."""
    task_row = conn.execute("SELECT project_name FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı.")

    comment_text = payload.comment.strip()
    if not comment_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Yorum boş olamaz.")

    project_name = str(task_row["project_name"])
    user_id = current_user["user_id"]
    role = current_user["role"]

    effective_role = role
    if role == "student":
        stu_check = conn.execute(
            "SELECT 1 FROM students WHERE project_name = ? AND student_no = ?",
            (project_name, user_id),
        ).fetchone()
        if not stu_check:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu projeye ait görevlere yorum yapma yetkiniz yok.",
            )
        leader_sno = get_leader(conn, project_name)
        if leader_sno == user_id:
            effective_role = "leader"
    elif role == "advisor":
        effective_role = "advisor"
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz rol.")

    ok, msg = add_task_comment(
        conn=conn,
        task_id=task_id,
        project_name=project_name,
        author_id=user_id,
        author_role=effective_role,
        comment=comment_text,
    )
    if not ok:
        if "yetkisiz" in msg.lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"message": "Yorum eklendi."}
