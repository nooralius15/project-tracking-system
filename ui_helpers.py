"""
ui_helpers.py
Shared HTML rendering helpers used across all panels.
All user-visible labels are run through translate_text() so they respond to
the language selector without any additional work from callers.
"""
from __future__ import annotations

import html as _html
from typing import Optional

import streamlit as st

# translate_text is imported lazily to avoid a circular import at module load
# (i18n imports constants which is fine, but let's keep it explicit).
def _t(s: str) -> str:
    """Translate a string through the i18n system (safe to call before patching)."""
    try:
        from i18n import translate_text
        return translate_text(s)
    except Exception:
        return s


def _e(s: str) -> str:
    """HTML-escape arbitrary user content so it never breaks the surrounding markup."""
    return _html.escape(str(s) if s is not None else "")


# ── Section header ─────────────────────────────────────────────────────────────

def section_header(icon: str, title: str, subtitle: str = "") -> None:
    """Styled section divider using pure Streamlit — no raw HTML."""
    t_title = _t(title)
    t_sub = _t(subtitle) if subtitle else ""
    sub_html = (
        f"<span class='dm-section-sub' style='font-size:0.74rem;margin-left:0.4rem;'>— {_e(t_sub)}</span>"
        if t_sub
        else ""
    )
    st.markdown(
        f"<div style='margin-top:1.25rem;padding-bottom:0.45rem;"
        f"border-bottom:2px solid var(--border, #e2e8f0);display:flex;align-items:center;gap:0.5rem;'>"
        f"<span style='font-size:1.2rem;'>{icon}</span>"
        f"<span class='dm-section-title' style='font-size:1rem;font-weight:700;'>{_e(t_title)}</span>"
        f"{sub_html}"
        f"</div>",
        unsafe_allow_html=True,
    )


# ── Status / priority / risk badge HTML ───────────────────────────────────────

_STATUS_BADGE: dict[str, tuple[str, str, str, str]] = {
    # status: (bg, color, tr_label, en_label)
    "TODO":  ("#e2e8f0", "#475569", "Yapılacak",    "To Do"),
    "DOING": ("#dbeafe", "#1d4ed8", "Devam Ediyor", "In Progress"),
    "DONE":  ("#dcfce7", "#16a34a", "Tamamlandı",   "Done"),
}

_PRIORITY_BADGE: dict[str, tuple[str, str, str]] = {
    "Dusuk":  ("#dcfce7", "#166534", "↓"),
    "Orta":   ("#fef3c7", "#92400e", "→"),
    "Yuksek": ("#fee2e2", "#991b1b", "↑"),
}

_RISK_BADGE: dict[str, tuple[str, str, str]] = {
    "Dusuk":  ("#dcfce7", "#166534", "🟢"),
    "Orta":   ("#fef3c7", "#92400e", "🟡"),
    "Yuksek": ("#fee2e2", "#991b1b", "🔴"),
}


def status_badge_html(status: str) -> str:
    bg, color, tr_label, en_label = _STATUS_BADGE.get(status, ("#f1f5f9", "#334155", status, status))
    try:
        from i18n import is_english_ui
        label = en_label if is_english_ui() else tr_label
    except Exception:
        label = tr_label
    return (
        f'<span style="background:{bg};color:{color};border-radius:999px;'
        f'padding:0.15em 0.65em;font-size:0.7rem;font-weight:700;'
        f'display:inline-block;white-space:nowrap;">{_e(label)}</span>'
    )


def priority_badge_html(priority: str) -> str:
    bg, color, icon = _PRIORITY_BADGE.get(priority, ("#f1f5f9", "#334155", "•"))
    label = _t(priority)
    return (
        f'<span style="background:{bg};color:{color};border-radius:999px;'
        f'padding:0.15em 0.65em;font-size:0.7rem;font-weight:700;'
        f'display:inline-block;">{icon} {_e(label)}</span>'
    )


