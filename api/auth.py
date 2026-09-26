"""
api/auth.py
Authentication endpoints: login, session profile, password change, account activation.
"""
from __future__ import annotations

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import create_access_token, get_current_user, get_db, require_role
from api.schemas import (
    ActivateAccountRequest,
    AdvisorOption,
    ChangePasswordRequest,
    LoginRequest,
    ResetPasswordToDefaultRequest,
    TokenResponse,
    UserResponse,
)
from db import fetch_df
from models import (
    activate_account_with_token,
    authenticate_user,
    reset_password_to_default,
    update_password,
)
from security import (
    check_rate_limit,
    clear_login_attempts,
    record_failed_login,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/advisors", response_model=List[AdvisorOption])
def list_advisors_for_login(conn=Depends(get_db)):
    """List active advisor names and user IDs for the login dropdown."""
    df = fetch_df(
        conn,
        "SELECT user_id, display_name FROM auth_users WHERE role = 'advisor' AND is_active = 1 ORDER BY display_name",
    )
    return [
        AdvisorOption(user_id=str(row["user_id"]), display_name=str(row["display_name"]))
        for _, row in df.iterrows()
    ]


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, conn=Depends(get_db)):
    """Authenticate with user_id, role and password; return signed JWT bearer token."""
    user_id = payload.user_id.strip()
    role = payload.role.strip().lower()

    if role not in ("advisor", "student"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz kullanıcı rolü. 'advisor' veya 'student' olmalıdır.",
        )

    # Rate limiting check
    allowed, lock_msg = check_rate_limit(user_id)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=lock_msg or "Çok fazla başarısız giriş denemesi. Lütfen bekleyin.",
        )

    auth = authenticate_user(conn, user_id=user_id, role=role, password=payload.password)
    if not auth:
        record_failed_login(user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Giriş bilgileri geçersiz.",
        )

    clear_login_attempts(user_id)
    token = create_access_token({"sub": auth["user_id"], "role": auth["role"]})

    from utils import is_admin_advisor
    user_resp = UserResponse(
        user_id=auth["user_id"],
        role=auth["role"],
        display_name=auth["display_name"],
        force_password_change=bool(auth.get("force_password_change", 0)),
        is_active=bool(auth.get("is_active", 1)),
        is_admin=is_admin_advisor(auth["user_id"]),
    )
    return TokenResponse(access_token=token, token_type="bearer", user=user_resp)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    """Get the currently logged-in user profile."""
    return UserResponse(
        user_id=current_user["user_id"],
        role=current_user["role"],
        display_name=current_user["display_name"],
        force_password_change=bool(current_user.get("force_password_change", 0)),
        is_active=bool(current_user.get("is_active", 1)),
        is_admin=bool(current_user.get("is_admin", False)),
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db),
):
    """Update password and clear mandatory password change flag."""
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Şifreler eşleşmiyor.",
        )
    update_password(conn, current_user["user_id"], current_user["role"], payload.new_password)
    return {"message": "Şifreniz başarıyla güncellendi."}


@router.post("/activate")
def activate_account(payload: ActivateAccountRequest, conn=Depends(get_db)):
    """First-time onboarding using a one-time activation token."""
    ok, msg = activate_account_with_token(
        conn,
        user_id=payload.user_id,
        role=payload.role,
        token=payload.token,
        new_password=payload.new_password,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return {"message": msg}


@router.get("/users-for-reset")
def get_users_for_reset(
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """List students and advisors available for password reset (Advisor only)."""
    students_df = fetch_df(
        conn,
        "SELECT DISTINCT student_no, student_name, project_name FROM students ORDER BY student_name",
    )
    advisors_df = fetch_df(
        conn,
        "SELECT user_id, display_name FROM auth_users WHERE role = 'advisor' AND is_active = 1 ORDER BY display_name",
    )

    students = [
        {"user_id": str(r["student_no"]), "display_name": f"{r['student_name']} ({r['student_no']})", "project_name": str(r["project_name"])}
        for _, r in students_df.iterrows()
    ]
    advisors = [
        {"user_id": str(r["user_id"]), "display_name": str(r["display_name"])}
        for _, r in advisors_df.iterrows()
    ]
    return {"students": students, "advisors": advisors}


@router.post("/reset-password-to-default")
def reset_password_endpoint(
    payload: ResetPasswordToDefaultRequest,
    current_user: dict = Depends(require_role(["advisor"])),
    conn=Depends(get_db),
):
    """Reset a user's password to default 12345 with mandatory change on first login (Advisor only)."""
    role = payload.role.strip().lower()
    if role not in ("student", "advisor"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz rol.")

    ok = reset_password_to_default(conn, payload.user_id.strip(), role)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")
    return {"message": f"{payload.user_id} kullanıcısının şifresi '12345' olarak sıfırlandı."}

