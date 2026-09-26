import React from 'react';

const MILESTONES = [
  { key: 'M1', label_tr: 'Literatür taraması', label_en: 'Literature Review' },
  { key: 'M2', label_tr: 'Algoritma ve uygulama planı', label_en: 'Algorithm & Architecture' },
  { key: 'M3', label_tr: 'Uygulamayı boot etme', label_en: 'MVP Bootstrapping' },
  { key: 'M4', label_tr: 'Deneme ve sonuç değerlendirme', label_en: 'Testing & Evaluation' },
  { key: 'M5', label_tr: 'Hata düzeltme ve revizyon', label_en: 'Bug Fixes & Refinements' },
  { key: 'M6', label_tr: 'Proje yazımı ve final rapor', label_en: 'Documentation & Final Report' },
];

export default function MilestoneProgress({ tasks = [], lang = 'tr' }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
          <span>📊</span>
          <span>{lang === 'en' ? 'Milestone Progression' : 'Milestone İlerlemesi'}</span>
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">M1 ➔ M6</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {MILESTONES.map((m) => {
          const msTasks = tasks.filter((t) => t.milestone_key === m.key);
          const total = msTasks.length;
          const done = msTasks.filter((t) => t.status === 'DONE').length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          let colorClass = 'bg-slate-500';
          let textClass = 'text-slate-500';
          let borderClass = 'border-slate-200';
          let icon = '⬜';

          if (pct >= 100) {
            colorClass = 'bg-emerald-500';
            textClass = 'text-emerald-600';
            borderClass = 'border-emerald-300';
            icon = '✅';
          } else if (pct >= 50) {
            colorClass = 'bg-blue-600';
            textClass = 'text-blue-600';
            borderClass = 'border-blue-300';
            icon = '🔵';
          } else if (pct > 0) {
            colorClass = 'bg-amber-500';
            textClass = 'text-amber-600';
            borderClass = 'border-amber-300';
            icon = '🟡';
          }

          const label = lang === 'en' ? m.label_en : m.label_tr;

          return (
            <div
              key={m.key}
              className={`p-3 rounded-xl border bg-slate-50/70 hover:bg-white hover:shadow-xs transition flex flex-col justify-between ${borderClass}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold text-white font-mono ${colorClass}`}
                  >
                    {m.key}
                  </span>
                  <span className="text-xs">{icon}</span>
                </div>
                <div className="text-[11px] font-semibold text-slate-800 line-clamp-2 leading-snug">
                  {label}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-black ${textClass}`}>%{pct}</span>
                  <span className="text-slate-400 text-[10px]">
                    {done}/{total} {lang === 'en' ? 'tasks' : 'görev'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${colorClass}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
