import React from 'react';
import StatusBadge from './StatusBadge';
import { Calendar, Flag, Upload, Clock } from 'lucide-react';

const PRIORITY_BADGES = {
  Dusuk: { label_tr: 'Düşük', label_en: 'Low', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '↓' },
  Düşük: { label_tr: 'Düşük', label_en: 'Low', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '↓' },
  Orta: { label_tr: 'Orta', label_en: 'Medium', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: '→' },
  Yuksek: { label_tr: 'Yüksek', label_en: 'High', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: '↑' },
  Yüksek: { label_tr: 'Yüksek', label_en: 'High', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: '↑' },
};

export default function ActiveTaskCard({
  task,
  milestoneLabel = '',
  onUpdateStatus,
  onAttachEvidence,
  lang = 'tr',
}) {
  if (!task) return null;

  const prio = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.Orta;
  const prioLabel = lang === 'en' ? (prio.label_en || prio.label_tr) : prio.label_tr;

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-400/80 p-5 shadow-xs relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-amber-500" />

      {/* Header Badge & Title */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1 flex items-center space-x-1">
            <span>⚡</span>
            <span>{lang === 'en' ? 'Active Priority Task' : 'Şu Anki Aktif Görev'}</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 leading-snug">{task.title}</h3>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <StatusBadge status={task.status} lang={lang} />
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${prio.bg}`}
          >
            {prio.icon} {prioLabel}
          </span>
        </div>
      </div>

      {/* Milestone & Deadline info */}
      <div className="flex items-center space-x-4 text-xs text-slate-500 mb-3">
        <span className="flex items-center space-x-1">
          <Flag className="w-3.5 h-3.5 text-blue-600" />
          <strong className="text-slate-700">{task.milestone_key}</strong>
          {milestoneLabel && <span>· {milestoneLabel}</span>}
        </span>
        {task.deadline && (
          <span className="flex items-center space-x-1 text-rose-600 font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            <span>{task.deadline}</span>
          </span>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200/80 leading-relaxed mb-4">
          {task.description}
        </div>
      )}

      {/* Quick Action Controls */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 font-medium">{lang === 'en' ? 'Quick Update:' : 'Hızlı Durum:'}</span>
          <select
            value={task.status}
            onChange={(e) => onUpdateStatus?.(task.id, e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-bold focus:bg-white"
          >
            <option value="TODO">TODO</option>
            <option value="DOING">DOING</option>
            <option value="DONE">DONE</option>
          </select>
        </div>

        <button
          onClick={() => onAttachEvidence?.(task)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{lang === 'en' ? 'Attach Evidence' : 'Kanıt Ekle / Tamamla'}</span>
        </button>
      </div>
    </div>
  );
}
