import React from 'react';

export default function FeedbackCard({ feedback, lang = 'tr' }) {
  if (!feedback) return null;

  const isRevision = Boolean(feedback.revision_required);
  const borderColor = isRevision ? 'border-rose-500' : 'border-blue-600';
  const bgColor = isRevision ? 'bg-rose-50/60' : 'bg-slate-50/80';
  const icon = isRevision ? '🔴' : '💬';

  return (
    <div
      className={`rounded-xl border border-slate-200 border-l-4 ${borderColor} ${bgColor} overflow-hidden shadow-xs space-y-2 p-3.5`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span>{icon}</span>
          <span className="text-xs font-bold text-slate-900">{feedback.advisor_name}</span>
        </div>
        <div className="flex items-center space-x-2">
          {isRevision && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
              {lang === 'en' ? 'Revision Required' : 'Revizyon Zorunlu'}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {feedback.created_at ? String(feedback.created_at).slice(0, 10) : ''}
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-700 leading-relaxed">{feedback.feedback}</p>

      {feedback.action_item && (
        <div className="p-2 rounded-lg bg-black/5 text-[11px] text-slate-800 font-medium">
          📌 <strong>{lang === 'en' ? 'Action Item:' : 'Aksiyon:'}</strong> {feedback.action_item}
        </div>
      )}
    </div>
  );
}
