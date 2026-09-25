"""
ai_client.py
Decoupled AI client architecture for the Final Project Tracking System.

Supports:
1. Google Gemini API (Cloud, via REST — zero external dependencies)
2. Ollama (Local LLM, e.g. llama3.2:3b)
3. Groq / OpenAI (OpenAI-compatible REST endpoints)
4. Heuristic Fallback Engine (Offline, rule-based analytics so cloud demos never crash)

All public functions accept a `lang` parameter ("tr" | "en").
This is automatically resolved from the active UI language (i18n.is_english_ui).
"""
from __future__ import annotations

import abc
import json
import os
import re
import socket
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional


from constants import (
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    get_ai_secret,
)

# Backwards compatibility defaults
OLLAMA_BASE = OLLAMA_BASE_URL
DEFAULT_MODEL = OLLAMA_MODEL


# ── Language Helpers ──────────────────────────────────────────────────────────

def _get_ui_lang() -> str:
    """Detect the currently selected UI language. Returns 'en' or 'tr'."""
    try:
        from i18n import is_english_ui
        return "en" if is_english_ui() else "tr"
    except Exception:
        return "tr"


def _lang_instruction(lang: str, max_words: int) -> str:
    """Return the closing language-instruction line for a prompt."""
    if lang == "en":
        return (
            f"Reply in **English**, using bullet points, emojis, and a maximum of {max_words} words."
        )
    return (
        f"Yanıtını **Türkçe**, madde madde, emoji kullanarak ve maksimum {max_words} kelime ile ver."
    )


def _lang_word(lang: str, tr_word: str, en_word: str) -> str:
    return en_word if lang == "en" else tr_word


# ═══════════════════════════════════════════════════════════════════════════════
# AI Provider Abstract Base Class
# ═══════════════════════════════════════════════════════════════════════════════

class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    def is_available(self) -> bool:
        """Return True if this provider is reachable and ready to generate responses."""
        pass

    @abc.abstractmethod
    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        """Single-turn generation from prompt text."""
        pass

    @abc.abstractmethod
    def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        """Multi-turn chat completion."""
        pass

    @abc.abstractmethod
    def get_provider_name(self) -> str:
        """User-friendly name of the provider."""
        pass

    @abc.abstractmethod
    def get_model_name(self) -> str:
        """Active model identifier."""
        pass


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Google Gemini Provider (Cloud REST API)
# ═══════════════════════════════════════════════════════════════════════════════

class GeminiProvider(BaseAIProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = (api_key or get_ai_secret("GEMINI_API_KEY") or get_ai_secret("GOOGLE_API_KEY") or GEMINI_API_KEY).strip()
        self.model = (model or get_ai_secret("GEMINI_MODEL") or GEMINI_MODEL or "gemini-1.5-flash").strip()

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_provider_name(self) -> str:
        return "Google Gemini"

    def get_model_name(self) -> str:
        return self.model

    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        target_model = model or self.model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 1024,
            },
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            candidates = res.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                if text:
                    return text
            return "⚠️ Gemini API yanıt üretemedi."
        except urllib.error.HTTPError as exc:
            try:
                err_data = json.loads(exc.read().decode("utf-8"))
                msg = err_data.get("error", {}).get("message", exc.reason)
            except Exception:
                msg = str(exc)
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ Gemini API Error ({exc.code}): {msg}"
            return f"⚠️ Gemini API Hatası ({exc.code}): {msg}"
        except Exception as exc:
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ Gemini connection error: {exc}"
            return f"⚠️ Gemini bağlantı hatası: {exc}"

    def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        target_model = model or self.model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.api_key}"

        contents = []
        system_instruction = None
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            elif role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role in ("assistant", "model"):
                contents.append({"role": "model", "parts": [{"text": content}]})

        if not contents:
            return ""

        payload: dict = {
            "contents": contents,
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1024},
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            candidates = res.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                if text:
                    return text
            return "⚠️ Gemini API yanıt üretemedi."
        except Exception as exc:
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ Gemini Chat error: {exc}"
            return f"⚠️ Gemini Sohbet hatası: {exc}"


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Local Ollama Provider
# ═══════════════════════════════════════════════════════════════════════════════

class OllamaProvider(BaseAIProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = (base_url or get_ai_secret("OLLAMA_BASE_URL") or OLLAMA_BASE_URL or "http://localhost:11434").rstrip("/")
        self.model = (model or get_ai_secret("OLLAMA_MODEL") or OLLAMA_MODEL or "llama3.2:3b").strip()

    def is_available(self) -> bool:
        try:
            parsed = urllib.parse.urlparse(self.base_url)
            host = parsed.hostname or "127.0.0.1"
            if host == "localhost":
                host = "127.0.0.1"
            port = parsed.port or 11434
            with socket.create_connection((host, port), timeout=0.25):
                pass
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=1.0) as resp:
                return resp.status == 200
        except Exception:
            return False


    def get_provider_name(self) -> str:
        return "Ollama"

    def get_model_name(self) -> str:
        return self.model

    def _post(self, endpoint: str, payload: dict, timeout: int = 120) -> dict:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.base_url}{endpoint}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        target_model = model or self.model
        try:
            res = self._post("/api/generate", {"model": target_model, "prompt": prompt, "stream": False})
            return res.get("response", "").strip()
        except urllib.error.URLError:
            lang = _get_ui_lang()
            if lang == "en":
                return "⚠️ Could not connect to Ollama. Please make sure Ollama is running (`ollama serve`)."
            return "⚠️ Ollama bağlantısı kurulamadı. Lütfen Ollama'nın çalıştığından emin olun (`ollama serve`)."
        except Exception as exc:
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ AI response error: {exc}"
            return f"⚠️ AI yanıt hatası: {exc}"

    def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        target_model = model or self.model
        try:
            res = self._post("/api/chat", {"model": target_model, "messages": messages, "stream": False})
            return res.get("message", {}).get("content", "").strip()
        except urllib.error.URLError:
            lang = _get_ui_lang()
            if lang == "en":
                return "⚠️ Could not connect to Ollama. Please make sure Ollama is running."
            return "⚠️ Ollama bağlantısı kurulamadı. Lütfen Ollama'nın çalıştığından emin olun."
        except Exception as exc:
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ AI error: {exc}"
            return f"⚠️ AI yanıt hatası: {exc}"


