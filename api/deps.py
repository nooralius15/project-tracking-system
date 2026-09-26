"""
api/deps.py
FastAPI dependency injection: database connection, JWT token verification, role enforcement.
"""
from __future__ import annotations

import datetime
from typing import Generator, List, Optional
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from constants import COOKIE_SECRET, DB_PATH
from db import get_conn
from utils import is_admin_advisor

# JWT settings (RFC 7518 mandates >= 32 bytes for HS256)
_raw_secret = COOKIE_SECRET or "capstone-tracker-jwt-secret-key-32ch"
JWT_SECRET = (_raw_secret + "-secure-hs256-jwt-signature-key-2026")[:64]
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

security_bearer = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (
        expires_delta or datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def get_db():
    conn = get_conn(DB_PATH)
    try:
        yield conn
    finally:
        pass


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    conn=Depends(get_db),
) -> dict:
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kimlik doğrulaması gerekli.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(auth.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    role = payload.get("role")
    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kimlik bilgisi.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    row = conn.execute(
        "SELECT * FROM auth_users WHERE lower(user_id) = lower(?) AND role = ? AND is_active = 1",
        (str(user_id), str(role)),
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı bulunamadı veya pasif durumda.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = dict(row)
    user["is_admin"] = is_admin_advisor(user["user_id"])
    return user


def require_role(allowed_roles: List[str]):
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Yetkisiz işlem: Bu kaynak için '{allowed_roles}' rollerinden biri gereklidir.",
            )
        return current_user
    return role_checker
