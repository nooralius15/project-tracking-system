"""
styles.py
Professional CSS theme for the Bitirme Proje Takip application.
Call inject_styles() once at app startup (in main()).
"""
from __future__ import annotations

import streamlit as st
import streamlit.components.v1 as components


# Button CSS injected via JS so it persists after Streamlit re-renders
# This specifically targets Streamlit's Emotion-generated button classes
_BUTTON_PERSISTENT_CSS = """
.stButton > button,
[data-testid^="stBaseButton"] {
    background: #001f5b !important;
    color: #ffffff !important;
    border: 1px solid rgba(0, 47, 135, 0.5) !important;
}
.stButton > button:hover,
[data-testid^="stBaseButton"]:hover {
    background: #002d6e !important;
    border-color: rgba(0, 80, 180, 0.7) !important;
    color: #ffffff !important;
}
.stButton > button[kind="primary"],
[data-testid="stBaseButton-primary"],
[data-testid="stFormSubmitButton"] > button {
    background: #001f5b !important;
    color: #fff !important;
    border: 1px solid rgba(0, 47, 135, 0.5) !important;
    box-shadow: 0 1px 3px rgba(0, 31, 91, 0.4) !important;
    font-weight: 600 !important;
}
.stButton > button[kind="primary"]:hover,
[data-testid="stBaseButton-primary"]:hover,
[data-testid="stFormSubmitButton"] > button:hover {
    background: #002d6e !important;
    border-color: rgba(0, 80, 180, 0.7) !important;
    box-shadow: 0 2px 8px rgba(0, 31, 91, 0.55) !important;
}
.stButton > button[kind="secondary"],
[data-testid="stBaseButton-secondary"] {
    background: #001a4d !important;
    border: 1px solid rgba(0, 47, 135, 0.4) !important;
    color: #ffffff !important;
}
.stButton > button[kind="secondary"]:hover,
[data-testid="stBaseButton-secondary"]:hover {
    background: #002255 !important;
    border-color: rgba(0, 80, 180, 0.6) !important;
    color: #ffffff !important;
}
"""


def inject_styles() -> None:
    """Inject all custom CSS into the Streamlit page."""
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)
    _inject_button_styles_via_js()
    _inject_theme_detector_via_js()


def _inject_button_styles_via_js() -> None:
    """Inject button CSS via iframe JS so it survives Streamlit re-renders."""
    escaped = _BUTTON_PERSISTENT_CSS.replace("`", r"\`").replace("\n", " ")
    components.html(
        f"""
        <script>
        (function() {{
            var CSS = `{escaped}`;
            function apply() {{
                var el = parent.document.getElementById('_st_btn_custom_styles');
                if (!el) {{
                    el = parent.document.createElement('style');
                    el.id = '_st_btn_custom_styles';
                    parent.document.head.appendChild(el);
                }}
                el.textContent = CSS;
            }}
            apply();
            new MutationObserver(apply).observe(
                parent.document.body,
                {{ childList: true, subtree: true }}
            );
        }})();
        </script>
        """,
        height=0,
    )


def _inject_theme_detector_via_js() -> None:
    """Detect Streamlit's actual theme by reading its background color and set data-theme attribute."""
    components.html(
        """
        <script>
        (function() {
            function detectTheme() {
                var app = parent.document.querySelector('.stApp');
                if (!app) return;
                var bg = getComputedStyle(app).backgroundColor;
                // Parse rgb values — dark themes have low brightness
                var m = bg.match(/[0-9]+/g);
                if (m && m.length >= 3) {
                    var brightness = (parseInt(m[0]) * 299 + parseInt(m[1]) * 587 + parseInt(m[2]) * 114) / 1000;
                    var theme = brightness < 128 ? 'dark' : 'light';
                    parent.document.documentElement.setAttribute('data-theme', theme);
                }
            }
            detectTheme();
            new MutationObserver(detectTheme).observe(
                parent.document.body,
                { childList: true, subtree: true, attributes: true }
            );
        })();
        </script>
        """,
        height=0,
    )