# ═══════════════════════════════════════════════════════════════════════════════
# 3. OpenAI-Compatible Provider (Groq / OpenAI)
# ═══════════════════════════════════════════════════════════════════════════════

class OpenAICompatibleProvider(BaseAIProvider):
    def __init__(self, api_key: str, base_url: str, model: str, name: str):
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.model = model.strip()
        self.name = name

    def is_available(self) -> bool:
        return bool(self.api_key)

    def get_provider_name(self) -> str:
        return self.name

    def get_model_name(self) -> str:
        return self.model

    def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        target_model = model or self.model
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": target_model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": 1024,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode("utf-8"))
            return res.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
        except Exception as exc:
            lang = _get_ui_lang()
            if lang == "en":
                return f"⚠️ {self.name} API error: {exc}"
            return f"⚠️ {self.name} API hatası: {exc}"

    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        return self.chat([{"role": "user", "content": prompt}], model=model)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Heuristic Fallback Provider (Offline Analytics for Cloud Demos)
# ═══════════════════════════════════════════════════════════════════════════════

class HeuristicFallbackProvider(BaseAIProvider):
    """
    Intelligent rule-based analytical engine.
    Extracts structured XML metadata from prompt templates to generate rich,
    insightful analyses when no remote API key is supplied and local Ollama is absent.
    Prevents empty responses or application crashes in cloud demo environments.
    """

    def is_available(self) -> bool:
        return True

    def get_provider_name(self) -> str:
        return "Akıllı Analiz Motoru (Çevrimdışı)"

    def get_model_name(self) -> str:
        return "Heuristic v1.0"

    def generate(self, prompt: str, model: Optional[str] = None) -> str:
        lang = "en" if "You are the AI" in prompt or "PERFORMANCE ANALYSIS" in prompt else "tr"

        # ── Case A: Advisor Portfolio Report ──────────────────────────────────
        if "<project_data>" in prompt or "<proje_verileri>" in prompt:
            return self._generate_advisor_report(prompt, lang)

        # ── Case B: Group / Leader Report ──────────────────────────────────────
        if "<project_summary>" in prompt or "<proje_ozeti>" in prompt:
            return self._generate_group_report(prompt, lang)

        # ── Case C: Student Coaching Report ────────────────────────────────────
        if "<student_context>" in prompt or "<ogrenci_baglami>" in prompt:
            return self._generate_student_report(prompt, lang)

        # ── Generic fallback ───────────────────────────────────────────────────
        if lang == "en":
            return (
                "**1. Portfolio Status:** System operational in smart offline mode.\n\n"
                "**2. Analysis:** Capstone project metrics recorded and tracked across milestones M1–M6.\n\n"
                "**3. Strategic Advice:** Configure `GEMINI_API_KEY` in environment or Streamlit Secrets for live LLM generation."
            )
        return (
            "**1. Genel Durum:** Sistem çevrimdışı akıllı analiz modunda çalışmaktadır.\n\n"
            "**2. Değerlendirme:** Bitirme projesi M1–M6 aşamaları ve görev metrikleri başarıyla işlenmektedir.\n\n"
            "**3. Tavsiye:** Canlı yapay zeka yanıtları için `GEMINI_API_KEY` tanımlayabilir veya yerel Ollama servisini başlatabilirsiniz."
        )

    def _generate_advisor_report(self, prompt: str, lang: str) -> str:
        # Parse XML tags
        pattern = r'<(?:project|proje) (?:name|ad)="([^"]+)">(.*?)</(?:project|proje)>'
        matches = list(re.finditer(pattern, prompt, re.DOTALL))
        projects = []
        for m in matches:
            pname = m.group(1)
            body = m.group(2)

            def _get(tag: str, default: str = "") -> str:
                h = re.search(rf"<{tag}>(.*?)</{tag}>", body)
                return h.group(1).strip() if h else default

            leader = _get("leader") or _get("lider") or "-"
            members = _get("members") or _get("uye_sayisi") or "0"
            raw_pct = (_get("completion") or _get("tamamlanma") or "0").replace("%", "")
            try:
                pct = float(raw_pct)
            except ValueError:
                pct = 0.0
            raw_overdue = _get("overdue_tasks") or _get("geciken_gorev") or "0"
            try:
                overdue = int(raw_overdue)
            except ValueError:
                overdue = 0
            risk = _get("risk_level") or _get("risk_seviyesi") or "Orta"
            projects.append({
                "name": pname,
                "leader": leader,
                "members": members,
                "pct": pct,
                "overdue": overdue,
                "risk": risk,
            })

        total_p = len(projects)
        avg_pct = sum(p["pct"] for p in projects) / total_p if total_p else 0.0
        high_performers = sorted([p for p in projects if p["pct"] >= 50 and p["overdue"] == 0], key=lambda x: x["pct"], reverse=True)
        risky_projects = sorted([p for p in projects if p["overdue"] > 0 or p["risk"] in ("Yüksek", "High")], key=lambda x: x["overdue"], reverse=True)

        if lang == "en":
            status_desc = "progressing steadily" if avg_pct >= 50 else "in need of focused milestone acceleration"
            high_txt = ""
            for p in high_performers[:2]:
                high_txt += f"• **{p['name']}**: High milestone pace at **%{p['pct']:.1f}** with zero overdue tasks. Leader: {p['leader']}.\n"
            if not high_txt:
                high_txt = "• All projects currently maintaining steady progress across early deliverables.\n"

            risk_txt = ""
            for p in risky_projects[:2]:
                risk_txt += f"• **{p['name']}**: **{p['overdue']}** overdue task(s) detected with progress at %{p['pct']:.1f}. Requires milestone check.\n"
            if not risk_txt:
                risk_txt = "• No critical deadline bottlenecks detected across current project teams.\n"

            return (
                f"**1. Executive Summary:**\n"
                f"Managing a portfolio of **{total_p} active capstone projects** with an overall average completion rate of **%{avg_pct:.1f}**. "
                f"The overall cohort is {status_desc}.\n\n"
                f"**2. High Performers:**\n{high_txt}\n"
                f"**3. Risk & Bottleneck Analysis:**\n{risk_txt}\n"
                f"**4. Strategic Actions for Advisor:**\n"
                f"• Convene brief sync meetings with groups experiencing milestone delays to clarify technical blockers.\n"
                f"• Encourage cross-group knowledge sharing between leading and lagging teams.\n"
                f"• Validate student evidence links and documentation prior to milestone M6 final review."
            )
        else:
            status_desc = "düzenli ve dengeli ilerlemektedir" if avg_pct >= 50 else "ara değerlendirme ve hızlandırma gerektirmektedir"
            high_txt = ""
            for p in high_performers[:2]:
                high_txt += f"• **{p['name']}**: **%{p['pct']:.1f}** tamamlanma ve 0 gecikmeyle öne çıkmaktadır. Lider: {p['leader']}.\n"
            if not high_txt:
                high_txt = "• Ekipler başlangıç ve tasarım aşamalarında dengeli çalışma sürdürmektedir.\n"

            risk_txt = ""
            for p in risky_projects[:2]:
                risk_txt += f"• **{p['name']}**: **{p['overdue']}** geciken görev tespit edilmiştir. İlerleme %{p['pct']:.1f} seviyesindedir.\n"
            if not risk_txt:
                risk_txt = "• Portföyde kritik teslim darboğazı bulunmamaktadır.\n"

            return (
                f"**1. Yönetici Özeti:**\n"
                f"Danışman portföyündeki toplam **{total_p} proje grubu** incelenmiştir. Genel tamamlanma oranı **%{avg_pct:.1f}** olup portföy {status_desc}.\n\n"
                f"**2. Başarılı Projeler:**\n{high_txt}\n"
                f"**3. Risk Analizi:**\n{risk_txt}\n"
                f"**4. Danışman İçin Stratejik Aksiyonlar:**\n"
                f"• Gecikme yaşayan gruplarla 15 dakikalık odak değerlendirme toplantısı planlayarak engelleri netleştirin.\n"
                f"• İlerideki ekiplerin proje mimarisi ve raporlama pratiklerini diğer gruplara örnek gösterin.\n"
                f"• M6 final raporlama öncesi M3/M4 aşamasındaki uygulama ve test kanıtlarını sisteme yükletin."
            )

    def _generate_group_report(self, prompt: str, lang: str) -> str:
        # Extract project overview
        total = re.search(r'total="(\d+)"', prompt)
        done = re.search(r'completed="(\d+)"', prompt)
        pct = re.search(r'percent="([\d\.]+)"', prompt)
        overdue = re.search(r'<(?:overdue_count|geciken_sayisi)>(\d+)</', prompt)

        t_val = total.group(1) if total else "0"
        d_val = done.group(1) if done else "0"
        p_val = pct.group(1) if pct else "0"
        o_val = overdue.group(1) if overdue else "0"

        if lang == "en":
            return (
                f"**1. Team Trajectory:**\n"
                f"Group has completed **{d_val} of {t_val} tasks** (%{p_val} overall progress). Momentum is steady with {o_val} overdue items.\n\n"
                f"**2. Bottleneck Detection:**\n"
                f"• Critical path requires active closing of pending individual tasks before proceeding to subsequent milestones.\n"
                f"• Keep team communication frequent to avoid last-minute deadline compression.\n\n"
                f"**3. Performance Signals:**\n"
                f"• Member task distribution is clearly defined; maintaining consistent weekly report cadence is vital.\n\n"
                f"**4. Action Plan:**\n"
                f"• **Step 1:** Complete and attach evidence for any current DOING tasks.\n"
                f"• **Step 2:** Hold a 10-minute team checkpoint to unblock remaining sub-tasks.\n"
                f"• **Step 3:** Request early advisor feedback on drafted deliverable sections."
            )
        else:
            return (
                f"**1. Durum Analizi:**\n"
                f"Ekibiniz toplam **{t_val} görevin {d_val} tanesini tamamladı** (Genel ilerleme: **%{p_val}**). Geciken görev sayısı: **{o_val}**.\n\n"
                f"**2. Darboğaz Tespiti:**\n"
                f"• Sıralı milestone kuralı gereğince önceki aşamalar kapatılmadan sonraki adımlara geçilemez.\n"
                f"• Görev teslimlerinde kanıt linklerinin (GitHub repo, rapor, sunum) zamanında eklenmesi gerekmektedir.\n\n"
                f"**3. Performans Sinyalleri:**\n"
                f"• Görev dağılımı mevcut; haftalık düzenli rapor girişi ile danışman görünürlüğü artırılmalıdır.\n\n"
                f"**4. 3 Adımlı Aksiyon Planı:**\n"
                f"• **1. Adım:** Devam eden (DOING) görevlerin kanıtlarını tamamlayarak TAMAMLANDI (DONE) durumuna geçirin.\n"
                f"• **2. Adım:** Ekip içi mini toplantı ile geciken veya zorlanan üyelerin görevlerine destek verin.\n"
                f"• **3. Adım:** Bir sonraki milestone görevlerini önceden inceleyip planlama yapın."
            )

    def _generate_student_report(self, prompt: str, lang: str) -> str:
        pct_match = re.search(r'pct="(%?[\d\.]+)"', prompt)
        pct_val = pct_match.group(1).replace("%", "") if pct_match else "0"
        overdue_match = re.search(r'overdue="(\d+)"', prompt)
        overdue_val = overdue_match.group(1) if overdue_match else "0"

        if lang == "en":
            return (
                f"**1. Honest Assessment:**\n"
                f"Your individual milestone completion is currently at **%{pct_val}** with **{overdue_val} overdue tasks**.\n\n"
                f"**2. Accountability:**\n"
                f"Milestone tasks are sequential; your teammates rely on your component to integrate the capstone system.\n\n"
                f"**3. Primary Focus:**\n"
                f"Focus on your immediate active task and submit repository/document evidence.\n\n"
                f"**4. Micro-Actions:**\n"
                f"• Break down your active task into two 45-minute working sprints today.\n"
                f"• Update your weekly progress note to keep your advisor informed.\n\n"
                f"🚀 *Consistency beats intensity — take that next step today!*"
            )
        else:
            return (
                f"**1. Net Değerlendirme:**\n"
                f"Kişisel görev tamamlama oranın şu anda **%{pct_val}** seviyesindedir. Geciken görev sayısı: **{overdue_val}**.\n\n"
                f"**2. Sorumluluk ve Etki:**\n"
                f"Bitirme projesinde milestone adımları sıralıdır; senin görevin ekibin bir sonraki aşamaya geçişini doğrudan etkiler.\n\n"
                f"**3. Odak Noktası:**\n"
                f"Şu an üzerinde çalıştığın aktif görevi bitirmeye ve ilgili çalışma kanıtını yüklemeye odaklan.\n\n"
                f"**4. Hemen Yapılabilecek Mikro Aksiyonlar:**\n"
                f"• Bugün 45 dakikalık tek bir odaklanma bloğu ayırarak mevcut görevini ilerlet.\n"
                f"• Yaptığın çalışmayı haftalık durum güncellemesi olarak sisteme kaydet.\n\n"
                f"🚀 *Küçük ve düzenli adımlar en karmaşık projeleri bile başarıyla tamamlar. Başarılar!*"
            )

    def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        lang = _get_ui_lang()
        user_msg = messages[-1].get("content", "") if messages else ""
        lower = user_msg.lower()

        if "milestone" in lower or "aşama" in lower or "m1" in lower or "m2" in lower or "m3" in lower:
            if lang == "en":
                return (
                    "📌 **Capstone Milestone Roadmap (M1–M6):**\n\n"
                    "• **M1:** Literature review and state-of-the-art research.\n"
                    "• **M2:** Algorithm and software architecture planning.\n"
                    "• **M3:** Bootstrapping the core application/prototype.\n"
                    "• **M4:** Experimental testing and evaluation of results.\n"
                    "• **M5:** Bug fixes, optimizations, and iterations.\n"
                    "• **M6:** Final project thesis writing and presentation.\n\n"
                    "💡 *Note: You can configure `GEMINI_API_KEY` for live generative responses.*"
                )
            return (
                "📌 **Bitirme Projesi Milestone Yol Haritası (M1–M6):**\n\n"
                "• **M1:** Literatür taraması ve mevcut çözümlerin analizi.\n"
                "• **M2:** Algoritma tasarımı ve sistem mimarisi planı.\n"
                "• **M3:** Çekirdek uygulamanın/prototipin ayağa kaldırılması.\n"
                "• **M4:** Uygulama denemeleri ve sonuçların değerlendirilmesi.\n"
                "• **M5:** Hata ayıklama, iyileştirme ve yeniden test.\n"
                "• **M6:** Proje tez yazımı ve final sunumu.\n\n"
                "💡 *İpucu: Canlı diyalog için .env veya Streamlit secrets içine `GEMINI_API_KEY` ekleyebilirsiniz.*"
            )

        if "şifre" in lower or "password" in lower:
            if lang == "en":
                return "🔑 Passwords can be changed in the navigation bar. Advisors can reset student passwords to `12345` via the Advisor Panel."
            return "🔑 Şifrenizi üst paneldeki profil menüsünden değiştirebilirsiniz. Danışmanınız şifrenizi `12345` olarak sıfırlayabilir."

        if lang == "en":
            return (
                f"Hello! I am your Bitirme Proje Takip assistant. "
                f"You asked: *\"{user_msg}\"*\n\n"
                f"I can assist you with capstone milestones (M1–M6), task progress, advisor evaluations, and weekly logs. "
                f"\n\n*(Currently running in smart offline heuristic mode. Add `GEMINI_API_KEY` to connect Google Gemini Flash live!)*"
            )
        return (
            f"Merhaba! Bitirme Proje Takip asistanınızım. "
            f"Sorunuz: *\"{user_msg}\"*\n\n"
            f"Bitirme projesi milestone adımları (M1–M6), görev durumları, haftalık raporlar ve danışman değerlendirmeleri konusunda size yardımcı olabilirim. "
            f"\n\n*(Şu anda akıllı çevrimdışı analiz modunda çalışıyorum. Canlı Google Gemini Flash için `GEMINI_API_KEY` tanımlayabilirsiniz.)*"
        )