def risk_badge_html(risk: str) -> str:
    bg, color, icon = _RISK_BADGE.get(risk, ("#f1f5f9", "#334155", "⚪"))
    label = _t(risk)
    return (
        f'<span style="background:{bg};color:{color};border-radius:999px;'
        f'padding:0.15em 0.65em;font-size:0.7rem;font-weight:700;'
        f'display:inline-block;">{icon} {_e(label)}</span>'
    )


# ── Project summary card grid ──────────────────────────────────────────────────

def render_project_cards(projects_data: list[dict], selected_project: str | None = None) -> None:
    lbl_members = _t("üye")
    lbl_overdue = _t("geciken")

    cards_per_row = 3
    for i in range(0, len(projects_data), cards_per_row):
        row_data = projects_data[i : i + cards_per_row]
        cols = st.columns(len(row_data))
        for col, proj in zip(cols, row_data):
            pct = float(proj.get("completion", 0))
            bar_color = "#16a34a" if pct >= 80 else "#0f4c81" if pct >= 40 else "#d97706"
            is_selected = proj["name"] == selected_project
            border = "2px solid var(--primary, #0f4c81)" if is_selected else "1px solid var(--border, #e2e8f0)"
            overdue = proj.get("overdue", 0)
            overdue_html = (
                f'<span style="background:var(--danger-bg, #fee2e2);color:var(--danger, #991b1b);border-radius:999px;'
                f'padding:.15em .6em;font-size:.7rem;font-weight:700;">⏰ {overdue} {_e(lbl_overdue)}</span>'
                if overdue > 0 else ""
            )
            risk_html = risk_badge_html(proj.get("risk", "Orta"))
            badges_html = risk_html + ("&nbsp;" + overdue_html if overdue_html else "")
            card_html = (
                '<div class="dm-card" style="border:' + border + ';">'
                '<div class="dm-text-primary" style="font-size:0.82rem;font-weight:700;'
                'margin-bottom:0.3rem;white-space:nowrap;overflow:hidden;'
                'text-overflow:ellipsis;" title="' + _e(proj["name"]) + '">'
                '📁 ' + _e(proj["name"]) + '</div>'
                '<div class="dm-text-muted" style="font-size:0.72rem;margin-bottom:0.5rem;">'
                '👑 ' + _e(proj.get("leader", "-")) + ' &nbsp;·&nbsp; 👥 '
                + str(proj.get("members", 0)) + ' ' + _e(lbl_members) + '</div>'
                '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">'
                '<div style="flex:1;background:var(--border, #e2e8f0);border-radius:999px;height:7px;overflow:hidden;">'
                '<div style="background:' + bar_color + ';height:100%;width:' + str(pct)
                + '%;border-radius:999px;transition:width .5s;"></div></div>'
                '<span style="font-size:0.72rem;font-weight:700;color:' + bar_color
                + ';min-width:32px;">%' + str(int(pct)) + '</span></div>'
                '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'
                + badges_html + '</div></div>'
            )
            col.markdown(card_html, unsafe_allow_html=True)


# ── Active task highlight card ─────────────────────────────────────────────────

def render_active_task_card(task_row, milestone_label: str) -> None:
    status = str(task_row.get("status", "TODO"))
    priority = str(task_row.get("priority", "Orta"))
    deadline = str(task_row.get("deadline", "") or "")
    title = _e(str(task_row.get("title", "")))
    desc_raw = str(task_row.get("description", "") or "")
    desc = _e(desc_raw)                       # ← always escape user content
    m_label = _e(_t(str(milestone_label)))

    dl_html = ""
    if deadline:
        dl_html = f'&nbsp;·&nbsp; 📅 <strong style="color:#dc2626;">{_e(deadline)}</strong>'

    desc_html = (
        f'<div style="font-size:0.8rem;color:var(--text-color,#475569);line-height:1.5;'
        f'border-top:1px solid #cbd5e1;padding-top:0.4rem;margin-top:0.4rem;">{desc}</div>'
        if desc_raw else ""
    )

    st.markdown(
        f"""
        <div class="dm-active-task">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;
                        gap:0.5rem;margin-bottom:0.5rem;">
                <div class="dm-text-primary" style="font-size:0.95rem;font-weight:700;line-height:1.3;">{title}</div>
                <div style="display:flex;gap:0.35rem;flex-shrink:0;">
                    {status_badge_html(status)}
                    {priority_badge_html(priority)}
                </div>
            </div>
            <div class="dm-text-secondary" style="font-size:0.75rem;margin-bottom:0.2rem;">
                🏁 <strong>{m_label}</strong>{dl_html}
            </div>
            {desc_html}
        </div>
        """,
        unsafe_allow_html=True,
    )


