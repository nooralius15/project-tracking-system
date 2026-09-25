
from __future__ import annotations

import base64
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

import streamlit as st

# ── Logo paths ─────────────────────────────────────────────────────────────────
_LOGO_DIR = Path(__file__).parent / "img"
_LIGHT_LOGO = _LOGO_DIR / "lightlogo.png"   # dark text — for light backgrounds
_DARK_LOGO  = _LOGO_DIR / "darklogo.png"    # light text — for dark backgrounds


def _logo_b64(path: Path) -> str:
    """Return a base64-encoded data URI for a PNG image."""
    if not path.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()

from constants import DEFAULT_LANGUAGE, LANGUAGE_STATE_KEY, MIN_PASSWORD_LEN
from db import get_conn
from i18n import is_english_ui, patch_streamlit_i18n, render_language_selector
from models import (
    authenticate_user,
    bootstrap_defaults,
    ensure_database_synced,
    get_leader,
    get_roster_from_db,
    get_student_memberships,
    initialize_all_projects,
    student_count,
    sync_auth_users,
    update_password,
)
from security import (
    check_inactivity_timeout,
    check_rate_limit,
    clear_login_attempts,
    mark_session_start,
    record_failed_login,
    sign_cookie,
    touch_session,
    verify_cookie,
)
from ui_helpers import _t
from panels.advisor import render_advisor_panel
from panels.leader import render_leader_panel
from panels.student import render_student_panel
from styles import inject_styles
from utils import is_admin_advisor


# ── Auth session helpers ───────────────────────────────────────────────────────

def clear_auth_session(controller=None) -> None:
    st.session_state.pop("auth_user", None)
    st.session_state.pop("_sync_done", None)
    st.session_state.pop("_session_created_at", None)
    st.session_state.pop("_session_last_activity", None)
    st.session_state["_kill_cookies"] = True


