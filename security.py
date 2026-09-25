"""
security.py
Security utilities: rate limiting, session expiry, cookie signing.
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

import streamlit as st

from constants import (
    COOKIE_SECRET,
    LOCKOUT_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    SESSION_TIMEOUT_MINUTES,
)

# ── In-memory login attempt tracker (per-process) ─────────────────────────────
# Structure: { user_id: { "attempts": int, "locked_until": float } }
_login_attempts: dict[str, dict] = {}


# ── Rate Limiting ─────────────────────────────────────────────────────────────

def check_rate_limit(user_id: str) -> tuple[bool, str]:
    """Return (allowed, message). If locked out, allowed=False."""
    key = user_id.strip().lower()
    record = _login_attempts.get(key)
    if not record:
        return True, ""
    locked_until = record.get("locked_until", 0)
    if locked_until > time.time():
        remaining = int((locked_until - time.time()) / 60) + 1
        return False, f"Çok fazla başarısız giriş. {remaining} dakika sonra tekrar deneyin."
    # Reset if lockout has expired
    if record.get("attempts", 0) >= MAX_LOGIN_ATTEMPTS and locked_until <= time.time():
        _login_attempts.pop(key, None)
    return True, ""


def record_failed_login(user_id: str) -> None:
    """Increment failed attempt counter; lock out after MAX_LOGIN_ATTEMPTS."""
    key = user_id.strip().lower()
    record = _login_attempts.setdefault(key, {"attempts": 0, "locked_until": 0})
    record["attempts"] = record.get("attempts", 0) + 1
    if record["attempts"] >= MAX_LOGIN_ATTEMPTS:
        record["locked_until"] = time.time() + (LOCKOUT_MINUTES * 60)


def clear_login_attempts(user_id: str) -> None:
    """Clear attempt counter on successful login."""
    key = user_id.strip().lower()
    _login_attempts.pop(key, None)


# ── Session Timeout ───────────────────────────────────────────────────────────

def check_session_timeout() -> bool:
    """Return True if the current session has expired."""
    created = st.session_state.get("_session_created_at")
    if not created:
        return False
    elapsed = time.time() - created
    return elapsed > (SESSION_TIMEOUT_MINUTES * 60)


def mark_session_start() -> None:
    """Record the session start time."""
    st.session_state["_session_created_at"] = time.time()
    st.session_state["_session_last_activity"] = time.time()


def touch_session() -> None:
    """Update the last activity timestamp (call on each interaction)."""
    st.session_state["_session_last_activity"] = time.time()


def check_inactivity_timeout() -> bool:
    """Return True if the user has been inactive beyond SESSION_TIMEOUT_MINUTES."""
    last = st.session_state.get("_session_last_activity")
    if not last:
        return False
    elapsed = time.time() - last
    return elapsed > (SESSION_TIMEOUT_MINUTES * 60)


# ── Cookie Signing ────────────────────────────────────────────────────────────

def sign_cookie(value: str) -> str:
    """Return 'value|signature' for tamper detection."""
    sig = hmac.new(
        COOKIE_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]
    return f"{value}|{sig}"


def verify_cookie(signed_value: str) -> Optional[str]:
    """Verify the signed cookie value. Return the original value or None."""
    if not signed_value or "|" not in signed_value:
        return None
    parts = signed_value.rsplit("|", 1)
    if len(parts) != 2:
        return None
    value, sig = parts
    expected = hmac.new(
        COOKIE_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:16]
    if hmac.compare_digest(sig, expected):
        return value
    return None


# ── Activation & Invitation Tokens ──────────────────────────────────────────

def generate_activation_token(prefix: str = "OTU") -> str:
    """Generate a cryptographically secure, human-readable activation token.
    Example format: OTU-A1B2-C3D4
    """
    import secrets
    part1 = secrets.token_hex(2).upper()
    part2 = secrets.token_hex(2).upper()
    return f"{prefix}-{part1}-{part2}"

