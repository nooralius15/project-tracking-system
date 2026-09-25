import React from 'react';

const RISK_CONFIG = {
  Dusuk: { label_tr: 'Düşük Risk', label_en: 'Low Risk', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Düşük: { label_tr: 'Düşük Risk', label_en: 'Low Risk', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Orta: { label_tr: 'Orta Risk', label_en: 'Medium Risk', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  Yuksek: { label_tr: 'Yüksek Risk', label_en: 'High Risk', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  Yüksek: { label_tr: 'Yüksek Risk', label_en: 'High Risk', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function RiskBadge({ risk, lang = 'tr' }) {
  const config = RISK_CONFIG[risk] || RISK_CONFIG.Orta;
  const label = lang === 'en' ? config.label_en : config.label_tr;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${config.bg}`}
    >
      {label}
    </span>
  );
}