def render_login_form(conn, controller=None) -> None:
    # Centred login card
    login_title = "Final Project Tracking System" if is_english_ui() else "Bitirme Proje Takip Sistemi"
    login_sub = "OSTIM Technical University · Software Engineering" if is_english_ui() else "OSTİM Teknik Üniversitesi · Yazılım Mühendisliği"
    light_logo_uri = _logo_b64(_LIGHT_LOGO)
    dark_logo_uri = _logo_b64(_DARK_LOGO)
    logo_html = (
        f'<img class="login-logo-light" src="{light_logo_uri}" alt="Logo" style="height:100px;margin:0 auto 0.5rem;display:block;"/>'
        f'<img class="login-logo-dark" src="{dark_logo_uri}" alt="Logo" style="height:100px;margin:0 auto 0.5rem;display:none;"/>'
    ) if light_logo_uri else '<div class="login-logo">🎓</div>'
    st.markdown(
        f"""
        <div class="login-wrapper">
            {logo_html}
            <div class="login-title">{login_title}</div>
            <div class="login-sub">{login_sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Narrow centred column for the form
    _, col, _ = st.columns([1, 2, 1])
    with col:
        role_label = st.selectbox(
            _t("Kullanici turu"),
            [f"🎓  {_t('Ogrenci')}", f"👨‍🏫  {_t('Danisman')}"],
            key="login_role",
        )
        role = "student" if _t("Ogrenci") in role_label else "advisor"

        if role == "student":
            user_id = st.text_input(_t("Ogrenci No"), placeholder="2001234567", key="login_student_no")
        else:
            from db import fetch_df
            advisor_df = fetch_df(
                conn,
                "SELECT user_id, display_name FROM auth_users WHERE role = 'advisor' AND is_active = 1 ORDER BY display_name",
            )
            if advisor_df.empty:
                st.error(_t("Aktif danisman kullanicisi bulunamadi."))
                return
            advisor_options = {str(row["display_name"]): str(row["user_id"]) for _, row in advisor_df.iterrows()}
            selected_label = st.selectbox(_t("Danisman"), list(advisor_options.keys()), key="login_advisor_select")
            user_id = advisor_options[selected_label]

        password = st.text_input(_t("Sifre"), type="password", placeholder="••••••••", key="login_password")
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button(_t("Giris yap") + " →", type="primary", width="stretch"):
            # Rate limiting check
            allowed, lock_msg = check_rate_limit(user_id.strip())
            if not allowed:
                st.error(_t(lock_msg) if lock_msg else _t("Çok fazla başarısız giriş denemesi."))
                return

            auth = authenticate_user(conn, user_id=user_id.strip(), role=role, password=password)
            if not auth:
                record_failed_login(user_id.strip())
                st.error(_t("Giris bilgileri gecersiz."))
                return

            clear_login_attempts(user_id.strip())
            st.session_state["auth_user"] = auth
            st.session_state["_needs_cookie"] = True
            mark_session_start()
            st.rerun()

        msg1 = _t("Ilk sifre tum kullanicilar icin 12345'tir. Ilk giriste sifre degistirme zorunludur.")
        st.markdown(
            f"<div style='text-align:center;margin-top:1rem;font-size:0.74rem;color:#94a3b8;'>"
            f"{msg1}"
            "</div>",
            unsafe_allow_html=True,
        )


def enforce_password_change(conn, auth_user: dict) -> bool:
    """Return True if the user must change their password (blocks further rendering)."""
    if not auth_user.get("force_password_change", False):
        return False

    st.warning(_t("Ilk giriste sifrenizi degistirmeniz gerekiyor."))
    with st.form("change_password_form"):
        new_password = st.text_input(_t("Yeni sifre"), type="password")
        confirm_password = st.text_input(_t("Yeni sifre (tekrar)"), type="password")
        submitted = st.form_submit_button(_t("Sifreyi guncelle"))

    if submitted:
        if len(new_password) < MIN_PASSWORD_LEN:
            st.error(_t("Sifre en az") + f" {MIN_PASSWORD_LEN} " + _t("karakter olmali."))
        elif new_password != confirm_password:
            st.error(_t("Sifreler eslesmiyor."))
        else:
            update_password(conn, auth_user["user_id"], auth_user["role"], new_password)
            auth_user["force_password_change"] = False
            st.session_state["auth_user"] = auth_user
            st.success(_t("Sifre guncellendi."))
            st.rerun()
    return True


# ── Page header HTML ───────────────────────────────────────────────────────────

def _render_header() -> None:
    """Render the fixed top header bar. CSS is handled by styles.py."""
    header_university = "OSTİM Technical University" if is_english_ui() else "OSTİM Teknik Üniversitesi"
    header_department = "Software Engineering Department" if is_english_ui() else "Yazılım Mühendisliği Bölümü"
    header_system = "Final Project Tracking System" if is_english_ui() else "Bitirme Proje Takip Sistemi"
    dark_logo_uri = _logo_b64(_DARK_LOGO)
    icon_html = (
        f'<img src="{dark_logo_uri}" alt="Logo" style="height:36px;flex-shrink:0;"/>'
        if dark_logo_uri else '<span class="otu-icon">🎓</span>'
    )
    st.markdown(
        f"""
        <div class="otu-header">
            {icon_html}
            <div class="otu-text-block">
                <span class="otu-uni">{header_university}</span>
                <span class="otu-dept">{header_department}</span>
            </div>
            <span class="otu-divider">{header_system}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ── Sidebar session box ───────────────────────────────────────────────────────

def _render_sidebar_session(auth_user: dict, extra_info: str = "") -> None:
    """Render the session info box in the sidebar with translated labels."""
    session_lbl = _t("Oturum")
    st.markdown(
        f"""
        <div style="background:rgba(255,255,255,0.07);border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:0.5rem;">
            <div style="font-size:0.7rem;color:#a8c8f0;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">{session_lbl}</div>
            <div style="font-size:0.88rem;font-weight:700;color:#fff;margin-top:0.2rem;">{auth_user['display_name']}</div>
            {extra_info}
        </div>
        """,
        unsafe_allow_html=True,
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    # Language default
    if LANGUAGE_STATE_KEY not in st.session_state:
        st.session_state[LANGUAGE_STATE_KEY] = DEFAULT_LANGUAGE

    # Page config (must be first Streamlit call)
    page_title = (
        "Final Project Tracking System | OSTIM Technical University"
        if is_english_ui()
        else "Bitirme Proje Takip | OSTİM Teknik Üniversitesi"
    )
    st.set_page_config(page_title=page_title, page_icon="🎓", layout="wide")

    # Inject professional CSS theme (must come early)
    inject_styles()

    from streamlit_cookies_controller import CookieController
    controller = CookieController()

    # ── Language cookie: read on startup ──────────────────────────────────────
    if not st.session_state.get("_lang_cookie_read"):
        saved_lang = controller.get("ui_language")
        if saved_lang and saved_lang in {"tr", "en"}:
            st.session_state[LANGUAGE_STATE_KEY] = saved_lang
        st.session_state["_lang_cookie_read"] = True

    if st.session_state.pop("_kill_cookies", False):
        controller.remove("auth_user_id")
        controller.remove("auth_user_role")

    # ── Language cookie: write on change ──────────────────────────────────────
    if st.session_state.pop("_needs_lang_cookie", False):
        controller.set("ui_language", st.session_state.get(LANGUAGE_STATE_KEY, DEFAULT_LANGUAGE), max_age=31536000)

    with st.sidebar:
        render_language_selector()

    patch_streamlit_i18n()
    _render_header()
    st.title(_t("🗂️ Bitirme Proje Takip Uygulaması"))

    # ── DB setup ──────────────────────────────────────────────────────────────
    db_path = "project_tracker.db"
    with st.sidebar:
        st.caption(f"{_t('Veritabani:')} {db_path}")
    conn = get_conn(db_path)

    # Guarded database bootstrap & sync: runs once on startup or after explicit updates
    if not ensure_database_synced(conn):
        st.error(_t("SQLite ogrenci kaydi yok. Uygulama yalnizca SQLite verisi ile calisir."))
        return


    # ── Auth routing ───────────────────────────────────────────────────────────
    auth_user = st.session_state.get("auth_user")
    
    if not auth_user:
        cookie_user_id_signed = controller.get("auth_user_id")
        cookie_user_role_signed = controller.get("auth_user_role")
        cookie_user_id = verify_cookie(str(cookie_user_id_signed)) if cookie_user_id_signed else None
        cookie_user_role = verify_cookie(str(cookie_user_role_signed)) if cookie_user_role_signed else None
        if cookie_user_id and cookie_user_role:
            row = conn.execute(
                "SELECT * FROM auth_users WHERE user_id = ? AND role = ? AND is_active = 1",
                (cookie_user_id, cookie_user_role)
            ).fetchone()
            if row:
                auth_user = dict(row)
                st.session_state["auth_user"] = auth_user
                mark_session_start()

    if not auth_user:
        render_login_form(conn, controller)
        return

    # ── Session timeout check ─────────────────────────────────────────────────
    if check_inactivity_timeout():
        st.warning(_t("Oturum süresi doldu. Lütfen tekrar giriş yapın."))
        clear_auth_session(controller)
        st.rerun()
        return

    touch_session()

    if st.session_state.pop("_needs_cookie", False):
        controller.set("auth_user_id", sign_cookie(str(auth_user["user_id"])), max_age=600)
        controller.set("auth_user_role", sign_cookie(auth_user["role"]), max_age=600)

    if enforce_password_change(conn, auth_user):
        with st.sidebar:
            st.caption(f"{_t('Giris yapan:')} {auth_user['display_name']}")
            if st.button(_t("Cikis yap")):
                clear_auth_session(controller)
                st.rerun()
        return

    # ── Advisor branch ─────────────────────────────────────────────────────────
    if auth_user["role"] == "advisor":
        selected_advisor = auth_user["user_id"]
        admin_mode = is_admin_advisor(selected_advisor)
        roster = get_roster_from_db(conn, selected_advisor)
        with st.sidebar:
            role_badge = "🛡️ Admin" if admin_mode else f"👨‍🏫 {_t('Danisman')}"
            student_lbl = _t("öğrenci")
            project_lbl = _t("proje")
            extra = (
                f'<div style="font-size:0.73rem;color:#a8c8f0;margin-top:0.1rem;">{selected_advisor}</div>'
                f'<div style="margin-top:0.3rem;"><span style="background:{("rgba(255,215,0,0.25)" if admin_mode else "rgba(99,179,237,0.2)")};color:{("#ffd700" if admin_mode else "#90cdf4")};border-radius:999px;padding:0.1em 0.6em;font-size:0.7rem;font-weight:700;">{role_badge}</span></div>'
                f'<div style="margin-top:0.4rem;font-size:0.73rem;color:#a8c8f0;">👥 {len(roster)} {student_lbl} &nbsp;·&nbsp; 📁 {roster["project_name"].nunique() if not roster.empty else 0} {project_lbl}</div>'
            )
            _render_sidebar_session(auth_user, extra)
            reset = False
            if admin_mode:
                with st.expander(_t("⚠️ Veritabani sifirlama (tehlikeli)")):
                    st.warning(_t("Bu islem tum verileri silecektir!"))
                    confirm_reset = st.checkbox(_t("Veritabanini silmek istedigimden eminim"), key="reset_confirm")
                    reset = st.button(_t("Veritabanini sifirla"), disabled=not confirm_reset)
            if st.button(f"🚪 {_t('Cikis yap')}", width="stretch"):
                clear_auth_session(controller)
                st.rerun()

        if reset:
            db_file = Path(db_path)
            backup_name = f"project_tracker.{datetime.now().strftime('%Y%m%d_%H%M%S')}.backup.db"
            if db_file.exists():
                shutil.copy2(db_file, db_file.parent / backup_name)
                db_file.unlink()
            st.cache_resource.clear()
            st.cache_data.clear()
            clear_auth_session(controller)
            st.success(f"{_t('Veritabani sifirlandi. Yedek:')} {backup_name}")
            st.rerun()

        render_advisor_panel(conn, selected_advisor, roster)
        _render_ai_chat_sidebar(role="advisor", display_name=selected_advisor)
        return

    # ── Student branch ─────────────────────────────────────────────────────────
    student_no = auth_user["user_id"]
    memberships = get_student_memberships(conn, student_no)
    if memberships.empty:
        st.error(_t("Bu ogrenci numarasi icin kayit bulunamadi."))
        with st.sidebar:
            if st.button(_t("Cikis yap")):
                clear_auth_session(controller)
                st.rerun()
        return

    project_labels = [
        f"{row['project_name']} ({_t('Danisman')}: {row['advisor_name']})"
        for _, row in memberships.iterrows()
    ]
    selected_idx = 0
    if len(project_labels) > 1:
        selected_project_label = st.selectbox(_t("Projelerim"), project_labels)
        selected_idx = project_labels.index(selected_project_label)

    selected_membership = memberships.iloc[selected_idx]
    selected_project = str(selected_membership["project_name"])
    selected_advisor = str(selected_membership["advisor_name"])
    advisor_roster = get_roster_from_db(conn, selected_advisor)
    project_roster = advisor_roster[advisor_roster["project_name"] == selected_project].copy()

    is_leader = get_leader(conn, selected_project) == student_no
    role_label = f"👑 {_t('Lider')}" if is_leader else f"🎓 {_t('Uye')}"
    with st.sidebar:
        extra = (
            f'<div style="font-size:0.73rem;color:#a8c8f0;margin-top:0.1rem;">{student_no}</div>'
            f'<div style="margin-top:0.3rem;"><span style="background:rgba(99,179,237,0.2);color:#90cdf4;border-radius:999px;padding:0.1em 0.6em;font-size:0.7rem;font-weight:700;">{role_label}</span></div>'
            f'<div style="margin-top:0.4rem;font-size:0.73rem;color:#a8c8f0;">📁 {selected_project}</div>'
            f'<div style="font-size:0.7rem;color:#7ab3e0;">👨‍🏫 {selected_advisor}</div>'
        )
        _render_sidebar_session(auth_user, extra)
        if st.button(f"🚪 {_t('Cikis yap')}", width="stretch"):
            clear_auth_session(controller)
            st.rerun()

    # ── Route by role ─────────────────────────────────────────────────────────
    if is_leader:
        render_leader_panel(
            conn, project_roster,
            fixed_project_name=selected_project,
            fixed_leader_no=student_no,
        )
    else:
        render_student_panel(
            conn, advisor_roster,
            fixed_student_no=student_no,
            fixed_project_name=selected_project,
        )

    # ── Floating AI Chat (available to all roles) ──────────────────────────────
    _role = "leader" if is_leader else "student"
    _render_ai_chat_sidebar(role=_role, display_name=auth_user["display_name"], project_name=selected_project)


def _render_ai_chat_sidebar(role: str, display_name: str, project_name: str = "") -> None:
    """Render the AI chat assistant in the sidebar (available to all roles)."""
    from ai_client import chat, get_chat_system_prompt, _get_ui_lang, get_ai_service_badge

    lang = _get_ui_lang()
    lang_label = "🇬🇧 EN" if lang == "en" else "🇹🇷 TR"
    chat_title = f"🤖 AI {'Assistant' if lang == 'en' else 'Asistan'}  {lang_label}"
    placeholder_text = "Ask something..." if lang == "en" else "Bir şey sor..."
    clear_label = "🗑️ Clear chat" if lang == "en" else "🗑️ Sohbeti Temizle"
    thinking_label = "🤖 Thinking..." if lang == "en" else "🤖 Düşünüyor..."
    model_label = get_ai_service_badge()

    with st.sidebar:
        st.markdown("---")
        with st.expander(chat_title, expanded=False):
            st.markdown(
                f'<div style="font-size:0.72rem;color:#a78bfa;font-weight:700;'
                f'text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;">'
                f'{model_label}</div>',
                unsafe_allow_html=True,
            )

            # Init chat history
            if "ai_chat_history" not in st.session_state:
                st.session_state["ai_chat_history"] = []

            # Display message history
            for msg in st.session_state["ai_chat_history"]:
                with st.chat_message(msg["role"]):
                    st.markdown(msg["content"])

            # Clear chat button
            if st.session_state["ai_chat_history"]:
                if st.button(clear_label, key="ai_chat_clear"):
                    st.session_state["ai_chat_history"] = []
                    st.rerun()

            # Message input
            user_input = st.chat_input(placeholder_text, key="ai_chat_input")
            if user_input:
                st.session_state["ai_chat_history"].append(
                    {"role": "user", "content": user_input}
                )
                system_prompt = get_chat_system_prompt(role, display_name, project_name, lang=lang)
                messages = [{"role": "system", "content": system_prompt}] + \
                           st.session_state["ai_chat_history"]
                with st.spinner(thinking_label):
                    reply = chat(messages)
                st.session_state["ai_chat_history"].append(
                    {"role": "assistant", "content": reply}
                )
                st.rerun()




if __name__ == "__main__":
    main()
