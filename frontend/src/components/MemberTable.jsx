import React from 'react';

const ROLE_COLORS = {
  Lider: 'bg-amber-100 text-amber-800 border-amber-300',
  Yazılım: 'bg-blue-100 text-blue-800 border-blue-300',
  Donanım: 'bg-purple-100 text-purple-800 border-purple-300',
  Test: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  Raporlama: 'bg-rose-100 text-rose-800 border-rose-300',
  Üye: 'bg-slate-100 text-slate-800 border-slate-300',
};

const ROLE_LABELS_EN = {
  Lider: 'Leader',
  Yazılım: 'Software',
  Donanım: 'Hardware',
  Test: 'Testing',
  Raporlama: 'Reporting',
  Üye: 'Member',
  Araştırma: 'Research',
  Veri: 'Data',
  Sunum: 'Presentation',
  Diğer: 'Other',
};

export default function MemberTable({ members = [], leaderNo = '', lang = 'tr' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
          <span>👥</span>
          <span>{lang === 'en' ? 'Team Members & Assigned Roles' : 'Takım Üyeleri & Roller'}</span>
        </h3>
        <span className="text-xs text-slate-400 font-medium">
          {members.length} {lang === 'en' ? 'members' : 'öğrenci'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0a2342] text-white uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4 font-semibold">{lang === 'en' ? 'Student ID' : 'No'}</th>
              <th className="py-3 px-4 font-semibold">{lang === 'en' ? 'Full Name' : 'Ad Soyad'}</th>
              <th className="py-3 px-4 font-semibold">{lang === 'en' ? 'Role' : 'Rol'}</th>
              <th className="py-3 px-4 font-semibold">{lang === 'en' ? 'Responsibility' : 'Görev Tanımı'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const isLead = String(m.student_no) === String(leaderNo);
              const badgeClass = ROLE_COLORS[m.role] || 'bg-slate-100 text-slate-700 border-slate-300';
              const roleDisplay = lang === 'en' ? (ROLE_LABELS_EN[m.role] || m.role) : m.role;

              return (
                <tr key={m.student_no} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-mono font-medium text-slate-500">
                    {m.student_no}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-1.5">
                    {isLead && <span title={lang === 'en' ? 'Team Leader' : 'Grup Lideri'}>👑</span>}
                    <span>{m.student_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                    >
                      {roleDisplay}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-normal">
                    {m.responsibility || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
