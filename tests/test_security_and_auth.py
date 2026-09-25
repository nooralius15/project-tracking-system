"""
test_security_and_auth.py - Unit tests for security, cryptography, and authentication helpers.
Covers:
- PBKDF2-HMAC-SHA256 password hashing, salting, custom iterations, and tamper resilience.
- HMAC-SHA256 cookie signing, payload verification, and forgery detection.
- Per-user rate limiting, lockout thresholds, key normalisation, and time-based recovery.
- Session timeout and inactivity lifecycle tracking.
"""
from __future__ import annotations

import time

import pytest

import security
from constants import (
    LOCKOUT_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    SESSION_TIMEOUT_MINUTES,
)
from security import (
    check_inactivity_timeout,
    check_rate_limit,
    check_session_timeout,
    clear_login_attempts,
    mark_session_start,
    record_failed_login,
    sign_cookie,
    touch_session,
    verify_cookie,
)
from utils import hash_password, verify_password

# ═════════════════════════════════════════════════════════════════════════════
# Password Hashing and Verification
# ═════════════════════════════════════════════════════════════════════════════

class TestPasswordHashing:
    def test_hash_format_and_algorithm(self):
        encoded = hash_password("SuperSecret123!", iterations=1000)
        parts = encoded.split("$")
        assert len(parts) == 4
        algo, iterations, salt_hex, digest_hex = parts
        assert algo == "pbkdf2_sha256"
        assert int(iterations) == 1000
        assert len(bytes.fromhex(salt_hex)) == 16
        assert len(bytes.fromhex(digest_hex)) == 32  # SHA-256 output is 32 bytes

    def test_unique_salts_produce_different_hashes(self):
        password = "IdenticalPassword999"
        hash1 = hash_password(password, iterations=1000)
        hash2 = hash_password(password, iterations=1000)
        assert hash1 != hash2, "Salting must produce unique outputs for identical inputs"

    def test_verify_password_success(self):
        password = "CorrectHorseBatteryStaple!"
        encoded = hash_password(password, iterations=1000)
        assert verify_password(password, encoded) is True

    def test_verify_password_wrong_password(self):
        encoded = hash_password("CorrectPassword", iterations=1000)
        assert verify_password("WrongPassword", encoded) is False

    def test_verify_password_empty_password(self):
        encoded = hash_password("", iterations=1000)
        assert verify_password("", encoded) is True
        assert verify_password("something_else", encoded) is False

    @pytest.mark.parametrize(
        "malformed_hash",
        [
            "",
            "plain_text_password",
            "pbkdf2_sha256",
            "pbkdf2_sha256$1000",
            "pbkdf2_sha256$1000$salt",
            "unsupported_algo$1000$deadbeef$feedface",
            "pbkdf2_sha256$not_an_int$deadbeef$feedface",
            "pbkdf2_sha256$1000$not_valid_hex$deadbeef",
            "pbkdf2_sha256$1000$deadbeef$not_valid_hex",
        ],
    )
    def test_verify_password_malformed_hashes_fail_gracefully(self, malformed_hash: str):
        # Must return False rather than raising an uncaught exception
        assert verify_password("any_password", malformed_hash) is False


# ═════════════════════════════════════════════════════════════════════════════
# Cookie Signing & HMAC Verification
# ═════════════════════════════════════════════════════════════════════════════

class TestCookieSigning:
    def test_sign_and_verify_roundtrip(self):
        payload = "advisor:dr_ufuk_asil:1710000000"
        signed = sign_cookie(payload)
        assert signed.startswith(payload + "|")
        verified = verify_cookie(signed)
        assert verified == payload

    def test_cookie_signature_length(self):
        signed = sign_cookie("student_123")
        value, sig = signed.rsplit("|", 1)
        assert value == "student_123"
        assert len(sig) == 16

    def test_verify_tampered_payload_returns_none(self):
        signed = sign_cookie("original_payload")
        tampered = "tampered_payload|" + signed.split("|")[1]
        assert verify_cookie(tampered) is None

    def test_verify_tampered_signature_returns_none(self):
        signed = sign_cookie("original_payload")
        tampered = signed[:-1] + ("0" if signed[-1] != "0" else "1")
        assert verify_cookie(tampered) is None

    def test_cookie_with_pipes_in_payload(self):
        payload = "part1|part2|part3"
        signed = sign_cookie(payload)
        assert verify_cookie(signed) == payload

    @pytest.mark.parametrize("invalid_cookie", ["", None, "nosig", "invalid|sig|extra|part"])
    def test_verify_cookie_invalid_inputs(self, invalid_cookie):
        assert verify_cookie(invalid_cookie) is None

    def test_verify_fails_with_different_secret(self, monkeypatch):
        signed = sign_cookie("session_data")
        monkeypatch.setattr(security, "COOKIE_SECRET", "completely_different_secret")
        assert verify_cookie(signed) is None


