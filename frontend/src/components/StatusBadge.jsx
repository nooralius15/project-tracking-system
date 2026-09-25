import React from 'react';

const STATUS_CONFIG = {
  TODO: { label_tr: 'YAPILACAK', label_en: 'TO DO', bg: 'bg-slate-100 text-slate-700 border-slate-300' },
  DOING: { label_tr: 'DEVAM EDİYOR', label_en: 'IN PROGRESS', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
  DONE: { label_tr: 'TAMAMLANDI', label_en: 'DONE', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
};

export default function StatusBadge({ status, lang = 'tr' }) {
  const config = STATUS_CONFIG[status] || {
    label_tr: status,
    label_en: status,
    bg: 'bg-gray-100 text-gray-700 border-gray-300',
  };
  const label = lang === 'en' ? config.label_en : config.label_tr;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}
    >
      {label}
    </span>
  );
}