# ═══════════════════════════════════════════════════════════════════════════════
# Provider Factory & Resolution
# ═══════════════════════════════════════════════════════════════════════════════

_cached_provider: Optional[BaseAIProvider] = None


def get_active_provider(force_refresh: bool = False) -> BaseAIProvider:
    """
    Resolve and return the active AI provider based on configuration and availability.

    Hierarchy in 'auto' mode:
    1. Google Gemini API (if GEMINI_API_KEY or GOOGLE_API_KEY is configured)
    2. Groq (if GROQ_API_KEY is configured)
    3. OpenAI (if OPENAI_API_KEY is configured)
    4. Ollama (if reachable on localhost:11434)
    5. Heuristic Fallback Engine (clean offline analytics, zero crash guarantee)
    """
    global _cached_provider
    if _cached_provider is not None and not force_refresh:
        return _cached_provider

    provider_pref = (get_ai_secret("AI_PROVIDER") or AI_PROVIDER or "auto").lower().strip()

    # Explicit provider overrides
    if provider_pref == "gemini":
        gemini = GeminiProvider()
        if gemini.is_available():
            _cached_provider = gemini
            return gemini

    if provider_pref == "ollama":
        ollama = OllamaProvider()
        if ollama.is_available():
            _cached_provider = ollama
            return ollama

    if provider_pref == "groq":
        groq_key = get_ai_secret("GROQ_API_KEY") or GROQ_API_KEY
        if groq_key:
            groq = OpenAICompatibleProvider(
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1",
                model=get_ai_secret("GROQ_MODEL") or GROQ_MODEL or "llama-3.3-70b-versatile",
                name="Groq",
            )
            _cached_provider = groq
            return groq

    if provider_pref == "openai":
        openai_key = get_ai_secret("OPENAI_API_KEY") or OPENAI_API_KEY
        if openai_key:
            openai_p = OpenAICompatibleProvider(
                api_key=openai_key,
                base_url="https://api.openai.com/v1",
                model=get_ai_secret("OPENAI_MODEL") or OPENAI_MODEL or "gpt-4o-mini",
                name="OpenAI",
            )
            _cached_provider = openai_p
            return openai_p

    # Auto mode resolution
    gemini = GeminiProvider()
    if gemini.is_available():
        _cached_provider = gemini
        return gemini

    groq_key = get_ai_secret("GROQ_API_KEY") or GROQ_API_KEY
    if groq_key:
        groq = OpenAICompatibleProvider(
            api_key=groq_key,
            base_url="https://api.groq.com/openai/v1",
            model=get_ai_secret("GROQ_MODEL") or GROQ_MODEL or "llama-3.3-70b-versatile",
            name="Groq",
        )
        _cached_provider = groq
        return groq

    ollama = OllamaProvider()
    if ollama.is_available():
        _cached_provider = ollama
        return ollama

    # Fallback when no keys are provided and Ollama is offline
    fallback = HeuristicFallbackProvider()
    _cached_provider = fallback
    return fallback