# ═════════════════════════════════════════════════════════════════════════════
# Rate Limiting & Lockout Logic
# ═════════════════════════════════════════════════════════════════════════════

class TestRateLimiting:
    def test_initial_state_allowed(self):
        allowed, msg = check_rate_limit("user123")
        assert allowed is True
        assert msg == ""

    def test_attempts_under_threshold_allowed(self):
        user = "test_student"
        for _ in range(MAX_LOGIN_ATTEMPTS - 1):
            record_failed_login(user)
            allowed, _ = check_rate_limit(user)
            assert allowed is True

    def test_lockout_triggered_at_threshold(self):
        user = "victim_user"
        for _ in range(MAX_LOGIN_ATTEMPTS):
            record_failed_login(user)

        allowed, msg = check_rate_limit(user)
        assert allowed is False
        assert f"{LOCKOUT_MINUTES} dakika" in msg

    def test_rate_limit_key_normalisation(self):
        # Case insensitive and strips whitespace
        record_failed_login("  STUDENT_ABC  ")
        record_failed_login("student_abc")
        record_failed_login("   STUDENT_ABC")
        record_failed_login("student_abc  ")
        record_failed_login("STUDENT_ABC")

        allowed, _ = check_rate_limit("student_abc")
        assert allowed is False
        allowed_upper, _ = check_rate_limit("  STUDENT_ABC  ")
        assert allowed_upper is False

    def test_clear_login_attempts_resets_lockout(self):
        user = "locked_user"
        for _ in range(MAX_LOGIN_ATTEMPTS):
            record_failed_login(user)

        assert check_rate_limit(user)[0] is False

        clear_login_attempts(user)
        allowed, msg = check_rate_limit(user)
        assert allowed is True
        assert msg == ""

    def test_lockout_expires_after_time_elapsed(self, monkeypatch):
        user = "timed_out_user"
        start_time = 1000.0
        monkeypatch.setattr(time, "time", lambda: start_time)

        for _ in range(MAX_LOGIN_ATTEMPTS):
            record_failed_login(user)

        assert check_rate_limit(user)[0] is False

        # Advance time by LOCKOUT_MINUTES * 60 + 1 second
        monkeypatch.setattr(time, "time", lambda: start_time + (LOCKOUT_MINUTES * 60) + 1)

        allowed, msg = check_rate_limit(user)
        assert allowed is True
        assert msg == ""
        # Ensure record was cleaned up from internal dictionary
        assert user not in security._login_attempts


# ═════════════════════════════════════════════════════════════════════════════
# Session Lifecycle & Timeout Tracking
# ═════════════════════════════════════════════════════════════════════════════

class TestSessionLifecycle:
    def test_session_timeout_not_started(self, monkeypatch):
        mock_state: dict = {}
        monkeypatch.setattr(security.st, "session_state", mock_state)
        assert check_session_timeout() is False
        assert check_inactivity_timeout() is False

    def test_session_lifecycle_flow(self, monkeypatch):
        mock_state: dict = {}
        monkeypatch.setattr(security.st, "session_state", mock_state)

        base_time = 10000.0
        monkeypatch.setattr(time, "time", lambda: base_time)

        mark_session_start()
        assert mock_state["_session_created_at"] == base_time
        assert mock_state["_session_last_activity"] == base_time
        assert check_session_timeout() is False
        assert check_inactivity_timeout() is False

        # User interacts at base_time + 10 minutes
        monkeypatch.setattr(time, "time", lambda: base_time + 600)
        touch_session()
        assert mock_state["_session_last_activity"] == base_time + 600
        assert check_inactivity_timeout() is False

        # Exceed session timeout (base_time + (SESSION_TIMEOUT_MINUTES * 60) + 10)
        monkeypatch.setattr(
            time, "time", lambda: base_time + (SESSION_TIMEOUT_MINUTES * 60) + 10
        )
        assert check_session_timeout() is True