GLOBAL_CSS = """
<style>
/* ═══════════════════════════════════════════════════════════════
   IMPORTS & ROOT VARIABLES
   Consolidated variables for light/dark modes
═══════════════════════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
    /* Brand Colors */
    --primary:      #0a2342;
    --primary-mid:  #1a3a6b;
    --primary-light:#0f4c81;
    --accent:       #ffd700;
    --accent-soft:  #fff3b0;
    
    /* Semantic Colors */
    --success:      #16a34a;
    --success-bg:   #dcfce7;
    --warning:      #d97706;
    --warning-bg:   #fef3c7;
    --danger:       #dc2626;
    --danger-bg:    #fee2e2;
    --info:         #0369a1;
    --info-bg:      #e0f2fe;
    
    /* Surfaces & Borders (Light) */
    --surface:      #ffffff;
    --surface-alt:  #f8fafc;
    --border:       #e2e8f0;
    --border-dark:  #cbd5e1;
    
    /* Text (Light) */
    --text-primary: #0f172a;
    --text-secondary:#475569;
    --text-muted:   #94a3b8;
    
    /* Branded surfaces (hero banners, table headers) */
    --hero-bg:      linear-gradient(135deg, #0a2342 0%, #1a3a6b 100%);
    --hero-title:   #ffd700;
    --hero-text:    #ffffff;
    --hero-sub:     #a8c8f0;
    --table-header-bg: #0a2342;
    --table-header-color: #ffffff;
    --form-bg:      #f8fafc;
    
    /* Sidebar */
    --sidebar-bg:   linear-gradient(180deg, #0a2342 0%, #0f3460 100%);
    --sidebar-text: #e2e8f0;
    --sidebar-btn:  #001f5b;
    
    /* Tokens */
    --radius:       12px;
    --radius-sm:    8px;
    --shadow-sm:    0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
    --shadow:       0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05);
    --shadow-lg:    0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.06);
    --transition:   all 0.2s ease;
}

@media (prefers-color-scheme: dark) {
    :root {
        --primary:      #f4f4f5;
        --primary-mid:  #e4e4e7;
        --primary-light:#ffffff;
        --accent:       #ffd700;
        --accent-soft:  #b4b4bc;
        
        --success:      #10b981;
        --success-bg:   rgba(16, 185, 129, 0.1);
        --warning:      #f59e0b;
        --warning-bg:   rgba(245, 158, 11, 0.1);
        --danger:       #ef4444;
        --danger-bg:    rgba(239, 68, 68, 0.1);
        --info:         #3b82f6;
        --info-bg:      rgba(59, 130, 246, 0.1);
        
        --surface:      #0a0a0a;
        --surface-alt:  #141414;
        --border:       rgba(255, 255, 255, 0.08);
        --border-dark:  rgba(255, 255, 255, 0.12);
        
        --text-primary: #f4f4f5;
        --text-secondary:#c4c4cc;
        --text-muted:   #9b9ba4;
    }
}

/* Streamlit-specific dark mode (JS-detected via data-theme attribute) */
[data-theme="dark"] {
    --primary:      #f4f4f5;
    --primary-mid:  #e4e4e7;
    --primary-light:#ffffff;
    --accent:       #ffd700;
    --accent-soft:  #b4b4bc;
    
    --success:      #10b981;
    --success-bg:   rgba(16, 185, 129, 0.15);
    --warning:      #f59e0b;
    --warning-bg:   rgba(245, 158, 11, 0.15);
    --danger:       #ef4444;
    --danger-bg:    rgba(239, 68, 68, 0.15);
    --info:         #3b82f6;
    --info-bg:      rgba(59, 130, 246, 0.15);
    
    --surface:      #0e1117;
    --surface-alt:  #161b22;
    --border:       rgba(255, 255, 255, 0.1);
    --border-dark:  rgba(255, 255, 255, 0.16);
    
    --text-primary: #e6edf3;
    --text-secondary:#b1bac4;
    --text-muted:   #8b949e;
    
    --hero-bg:      linear-gradient(135deg, #0a2342 0%, #1a3a6b 100%);
    --hero-title:   #ffd700;
    --hero-text:    #ffffff;
    --hero-sub:     #a8c8f0;
    --table-header-bg: #0a2342;
    --table-header-color: #ffffff;
    --form-bg:      #010110;
    
    --sidebar-bg:   linear-gradient(180deg, #0a2342 0%, #0f3460 100%);
    --sidebar-text: #e2e8f0;
    --sidebar-btn:  #001f5b;
    
    --shadow-sm:    0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
    --shadow:       0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
    --shadow-lg:    0 10px 25px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3);
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL BASE STYLES
═══════════════════════════════════════════════════════════════ */
html, body, [class*="css"] {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

/* Container Tuning */
.block-container {
    padding-top: 1.5rem !important;
    padding-bottom: 3rem !important;
    max-width: 1200px;
}

/* Fixed Header Bar */
.otu-header {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 999999;
    background: linear-gradient(90deg, #0a2342 0%, #1a3a6b 60%, #0f4c81 100%);
    padding: 0.6rem 2rem;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    border-bottom: 2px solid var(--accent);
}
.otu-header .otu-uni {
    font-size: 0.82rem; font-weight: 700;
    color: var(--accent); letter-spacing: 0.06em; text-transform: uppercase;
}
.otu-header .otu-dept {
    font-size: 0.71rem; font-weight: 400; color: #cce0ff;
}

/* Streamlit Native Header Cleanup */
[data-testid="stAppViewContainer"] > section:first-child { padding-top: 3.6rem !important; }
[data-testid="stHeader"], [data-testid="stAppHeader"] {
    background: transparent !important;
    backdrop-filter: none !important;
    box-shadow: none !important;
    border: none !important;
}

/* Native Header Buttons */
[data-testid="stHeader"] button, [data-testid="stAppHeader"] button {
    background: #001f5b !important;
    border: 1px solid rgba(0, 47, 135, 0.5) !important;
    border-radius: 8px !important;
    color: #ffffff !important;
}

/* Scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--surface-alt); }
::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 999px; }

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR STYLING
═══════════════════════════════════════════════════════════════ */
[data-testid="stSidebar"] {
    background: var(--sidebar-bg) !important;
    border-right: 1px solid rgba(255,215,0,0.2);
}
[data-testid="stSidebar"] * { color: var(--sidebar-text) !important; }
[data-testid="stSidebar"] .stButton > button {
    width: 100%;
    background: var(--sidebar-btn) !important;
    border-radius: var(--radius-sm) !important;
    border: 1px solid rgba(0, 47, 135, 0.5) !important;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS: METRICS, TABLES, CARDS
═══════════════════════════════════════════════════════════════ */
/* Metrics */
[data-testid="stMetric"] {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem 1.25rem !important;
    box-shadow: var(--shadow-sm);
    transition: var(--transition);
}
[data-testid="stMetric"]:hover {
    box-shadow: var(--shadow);
    transform: translateY(-1px);
    border-color: var(--primary-light);
}

/* Dataframe / Tables */
[data-testid="stDataFrame"] {
    border-radius: var(--radius) !important;
    border: 1px solid var(--border) !important;
    overflow: hidden;
}
[data-testid="stDataFrame"] thead th {
    background: var(--table-header-bg) !important;
    color: var(--table-header-color) !important;
    text-transform: uppercase;
    font-size: 0.78rem !important;
    border: none !important;
}

/* Forms & Inputs */
.stTextInput input, .stTextArea textarea, .stSelectbox [data-testid="stSelectbox"] > div {
    border-radius: var(--radius-sm) !important;
    border: 1.5px solid var(--border-dark) !important;
    background: transparent !important;
}

[data-testid="stForm"] {
    background: var(--form-bg) !important;
    border: 1px solid var(--border) !important;
    border-radius: var(--radius) !important;
    padding: 1.25rem !important;
}

/* Label Styling */
.stTextInput label, .stTextArea label, .stSelectbox label, .stDateInput label, .stFileUploader label {
    font-size: 0.8rem !important;
    font-weight: 600 !important;
    color: var(--text-secondary) !important;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

/* Alerts */
[data-testid="stAlert"] {
    border-radius: var(--radius-sm) !important;
    border-left-width: 4px !important;
}

/* ═══════════════════════════════════════════════════════════════
   LOGIN PAGE
═══════════════════════════════════════════════════════════════ */
.login-wrapper {
    max-width: 420px;
    margin: 2rem auto;
    padding: 2rem 2.5rem;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
}

@media (prefers-color-scheme: light) {
    .login-wrapper { background: #ffffff !important; }
}
@media (prefers-color-scheme: dark) {
    .login-wrapper { 
        background: rgba(17, 32, 46, 1) !important;
        border-color: rgba(17, 32, 46, 1) !important;
    }
}
[data-theme="dark"] .login-wrapper {
    background: rgba(17, 32, 46, 1) !important;
    border-color: rgba(17, 32, 46, 1) !important;
}

.login-title {
    text-align: center;
    font-size: 1.2rem;
    font-weight: 700;
    color: white;
}
.login-sub {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.2rem;
    margin-bottom: 0.5rem;
}

/* Login logo theme switching */
.login-logo-light { display: block !important; }
.login-logo-dark  { display: none !important; }

@media (prefers-color-scheme: dark) {
    .login-logo-light { display: none !important; }
    .login-logo-dark  { display: block !important; }
}
[data-theme="dark"] .login-logo-light { display: none !important; }
[data-theme="dark"] .login-logo-dark  { display: block !important; }

/* ═══════════════════════════════════════════════════════════════
   AI & DYNAMIC COMPONENTS
═══════════════════════════════════════════════════════════════ */
/* AI Insight Card */
.ai-insight-card {
    background: linear-gradient(135deg, #0f0c29 0%, #1a1a4e 50%, #24243e 100%);
    border-radius: 14px;
    padding: 1.25rem 1.5rem;
    position: relative;
    color: #f1f5f9;
    box-shadow: 0 8px 32px rgba(139, 92, 246, 0.18);
    background-clip: padding-box;
    z-index: 1;
}
.ai-insight-card::before {
    content: ""; position: absolute; inset: -1.5px;
    border-radius: 15px;
    background: linear-gradient(135deg, #8b5cf6, #3b82f6, #06b6d4, #8b5cf6);
    background-size: 300% 300%;
    animation: aurora 6s ease infinite;
    z-index: -1;
}

/* Floating AI Button */
.ai-fab {
    position: fixed; bottom: 1.5rem; right: 1.5rem;
    width: 56px; height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.5);
    cursor: pointer;
    color: white;
    z-index: 999999;
    animation: fab-pulse 3s ease-in-out infinite;
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATIONS & UTILITIES
═══════════════════════════════════════════════════════════════ */
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
}
.block-container > div { animation: fadeInUp 0.25s ease both; }

@keyframes aurora {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
}

@keyframes fab-pulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(124,58,237,0.5); }
    50%       { box-shadow: 0 4px 32px rgba(124,58,237,0.8); }
}

/* Status Badges */
.badge {
    display: inline-block; padding: 0.18em 0.65em;
    border-radius: 999px; font-size: 0.72rem; font-weight: 700;
    text-transform: uppercase;
}
.badge-todo  { background: #e2e8f0; color: #475569; }
.badge-doing { background: #dbeafe; color: #1e40af; }
.badge-done  { background: #dcfce7; color: #16a34a; }

/* Custom Dark-Aware Classes (for HTML panels) */
.dm-card {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 12px; padding: 1rem;
    box-shadow: var(--shadow-sm);
    transition: all 0.25s ease;
}
.dm-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: var(--border-dark);
}

/* Hero banner */
.dm-hero-banner {
    background: var(--hero-bg);
    border-radius: 14px;
    padding: 1.2rem 1.6rem;
    margin-bottom: 1rem;
    box-shadow: 0 4px 16px rgba(10, 35, 66, 0.18);
}

/* Card detail */
.dm-card-detail {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    box-shadow: var(--shadow-sm);
    margin-bottom: 0.75rem;
}

/* ── Milestone Progress Cards ────────────────────────────────── */
.dm-milestone-card {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 0.85rem 0.75rem 0.7rem;
    text-align: center;
    transition: all 0.25s ease;
    position: relative;
    overflow: hidden;
}
.dm-milestone-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 60%);
    pointer-events: none;
}
.dm-milestone-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.12);
    border-color: var(--border-dark);
}
.dm-milestone-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.35rem;
}
.dm-milestone-badge {
    font-size: 0.6rem;
    font-weight: 800;
    color: #fff;
    padding: 0.15em 0.55em;
    border-radius: 6px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.dm-milestone-icon {
    font-size: 0.85rem;
    line-height: 1;
}
.dm-milestone-title {
    font-size: 0.62rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 0.25rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.dm-milestone-pct {
    font-size: 1.45rem;
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 0.1rem;
}
.dm-milestone-tasks {
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 0.4rem;
}
.dm-milestone-bar-track {
    background: var(--border);
    border-radius: 999px;
    height: 5px;
    overflow: hidden;
}
.dm-milestone-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Active task card */
.dm-active-task {
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: var(--shadow-sm);
    border-left: 4px solid var(--primary-light);
}

/* Text color helpers */
.dm-text-primary { color: var(--text-primary); }
.dm-text-secondary { color: var(--text-secondary); }
.dm-text-muted { color: var(--text-muted); }
.dm-section-title { color: var(--text-primary); }
.dm-section-sub { color: var(--text-muted); }

/* Table helpers */
.dm-table-header {
    padding: 0.45rem 0.7rem;
    font-size: 0.7rem;
    color: var(--table-header-color, #fff);
    text-align: left;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-weight: 700;
}
.dm-table-row {
    border-bottom: 1px solid var(--border);
    transition: background 0.15s ease;
}
.dm-table-row:hover {
    background: rgba(255, 255, 255, 0.03);
}
</style>
"""
