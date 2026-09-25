import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Bot, X, Send, Trash2, Sparkles, User, Lightbulb, ArrowUp } from 'lucide-react';

const SUGGESTIONS = {
  tr: [
    '📌 M1 Literatür taraması nasıl hazırlanır?',
    '⚠️ Proje risk seviyemi nasıl düşürürüm?',
    '🚀 Agile sprint ve milestone planlaması',
    '📝 Haftalık ilerleme günlüğü için tavsiyeler',
  ],
  en: [
    '📌 How to prepare M1 Literature Review?',
    '⚠️ How to reduce project risk level?',
    '🚀 Agile milestone & sprint planning',
    '📝 Tips for weekly progress diaries',
  ],
};

// Simple text formatter for AI responses (handles bold, code, lists)
function FormattedContent({ text }) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
      {lines.map((line, idx) => {
        // Bullet list item
        if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-1">
              <span className="text-blue-500 font-bold shrink-0 mt-0.5">•</span>
              <span className="flex-1">{formatInline(line.trim().substring(2))}</span>
            </div>
          );
        }
        // Numbered list item (e.g. "1. ")
        if (/^\d+\.\s/.test(line.trim())) {
          const match = line.trim().match(/^(\d+\.)\s(.*)$/);
          if (match) {
            return (
              <div key={idx} className="flex items-start space-x-2 pl-1">
                <span className="text-indigo-600 font-bold text-xs shrink-0 mt-0.5">{match[1]}</span>
                <span className="flex-1">{formatInline(match[2])}</span>
              </div>
            );
          }
        }
        // Section header (e.g. "### " or "**Header:**")
        if (line.trim().startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-slate-900 pt-1 text-xs sm:text-sm">
              {line.trim().substring(4)}
            </h4>
          );
        }
        // Empty line
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }
        return <p key={idx}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

// Inline formatting helper for bold (**text**) and code (`code`)
function formatInline(str) {
  const parts = [];
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          className="font-mono text-[11px] bg-slate-100 text-blue-700 px-1 py-0.5 rounded border border-slate-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) {
    parts.push(str.substring(lastIndex));
  }
  return parts.length > 0 ? parts : str;
}

export default function AIChatDrawer({ projectName = '' }) {
  const { lang } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [providerInfo, setProviderInfo] = useState('');

  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  const handleSend = async (messageText = null) => {
    const textToSend = typeof messageText === 'string' ? messageText : input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { role: 'user', content: textToSend.trim(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        project_name: projectName,
      });
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: res.data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setProviderInfo(`✨ ${res.data.provider} (${res.data.model})`);
    } catch (err) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content:
            lang === 'en'
              ? '⚠️ Failed to connect to AI engine. Please verify that the AI service is enabled.'
              : '⚠️ Yapay zeka motoruna bağlanılamadı. Lütfen AI servisinin aktif olduğundan emin olun.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      toast.error(lang === 'en' ? 'AI Assistant is currently offline.' : 'Yapay zeka servisine erişilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setProviderInfo('');
    toast.info(lang === 'en' ? 'Conversation cleared.' : 'Sohbet temizlendi.');
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white px-4 py-3 rounded-full shadow-xl hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer font-bold text-xs sm:text-sm group border border-white/20"
        aria-label="AI Asistanını Aç"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
        <span>{lang === 'en' ? 'AI Assistant' : 'AI Asistanı'}</span>
      </button>

      {/* Slide-over Drawer Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 transition-opacity animate-in fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-over Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-inner">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight flex items-center space-x-1.5">
                <span>{lang === 'en' ? 'AI Project Co-Pilot' : 'Yapay Zeka Proje Asistanı'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {providerInfo || (lang === 'en' ? 'Context-Aware Capstone Advisor' : 'Bitirme Projesi Danışmanı')}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                title={lang === 'en' ? 'Clear conversation' : 'Sohbeti Temizle'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
          {messages.length === 0 ? (
            <div className="py-6 px-2 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-inner">
                  <Bot className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">
                  {lang === 'en' ? 'How can I assist your project today?' : 'Bugün projenizde nasıl yardımcı olabilirim?'}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {lang === 'en'
                    ? 'Ask about capstone milestones, technical architecture, team tasks, or project risk mitigation.'
                    : 'Milestone görevleri, teknik mimari, ekip koordinasyonu veya risk yönetimi hakkında dilediğinizi sorabilirsiniz.'}
                </p>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === 'en' ? 'Quick Prompts' : 'Örnek Sorular'}</span>
                </div>
                <div className="space-y-1.5">
                  {(lang === 'en' ? SUGGESTIONS.en : SUGGESTIONS.tr).map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      className="w-full text-left p-2.5 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-xl text-xs text-slate-700 transition flex items-center justify-between group shadow-xs cursor-pointer"
                    >
                      <span className="truncate">{s}</span>
                      <ArrowUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition rotate-45 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Avatar */}
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  {m.role === 'user' ? (
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <FormattedContent text={m.content} />
                  )}

                  {/* Timestamp */}
                  {m.timestamp && (
                    <div
                      className={`text-[10px] mt-1.5 text-right ${
                        m.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      {m.timestamp}
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {m.role === 'user' && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}

          {/* AI Thinking Animation */}
          {loading && (
            <div className="flex items-center space-x-2.5 py-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl rounded-tl-xs text-xs text-slate-500 flex items-center space-x-2 shadow-xs">
                <div className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                </div>
                <span>{lang === 'en' ? 'Thinking...' : 'Yanıt hazırlanıyor...'}</span>
              </div>
            </div>
          )}

          {/* Anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === 'en' ? 'Ask capstone questions...' : 'Projeniz hakkında soru sorun...'}
            className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 border border-transparent transition"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition shadow-xs cursor-pointer shrink-0"
            aria-label="Gönder"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
}