# ── Feedback card ──────────────────────────────────────────────────────────────

def render_feedback_card(fb_row) -> None:
    is_revision = bool(int(fb_row["revision_required"])) if fb_row.get("revision_required") else False
    border_color = "#dc2626" if is_revision else "#0f4c81"
    bg_color     = "#fff5f5" if is_revision else "#f8fafc"
    icon         = "🔴" if is_revision else "💬"
    date_str     = str(fb_row.get("created_at", ""))[:10]
    advisor      = str(fb_row.get("advisor_name", _t("Danışman")))
    feedback_txt = str(fb_row.get("feedback", ""))
    action       = str(fb_row.get("action_item", "") or "")

    rev_badge = (
        f"<span style='background:#fee2e2;color:#dc2626;border-radius:999px;padding:.1em .55em;font-size:.68rem;font-weight:700;'>{_e(_t('Revizyon'))}</span>"
        if is_revision
        else ""
    )
    header_html = (
        f"<div style='background:{bg_color};border-left:4px solid {border_color};"
        f"border-radius:0 8px 0 0;padding:0.45rem 0.85rem;display:flex;align-items:center;gap:0.5rem;'>"
        f"<span>{icon}</span>"
        f"<strong class='dm-text-primary' style='font-size:0.85rem;'>{_e(advisor)}</strong>"
        f"<span style='font-size:0.72rem;color:#94a3b8;margin-left:auto;'>{_e(date_str)}</span>"
        f"{rev_badge}"
        f"</div>"
    )
    action_html = (
        f"<div style='margin-top:.4rem;font-size:.74rem;color:var(--text-color,#475569);opacity:.8;background:rgba(128,128,128,.08);border-radius:5px;padding:.2rem .5rem;'>📌 <strong>{_e(_t('Aksiyon'))}:</strong> {_e(action)}</div>"
        if action
        else ""
    )
    body_html = (
        f"<div style='background:{bg_color};border-left:4px solid {border_color};"
        f"border-radius:0 0 8px 8px;padding:0.55rem 0.85rem 0.7rem;margin-bottom:0.5rem;'>"
        f"<div style='font-size:0.84rem;color:#334155;line-height:1.55;'>{_e(feedback_txt)}</div>"
        f"{action_html}"
        f"</div>"
    )
    st.markdown(header_html, unsafe_allow_html=True)
    st.markdown(body_html,   unsafe_allow_html=True)


# ── Member role table (HTML) ───────────────────────────────────────────────────

