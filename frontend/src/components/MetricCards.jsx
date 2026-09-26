import React from 'react';
import { CheckCircle2, ListTodo, UserCheck, TrendingUp } from 'lucide-react';

export default function MetricCards({
  projectTaskCount = 0,
  projectCompletionPct = 0,
  myTaskCount = 0,
  myCompletionPct = 0,
  lang = 'tr',
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Proje Görevi */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {lang === 'en' ? 'Project Tasks' : 'Proje Görevi'}
          </div>
          <div className="text-2xl font-black text-slate-900">{projectTaskCount}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <ListTodo className="w-5 h-5" />
        </div>
      </div>

      {/* Proje Tamamlanma */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {lang === 'en' ? 'Project Progress' : 'Proje Tamamlanma'}
          </div>
          <div className="text-2xl font-black text-blue-600">%{Math.round(projectCompletionPct)}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* Benim Görevim */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {lang === 'en' ? 'My Assigned Tasks' : 'Benim Görevim'}
          </div>
          <div className="text-2xl font-black text-slate-900">{myTaskCount}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <UserCheck className="w-5 h-5" />
        </div>
      </div>

      {/* Benim İlerlemem */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {lang === 'en' ? 'My Progress' : 'Benim İlerlemem'}
          </div>
          <div className="text-2xl font-black text-emerald-600">%{Math.round(myCompletionPct)}</div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