def is_live_ai_available() -> bool:
    """Return True if a live remote (Gemini/Groq/OpenAI) or local (Ollama) LLM is connected."""
    provider = get_active_provider(force_refresh=True)
    return not isinstance(provider, HeuristicFallbackProvider)


def check_ai_available() -> bool:
    """
    Return True if the AI client is ready to generate responses.
    Always returns True since HeuristicFallbackProvider provides a zero-crash guarantee.
    """
    return True


def check_ollama() -> bool:
    """Backwards-compatibility alias for check_ai_available()."""
    return check_ai_available()


def get_active_provider_name() -> str:
    """Return display name of active provider, e.g. 'Google Gemini', 'Ollama'."""
    return get_active_provider().get_provider_name()


def get_active_model_name() -> str:
    """Return display identifier of active model, e.g. 'gemini-1.5-flash', 'llama3.2:3b'."""
    return get_active_provider().get_model_name()


def get_ai_service_label() -> str:
    """Return an accurate, contextual service label for UI captions."""
    provider = get_active_provider()
    if isinstance(provider, GeminiProvider):
        return "Google Gemini Flash"
    if isinstance(provider, OllamaProvider):
        return f"Ollama ({provider.get_model_name()})"
    if isinstance(provider, HeuristicFallbackProvider):
        return "AI Asistanı (Akıllı Analiz)"
    return f"{provider.get_provider_name()} ({provider.get_model_name()})"