def render_member_table(project_members, roles_df, leader_no: str | None) -> None:
    th_no    = _e(_t("No"))
    th_name  = _e(_t("Ad Soyad"))
    th_role  = _e(_t("Rol"))
    th_task  = _e(_t("Görev"))

    rows_html = ""
    for _, m in project_members.sort_values("row_no").iterrows():
        sno = str(m["student_no"])
        sname = _e(str(m["student_name"]))
        role_row = roles_df[roles_df["student_no"] == sno]
        role = str(role_row.iloc[0]["role"]) if not role_row.empty else _t("Atanmadı")
        resp = _e(str(role_row.iloc[0]["responsibility"]) if not role_row.empty else "—")
        is_lead = leader_no and sno == str(leader_no)
        crown = "👑 " if is_lead else ""
        name_badge = f'<span style="font-weight:600;">{crown}{sname}</span>'
        rows_html += f"""
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:0.45rem 0.7rem;font-size:0.78rem;color:var(--text-color,#64748b);opacity:.7;">{_e(sno)}</td>
            <td style="padding:0.45rem 0.7rem;font-size:0.83rem;">{name_badge}</td>
            <td style="padding:0.45rem 0.7rem;">{_role_badge_html(role)}</td>
            <td style="padding:0.45rem 0.7rem;font-size:0.78rem;color:var(--text-color,#475569);opacity:.8;">{resp}</td>
        </tr>"""

    st.markdown(
        f"""
        <div style="border:1px solid var(--border, #e2e8f0);border-radius:10px;overflow:hidden;
                    box-shadow:0 1px 4px rgba(0,0,0,0.06);margin-bottom:0.75rem;">
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:var(--table-header-bg,#0a2342);">
                        <th class="dm-table-header">{th_no}</th>
                        <th class="dm-table-header">{th_name}</th>
                        <th class="dm-table-header">{th_role}</th>
                        <th class="dm-table-header">{th_task}</th>
                    </tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _role_badge_html(role: str) -> str:
    configs = {
        "Lider":     ("#fef3c7", "#92400e", "👑"),
        "Uye":       ("#dbeafe", "#1e40af", "👤"),
        "Yazilim":   ("#ede9fe", "#5b21b6", "💻"),
        "DevOps":    ("#fee2e2", "#991b1b", "⚙️"),
        "Test":      ("#d1fae5", "#065f46", "🧪"),
        "Veri":      ("#fce7f3", "#9d174d", "📊"),
        "Sunum":     ("#e0f2fe", "#0369a1", "🎤"),
        "Arastirma": ("#fef9c3", "#713f12", "🔬"),
        "Diger":     ("#f1f5f9", "#475569", "•"),
    }
    bg, color, icon = configs.get(role, ("#f1f5f9", "#475569", "•"))
    label = _e(_t(role))
    return (
        f'<span style="background:{bg};color:{color};border-radius:999px;'
        f'padding:0.12em 0.55em;font-size:0.7rem;font-weight:700;">{icon} {label}</span>'
    )


# ── AI Insight Card ────────────────────────────────────────────────────────────

def render_ai_insight_card(response_text: str, model_name: Optional[str] = None) -> None:
    """Display an AI-generated insight inside the aurora-bordered dark card."""
    import html as _html_module
    import re

    if not model_name or model_name == "llama3.2:3b":
        try:
            from ai_client import get_active_model_name
            model_name = get_active_model_name()
        except Exception:
            model_name = model_name or "AI Assistant"

    # Convert markdown-like bold **text** to <strong>
    formatted = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", response_text)
    # Convert bullet lines starting with • or - to list items
    lines = formatted.split("\n")
    html_lines = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(("• ", "- ", "* ")):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            item = stripped[2:].strip()
            html_lines.append(f"<li>{item}</li>")
        else:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            if stripped:
                html_lines.append(f"<p>{stripped}</p>")
    if in_list:
        html_lines.append("</ul>")
    body = "\n".join(html_lines)
    short_model = (
        model_name
        .replace(":latest", "")
        .replace("gemini-3-flash-preview", "Gemini Flash")
        .replace("gemini-1.5-flash", "Gemini 1.5 Flash")
        .replace("llama3.2:3b", "Llama 3.2")
        .replace("llama-3.3-70b-versatile", "Llama 3.3 (Groq)")
        .replace("Heuristic v1.0", "Akıllı Analiz")
    )
    card = (
        '<div class="ai-insight-card">'
        '<div class="ai-header">'
        '<span class="ai-header-icon">🤖</span>'
        '<span class="ai-header-title">AI Analizi</span>'
        '<span class="ai-header-model">✨ ' + _html_module.escape(short_model) + '</span>'
        '</div>'
        + body +
        '</div>'
    )
    st.markdown(card, unsafe_allow_html=True)