def get_ai_service_badge() -> str:
    """Return badge text for sidebar chat and cards."""
    provider = get_active_provider()
    if isinstance(provider, GeminiProvider):
        return f"✨ Gemini Flash · Cloud API"
    if isinstance(provider, OllamaProvider):
        return f"✨ {provider.get_model_name()} · Ollama"
    if isinstance(provider, HeuristicFallbackProvider):
        return "✨ Akıllı Analiz Motoru · Çevrimdışı"
    return f"✨ {provider.get_model_name()} · {provider.get_provider_name()}"


def list_models() -> list[str]:
    """Return names of locally available Ollama models if Ollama is running, else active model."""
    provider = get_active_provider()
    if isinstance(provider, OllamaProvider):
        try:
            with urllib.request.urlopen(f"{provider.base_url}/api/tags", timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            return [m["name"] for m in data.get("models", [])]
        except Exception:
            pass
    return [get_active_model_name()]


# ═══════════════════════════════════════════════════════════════════════════════
# Core Generation & Chat Entry Points
# ═══════════════════════════════════════════════════════════════════════════════

def generate(prompt: str, model: Optional[str] = None) -> str:
    """Call active provider's generate method."""
    provider = get_active_provider()
    return provider.generate(prompt, model=model)


def chat(messages: list[dict], model: Optional[str] = None) -> str:
    """Call active provider's multi-turn chat method."""
    provider = get_active_provider()
    return provider.chat(messages, model=model)


# ═══════════════════════════════════════════════════════════════════════════════
# Prompt Builders (100% Backwards Compatible)
# ═══════════════════════════════════════════════════════════════════════════════

def build_advisor_prompt(
    advisor_name: str,
    projects_data: list[dict],
    lang: Optional[str] = None,
) -> str:
    """
    Build a structured prompt for the advisor AI persona.
    projects_data: list of dicts with keys:
        name, members, completion_pct, overdue_count, risk, leader, recent_activity
    lang: 'en' or 'tr'. Auto-detected from UI language if None.
    """
    if lang is None:
        lang = _get_ui_lang()

    risk_map = {
        "tr": {"Dusuk": "Düşük", "Orta": "Orta", "Yuksek": "Yüksek"},
        "en": {"Dusuk": "Low",   "Orta": "Medium", "Yuksek": "High"},
    }[lang]

    if lang == "en":
        intro = [
            f"You are the AI academic tracking assistant belonging to advisor '{advisor_name}'.",
            "Adopt a highly analytical, constructive, and professional academic tone.",
            "",
            "<project_data>",
        ]
        for p in projects_data:
            risk_label = risk_map.get(p.get("risk", "Orta"), p.get("risk", "Orta"))
            intro += [
                f"  <project name=\"{p['name']}\">",
                f"    <leader>{p.get('leader', '-')}</leader>",
                f"    <members>{p.get('members', 0)}</members>",
                f"    <completion>{p.get('completion_pct', 0):.1f}%</completion>",
                f"    <overdue_tasks>{p.get('overdue_count', 0)}</overdue_tasks>",
                f"    <risk_level>{risk_label}</risk_level>",
                f"    <recent_activity>{p.get('recent_activity', 0)}</recent_activity>",
                f"  </project>",
            ]
        intro += [
            "</project_data>",
            "",
            "ANALYTICAL REPORT STRUCTURE:",
            "1. Executive Summary: Provide a precise 2–3 sentence diagnosis of overall portfolio health with clear judgment (e.g., stable, declining, high-risk).",
            "2. High Performers: Identify top-performing projects and explain WHY they succeed using concrete signals (progress rate, activity level, leadership).",
            "3. Risk Analysis: Detect underperforming or risky projects and explain root causes (not symptoms) such as coordination gaps, low engagement, or deadline slippage.",
            "4. Strategic Actions: Provide 2–3 highly specific, immediately actionable interventions with expected impact.",
            "5. Output must be structured, concise, insight-driven, and avoid generic statements.",
            _lang_instruction(lang, 350),
        ]
    else:
        intro = [
            f"Sen akademik danışman '{advisor_name}'nın yapay zeka asistanısın.",
            "Son derece analitik, yapıcı ve profesyonel bir akademik dil kullan.",
            "",
            "<proje_verileri>",
        ]
        for p in projects_data:
            risk_label = risk_map.get(p.get("risk", "Orta"), p.get("risk", "Orta"))
            intro += [
                f"  <proje ad=\"{p['name']}\">",
                f"    <lider>{p.get('leader', '-')}</lider>",
                f"    <uye_sayisi>{p.get('members', 0)}</uye_sayisi>",
                f"    <tamamlanma>%{p.get('completion_pct', 0):.1f}</tamamlanma>",
                f"    <geciken_gorev>{p.get('overdue_count', 0)}</geciken_gorev>",
                f"    <risk_seviyesi>{risk_label}</risk_seviyesi>",
                f"    <son_aktivite>{p.get('recent_activity', 0)}</son_aktivite>",
                f"  </proje>",
            ]
        intro += [
            "</proje_verileri>",
            "",
            "ANALİTİK RAPOR YAPISI:",
            "1. Yönetici Özeti: Portföyün genel durumunu 2–3 cümlede net bir teşhis ile değerlendir (örn: stabil, riskli, düşüşte).",
            "2. Başarılı Projeler: En iyi performans gösteren projeleri belirle ve BAŞARI nedenlerini somut verilerle açıkla.",
            "3. Risk Analizi: Sorunlu projelerde semptom değil kök nedenleri analiz et (iletişim eksikliği, düşük aktivite, gecikmeler vb.).",
            "4. Stratejik Aksiyonlar: Danışman için etkisi yüksek, net ve uygulanabilir 2–3 aksiyon öner.",
            "5. Genel ifadelerden kaçın, içgörü odaklı ve net ol.",
            _lang_instruction(lang, 350),
        ]
    return "\n".join(intro)


def build_group_prompt(
    project_name: str,
    leader_name: str,
    members: list[dict],
    tasks: list[dict],
    weekly_entries: list[dict],
    feedbacks: list[dict],
    lang: Optional[str] = None,
) -> str:
    """
    Build a structured prompt for the group/leader AI persona.
    lang: 'en' or 'tr'. Auto-detected from UI language if None.
    """
    if lang is None:
        lang = _get_ui_lang()

    done = sum(1 for t in tasks if t.get("status") == "DONE")
    total = len(tasks)
    overdue = sum(1 for t in tasks if t.get("is_overdue"))
    pct = round(done * 100 / total, 1) if total else 0

    if lang == "en":
        lines = [
            f"You are the highly analytical AI project manager and coach for project group '{project_name}'.",
            f"Adopt a constructive, professional, and action-oriented tone.",
            "",
            "<project_summary>",
            f"  <leader>{leader_name}</leader>",
            f"  <overall_tasks total=\"{total}\" completed=\"{done}\" percent=\"{pct}\"/>",
            f"  <overdue_count>{overdue}</overdue_count>",
            "</project_summary>",
            "",
            "<member_progress>",
        ]
        for m in members:
            lines.append(
                f"  <member name=\"{m['name']}\" role=\"{m.get('role', 'Member')}\" "
                f"done=\"{m.get('done_tasks', 0)}\" total=\"{m.get('total_tasks', 0)}\" "
                f"completion=\"{m.get('completion_pct', 0):.0f}%\"/>"
            )
        lines.append("</member_progress>")

        if tasks:
            incomplete = [t for t in tasks if t.get("status") != "DONE"][:5]
            lines += ["", "<pending_tasks>"]
            for t in incomplete:
                dl = t.get("deadline") or "No deadline"
                lines.append(f"  <task id=\"{t.get('milestone_key', '')}\" status=\"{t.get('status', '?')}\" deadline=\"{dl}\">{t['title']}</task>")
            lines.append("</pending_tasks>")

        if weekly_entries:
            lines += ["", "<recent_updates>"]
            for w in weekly_entries[:4]:
                lines.append(f"  <update by=\"{w.get('student_no', '')}\" date=\"{w.get('week_start', '')}\">{w.get('completed', '')[:80]}</update>")
            lines.append("</recent_updates>")

        if feedbacks:
            lines += ["", "<advisor_feedback>"]
            for fb in feedbacks[:3]:
                rev = " [REVISION REQUIRED]" if fb.get("revision_required") else ""
                lines.append(f"  <feedback>{fb.get('feedback', '')[:100]}{rev}</feedback>")
            lines.append("</advisor_feedback>")

        lines += [
            "",
            "PERFORMANCE ANALYSIS FRAMEWORK:",
            "1. Situation Assessment: Provide a sharp 1–2 sentence evaluation of team trajectory (momentum, risk level).",
            "2. Bottleneck Detection: Identify exact blockers (specific members, delayed tasks, weak ownership).",
            "3. Performance Signals: Highlight any standout contributors or critical gaps.",
            "4. Action Plan: Provide exactly 3 concrete, high-impact next steps with clear intent.",
            "5. Be direct, structured, and avoid vague advice.",
            _lang_instruction(lang, 300),
        ]
    else:
        lines = [
            f"Sen '{project_name}' proje grubunun son derece analitik yapay zeka proje yöneticisi ve koçusun.",
            "Yapıcı, profesyonel ve eylem odaklı bir dil kullan.",
            "",
            "<proje_ozeti>",
            f"  <lider>{leader_name}</lider>",
            f"  <genel_gorevler toplam=\"{total}\" tamamlanan=\"{done}\" yuzde=\"%{pct}\"/>",
            f"  <geciken_sayisi>{overdue}</geciken_sayisi>",
            "</proje_ozeti>",
            "",
            "<uye_ilerlemesi>",
        ]
        for m in members:
            lines.append(
                f"  <uye ad=\"{m['name']}\" rol=\"{m.get('role', 'Üye')}\" "
                f"tamamlanan=\"{m.get('done_tasks', 0)}\" toplam=\"{m.get('total_tasks', 0)}\" "
                f"ilerleme=\"%{m.get('completion_pct', 0):.0f}\"/>"
            )
        lines.append("</uye_ilerlemesi>")

        if tasks:
            incomplete = [t for t in tasks if t.get("status") != "DONE"][:5]
            lines += ["", "<bekleyen_gorevler>"]
            for t in incomplete:
                dl = t.get("deadline") or "Belirsiz"
                lines.append(f"  <gorev id=\"{t.get('milestone_key', '')}\" durum=\"{t.get('status', '?')}\" deadline=\"{dl}\">{t['title']}</gorev>")
            lines.append("</bekleyen_gorevler>")

        if weekly_entries:
            lines += ["", "<son_guncellemeler>"]
            for w in weekly_entries[:4]:
                lines.append(f"  <guncelleme kimden=\"{w.get('student_no', '')}\" tarih=\"{w.get('week_start', '')}\">{w.get('completed', '')[:80]}</guncelleme>")
            lines.append("</son_guncellemeler>")

        if feedbacks:
            lines += ["", "<danisman_geribildirimi>"]
            for fb in feedbacks[:3]:
                rev = " [REVİZYON GEREKLİ]" if fb.get("revision_required") else ""
                lines.append(f"  <geribildirim>{fb.get('feedback', '')[:100]}{rev}</geribildirim>")
            lines.append("</danisman_geribildirimi>")

        lines += [
            "",
            "PERFORMANS ANALİZİ ÇERÇEVESİ:",
            "1. Durum Analizi: Ekibin gidişatını 1–2 cümlede net şekilde değerlendir (ivme, risk seviyesi).",
            "2. Darboğaz Tespiti: Net engelleri belirle (belirli üyeler, geciken görevler, sahiplenme eksikliği).",
            "3. Performans Sinyalleri: Öne çıkan katkıları veya kritik eksikleri belirt.",
            "4. Aksiyon Planı: Tam olarak 3 adet somut ve yüksek etkili sonraki adım ver.",
            "5. Genel ve yüzeysel ifadelerden kaçın.",
            _lang_instruction(lang, 300),
        ]
    return "\n".join(lines)


def build_student_prompt(
    student_name: str,
    student_no: str,
    project_name: str,
    advisor_name: str,
    my_tasks: list[dict],
    my_weekly: list[dict],
    feedbacks: list[dict],
    rank: Optional[int] = None,
    total_groups: Optional[int] = None,
    lang: Optional[str] = None,
) -> str:
    """Build a personal coaching prompt for an individual student."""
    if lang is None:
        lang = _get_ui_lang()

    done = sum(1 for t in my_tasks if t.get("status") == "DONE")
    total = len(my_tasks)
    overdue = sum(1 for t in my_tasks if t.get("is_overdue"))
    pct = round(done * 100 / total, 1) if total else 0
    current_task = next((t for t in my_tasks if t.get("status") != "DONE"), None)

    if lang == "en":
        lines = [
            f"You are the intelligent personal AI academic coach for university student '{student_name}'.",
            "Be empathetic but rigorously analytical. Talk directly to the student.",
            "",
            "<student_context>",
            f"  <metadata id=\"{student_no}\" project=\"{project_name}\" advisor=\"{advisor_name}\"/>",
            f"  <progress total=\"{total}\" done=\"{done}\" pct=\"{pct}%\" overdue=\"{overdue}\"/>",
        ]
        if rank and total_groups:
            lines.append(f"  <ranking position=\"{rank}\" out_of=\"{total_groups}\"/>")
        lines.append("</student_context>")

        if current_task:
            lines += [
                "",
                "<active_task>",
                f"  <title milestone=\"{current_task.get('milestone_key', '')}\">{current_task.get('title', '')}</title>",
                f"  <status deadline=\"{current_task.get('deadline') or 'None'}\">{current_task.get('status', '')}</status>",
                "</active_task>",
            ]
        if my_tasks:
            lines += ["", "<tasks>"]
            for t in my_tasks[:8]:
                dl = t.get("deadline") or "—"
                lines.append(f"  <task state=\"{t.get('status', '?')}\" deadline=\"{dl}\">[{t.get('milestone_key', '')}] {t['title']}</task>")
            lines.append("</tasks>")

        if my_weekly:
            lines += ["", "<recent_reports>"]
            for w in my_weekly[:3]:
                lines.append(f"  <report date=\"{w.get('week_start', '')}\">{w.get('completed', '')[:80] or '(empty)'}</report>")
            lines.append("</recent_reports>")

        if feedbacks:
            lines += ["", "<advisor_feedback>"]
            for fb in feedbacks[:2]:
                lines.append(f"  <comment>{fb.get('feedback', '')[:100]}</comment>")
            lines.append("</advisor_feedback>")

        lines += [
            "",
            "COACHING FRAMEWORK:",
            "1. Honest Assessment: Evaluate current performance logically (progress, consistency, risk).",
            "2. Accountability: If there are delays, clearly explain consequences and urgency without being harsh.",
            "3. Focus Shift: Identify the ONE most important task to focus on now.",
            "4. Micro Actions: Provide 1–2 extremely specific, easy-to-start actions.",
            "5. End with a strong, professional, motivating push.",
            _lang_instruction(lang, 250),
        ]
    else:
        lines = [
            f"Sen '{student_name}' adlı üniversite öğrencisinin akıllı kişisel akademik yapay zeka koçusun.",
            "Empati kuran ama son derece analitik bir mentor diline sahip ol. Doğrudan öğrenciyle konuş.",
            "",
            "<ogrenci_baglami>",
            f"  <meta numara=\"{student_no}\" proje=\"{project_name}\" danisman=\"{advisor_name}\"/>",
            f"  <ilerleme toplam=\"{total}\" biten=\"{done}\" yuzde=\"%{pct}\" geciken=\"{overdue}\"/>",
        ]
        if rank and total_groups:
            lines.append(f"  <siralama pozisyon=\"{rank}\" toplam=\"{total_groups}\"/>")
        lines.append("</ogrenci_baglami>")

        if current_task:
            lines += [
                "",
                "<aktif_gorev>",
                f"  <baslik milestone=\"{current_task.get('milestone_key', '')}\">{current_task.get('title', '')}</baslik>",
                f"  <durum_bilgisi deadline=\"{current_task.get('deadline') or 'Belirsiz'}\">{current_task.get('status', '')}</durum_bilgisi>",
                "</aktif_gorev>",
            ]
        if my_tasks:
            lines += ["", "<gorevler>"]
            for t in my_tasks[:8]:
                dl = t.get("deadline") or "—"
                lines.append(f"  <gorev durum=\"{t.get('status', '?')}\" deadline=\"{dl}\">[{t.get('milestone_key', '')}] {t['title']}</gorev>")
            lines.append("</gorevler>")

        if my_weekly:
            lines += ["", "<son_raporlar>"]
            for w in my_weekly[:3]:
                lines.append(f"  <rapor tarih=\"{w.get('week_start', '')}\">{w.get('completed', '')[:80] or '(boş)'}</rapor>")
            lines.append("</son_raporlar>")

        if feedbacks:
            lines += ["", "<danisman_yorumlari>"]
            for fb in feedbacks[:2]:
                lines.append(f"  <yorum>{fb.get('feedback', '')[:100]}</yorum>")
            lines.append("</danisman_yorumlari>")

        lines += [
            "",
            "KOÇLUK ÇERÇEVESİ:",
            "1. Net Değerlendirme: Mevcut performansı mantıklı ve dürüst şekilde analiz et (ilerleme, tutarlılık, risk).",
            "2. Sorumluluk: Gecikmeler varsa neden kritik olduğunu açık ve net şekilde belirt.",
            "3. Odak Noktası: Şu an en önemli yapılması gereken TEK işi belirle.",
            "4. Mikro Aksiyonlar: Hemen başlanabilecek 1–2 net ve küçük adım ver.",
            "5. Güçlü ve motive edici profesyonel bir kapanış yap.",
            _lang_instruction(lang, 250),
        ]
    return "\n".join(lines)


def get_chat_system_prompt(
    role: str,
    display_name: str,
    project_name: str = "",
    lang: Optional[str] = None,
) -> str:
    """Return a system prompt for the chat assistant tuned to the user's role."""
    if lang is None:
        lang = _get_ui_lang()

    if lang == "en":
        lang_instruction = (
            "Respond in English by default. "
            "However, if the user writes in a different language, respond in that same language. "
        )
        if role == "advisor":
            context = (
                f"The user is academic advisor: {display_name}. "
                "Help with project management, student evaluation, milestone tracking, and academic processes."
            )
        elif role == "leader":
            context = (
                f"The user is group leader: {display_name}, Project: {project_name}. "
                "Help with task planning, team management, technical questions, and project progress."
            )
        else:
            context = (
                f"The user is student: {display_name}, Project: {project_name}. "
                "Help with the capstone project, tasks, milestone steps, and academic motivation."
            )
    else:
        lang_instruction = (
            "Varsayılan olarak Türkçe yanıt ver. "
            "Ancak kullanıcı farklı bir dilde yazarsa aynı dilde yanıt ver. "
        )
        if role == "advisor":
            context = (
                f"Kullanıcı danışman: {display_name}. "
                "Proje yönetimi, öğrenci değerlendirmesi, milestone takibi ve akademik süreç konularında yardım et."
            )
        elif role == "leader":
            context = (
                f"Kullanıcı grup lideri: {display_name}, Proje: {project_name}. "
                "Görev planlaması, ekip yönetimi, teknik sorular ve proje ilerlemesi konularında yardım et."
            )
        else:
            context = (
                f"Kullanıcı öğrenci: {display_name}, Proje: {project_name}. "
                "Bitirme projesi, görevler, milestone adımları ve akademik motivasyon konularında yardım et."
            )

    base = (
        "You are the AI assistant of the OSTİM Technical University Final Project Tracking System. "
        + lang_instruction
        + "Be concise, helpful, and friendly. You may use Markdown and emojis. "
    )
    return base + context
