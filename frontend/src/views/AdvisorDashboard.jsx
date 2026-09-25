import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import RiskBadge from '../components/RiskBadge';
import StatusBadge from '../components/StatusBadge';
import {
  FolderKanban,
  Users,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  X,
  UserPlus,
  MessageSquareQuote,
  Search,
  Check,
  Crown,
  Layers,
} from 'lucide-react';

export default function AdvisorDashboard() {
  const { lang, user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectFeedbacks, setProjectFeedbacks] = useState([]);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL'); // 'ALL' | 'Yuksek' | 'Orta' | 'Dusuk'

  // AI Report Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModelTag, setAiModelTag] = useState('');

  // Feedback Form State
  const [feedbackText, setFeedbackText] = useState('');
  const [actionItem, setActionItem] = useState('');
  const [revisionRequired, setRevisionRequired] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Assign Leader State
  const [newLeaderNo, setNewLeaderNo] = useState('');
  const [assigningLeader, setAssigningLeader] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to fetch projects.' : 'Projeler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = async (prjName) => {
    setSelectedProject(prjName);
    setDetailLoading(true);
    try {
      const [detailRes, tasksRes, fbRes] = await Promise.all([
        api.get(`/projects/${encodeURIComponent(prjName)}`),
        api.get(`/tasks?project_name=${encodeURIComponent(prjName)}`),
        api.get(`/feedback?project_name=${encodeURIComponent(prjName)}`),
      ]);
      setProjectDetail(detailRes.data);
      setProjectTasks(tasksRes.data);
      setProjectFeedbacks(fbRes.data);
      // Preselect current leader in dropdown
      const currLeader = detailRes.data.members?.find((m) => m.role === 'Lider');
      if (currLeader) setNewLeaderNo(currLeader.student_no);
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load project details.' : 'Proje detayları yüklenemedi.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleGenerateAIReport = async () => {
    setAiModalOpen(true);
    setAiLoading(true);
    try {
      const res = await api.post('/ai/advisor-report', { lang });
      setAiReport(res.data.report);
      setAiModelTag(`${res.data.provider} (${res.data.model})`);
      toast.success(lang === 'en' ? 'AI Diagnostic report ready.' : 'Yapay zeka teşhis raporu hazırlandı.');
    } catch (err) {
      setAiReport(lang === 'en' ? 'Failed to generate report.' : 'Rapor oluşturulamadı.');
      toast.error(lang === 'en' ? 'AI service currently unavailable.' : 'AI servisine erişilemedi.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAssignLeader = async (e) => {
    e.preventDefault();
    if (!newLeaderNo) {
      toast.warning(lang === 'en' ? 'Please select a student.' : 'Lütfen bir öğrenci seçin.');
      return;
    }
    setAssigningLeader(true);
    try {
      await api.post(`/projects/${encodeURIComponent(selectedProject)}/leader`, {
        student_no: newLeaderNo,
      });
      toast.success(lang === 'en' ? 'Leader assigned successfully!' : 'Grup lideri başarıyla atandı!');
      handleSelectProject(selectedProject);
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to assign leader.' : 'Lider atanamadı.'));
    } finally {
      setAssigningLeader(false);
    }
  };

  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setSendingFeedback(true);
    try {
      await api.post('/feedback', {
        project_name: selectedProject,
        feedback: feedbackText,
        action_item: actionItem,
        revision_required: revisionRequired,
      });
      toast.success(lang === 'en' ? 'Feedback submitted successfully!' : 'Danışman geri bildirimi kaydedildi!');
      setFeedbackText('');
      setActionItem('');
      setRevisionRequired(false);
      const fbRes = await api.get(`/feedback?project_name=${encodeURIComponent(selectedProject)}`);
      setProjectFeedbacks(fbRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to submit feedback.' : 'Hata oluştu.'));
    } finally {
      setSendingFeedback(false);
    }
  };

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.leader && p.leader.toLowerCase().includes(term));

    if (!matchesSearch) return false;
    if (riskFilter === 'ALL') return true;

    const r = (p.risk || '').toLowerCase();
    if (riskFilter === 'Yuksek') return r.includes('yuksek') || r.includes('yüksek') || r.includes('high');
    if (riskFilter === 'Orta') return r.includes('orta') || r.includes('medium');
    if (riskFilter === 'Dusuk') return r.includes('dusuk') || r.includes('düşük') || r.includes('low');
    return true;
  });

  const totalMembers = projects.reduce((acc, p) => acc + p.members_count, 0);
  const highRiskCount = projects.filter((p) => p.risk === 'Yuksek' || p.risk === 'Yüksek').length;
  const mediumRiskCount = projects.filter((p) => p.risk === 'Orta' || p.risk === 'Medium').length;
  const lowRiskCount = projects.filter((p) => p.risk === 'Dusuk' || p.risk === 'Düşük' || p.risk === 'Low').length;
  const totalOverdue = projects.reduce((acc, p) => acc + p.overdue_count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            {lang === 'en' ? 'Academic Advisor Portfolio' : 'Danışman Proje Portföyü'}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {user?.display_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {lang === 'en'
              ? `Supervising ${projects.length} capstone projects with ${totalMembers} students.`
              : `${projects.length} bitirme projesi ve ${totalMembers} öğrenci yönetilmektedir.`}
          </p>
        </div>

        {/* AI Portfolio Diagnosis Button */}
        <button
          onClick={handleGenerateAIReport}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{lang === 'en' ? 'AI Portfolio Diagnosis' : '🤖 Yapay Zeka ile Portföy Analizi'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'en' ? 'Active Projects' : 'Aktif Projeler'}</span>
            <FolderKanban className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{projects.length}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'en' ? 'Total Students' : 'Toplam Öğrenci'}</span>
            <Users className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalMembers}</div>
        </div>
        <div
          onClick={() => setRiskFilter(riskFilter === 'Yuksek' ? 'ALL' : 'Yuksek')}
          className={`p-5 rounded-xl border shadow-xs cursor-pointer transition ${
            riskFilter === 'Yuksek'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
              : 'bg-white border-slate-200 hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'en' ? 'High Risk Groups' : 'Yüksek Riskli'}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{highRiskCount}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">{lang === 'en' ? 'Overdue Tasks' : 'Geciken Görevler'}</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">{totalOverdue}</div>
        </div>
      </div>

      {/* Projects Section with Search & Filter */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <span>📁 {lang === 'en' ? 'Projects Overview' : 'Proje Listesi'}</span>
            <span className="text-xs font-normal text-slate-400">
              ({filteredProjects.length} / {projects.length})
            </span>
          </h2>

          {/* Search Box & Risk Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'en' ? 'Search projects or leaders...' : 'Proje adı veya lider ara...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-60 pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Risk Filter Buttons */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setRiskFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  riskFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {lang === 'en' ? 'All' : 'Tümü'}
              </button>
              <button
                onClick={() => setRiskFilter('Yuksek')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                  riskFilter === 'Yuksek'
                    ? 'bg-rose-600 text-white font-bold shadow-xs'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
              >
                <span>{lang === 'en' ? 'High' : 'Yüksek'}</span>
                {highRiskCount > 0 && (
                  <span className="ml-1 px-1 py-0.2 bg-white/20 text-[10px] rounded-full">
                    {highRiskCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRiskFilter('Orta')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                  riskFilter === 'Orta'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                <span>{lang === 'en' ? 'Medium' : 'Orta'}</span>
                {mediumRiskCount > 0 && (
                  <span className="ml-1 px-1 py-0.2 bg-black/10 text-[10px] rounded-full">
                    {mediumRiskCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRiskFilter('Dusuk')}
                className={`px-2.5 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                  riskFilter === 'Dusuk'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <span>{lang === 'en' ? 'Low' : 'Düşük'}</span>
                {lowRiskCount > 0 && (
                  <span className="ml-1 px-1 py-0.2 bg-white/20 text-[10px] rounded-full">
                    {lowRiskCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid or Empty State */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>{lang === 'en' ? 'Loading projects...' : 'Projeler yükleniyor...'}</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Search className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">
              {lang === 'en' ? 'No projects match your filter' : 'Arama kriterlerinize uygun proje bulunamadı'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'en'
                ? 'Try adjusting your search query or risk filter.'
                : 'Arama teriminizi veya risk filtrenizi değiştirmeyi deneyebilirsiniz.'}
            </p>
            {(searchQuery || riskFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setRiskFilter('ALL');
                }}
                className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                {lang === 'en' ? 'Reset Filters' : 'Filtreleri Temizle'}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((p) => (
              <div
                key={p.name}
                onClick={() => handleSelectProject(p.name)}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition">
                      {p.name}
                    </h3>
                    <RiskBadge risk={p.risk} lang={lang} />
                  </div>
                  <div className="text-xs text-slate-500 mb-4 flex items-center space-x-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-700">{lang === 'en' ? 'Leader:' : 'Lider:'}</span>
                    <span className="truncate">{p.leader || '—'}</span>
                  </div>
                </div>

                <div>
                  {/* Progress Bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-500">{lang === 'en' ? 'Progress' : 'İlerleme'}</span>
                      <span className="text-blue-600 font-bold">%{Math.round(p.completion_pct)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, p.completion_pct))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-slate-100">
                    <span className="flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.members_count} {lang === 'en' ? 'members' : 'üye'}</span>
                    </span>
                    <span className="flex items-center text-blue-600 font-semibold group-hover:underline">
                      {lang === 'en' ? 'Manage' : 'İncele'} <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Portfolio Diagnosis Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {lang === 'en' ? 'AI Portfolio Diagnosis Report' : 'Yapay Zeka Portföy Teşhis Raporu'}
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'en' ? 'Capstone risk assessment & recommendations' : 'Tüm projeler için risk analizi ve öneriler'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto text-sm leading-relaxed text-slate-800 space-y-4 whitespace-pre-wrap">
              {aiLoading ? (
                <div className="text-center py-16 space-y-3">
                  <Sparkles className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">
                    {lang === 'en' ? 'Analyzing all capstone projects & metrics...' : 'Tüm projeler, gecikmeler ve risk faktörleri analiz ediliyor...'}
                  </p>
                </div>
              ) : (
                aiReport
              )}
            </div>
            {aiModelTag && (
              <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>Engine: {aiModelTag}</span>
                <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Analysis Complete' : 'Analiz Tamamlandı'}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Detail Slide-over Drawer */}
      {selectedProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
          <div className="bg-white w-full sm:max-w-xl md:max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex-1 pr-3">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                    {lang === 'en' ? 'Project Details' : 'Proje İnceleme'}
                  </span>
                  {projectDetail?.risk && (
                    <RiskBadge risk={projectDetail.risk} lang={lang} />
                  )}
                </div>
                <h2 className="text-base font-bold leading-snug line-clamp-2 text-white">
                  {projectDetail?.name || selectedProject}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setProjectDetail(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            {detailLoading || !projectDetail ? (
              <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                <div className="flex flex-col items-center space-y-2">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>{lang === 'en' ? 'Loading project details...' : 'Proje detayları yükleniyor...'}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50">
                {/* Leader Reassignment Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span>{lang === 'en' ? 'Appoint / Change Group Leader' : 'Grup Lideri Ata / Değiştir'}</span>
                  </h3>
                  <form onSubmit={handleAssignLeader} className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={newLeaderNo}
                      onChange={(e) => setNewLeaderNo(e.target.value)}
                      className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{lang === 'en' ? '-- Select a student --' : '-- Öğrenci seçin --'}</option>
                      {projectDetail.members?.map((m) => (
                        <option key={m.student_no} value={m.student_no}>
                          {m.student_name} ({m.student_no}) {m.role === 'Lider' ? '★ (Mevcut Lider)' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={assigningLeader || !newLeaderNo}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
                    >
                      {assigningLeader
                        ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
                        : (lang === 'en' ? 'Assign' : 'Ata')}
                    </button>
                  </form>
                </div>

                {/* Members List */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>{lang === 'en' ? 'Team Members' : 'Ekip Üyeleri'}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {projectDetail.members?.length || 0} {lang === 'en' ? 'students' : 'öğrenci'}
                    </span>
                  </h3>
                  <div className="divide-y divide-slate-100">
                    {projectDetail.members?.map((m) => (
                      <div key={m.student_no} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-[11px]">
                            {m.student_name ? m.student_name[0] : 'Ö'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center space-x-1">
                              <span>{m.student_name}</span>
                              {m.role === 'Lider' && <Crown className="w-3 h-3 text-amber-500" />}
                            </div>
                            <div className="text-[11px] text-slate-400">{m.student_no} · {m.program || 'Mühendislik'}</div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.role === 'Lider'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Milestone Tasks */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Layers className="w-4 h-4 text-blue-600" />
                      <span>{lang === 'en' ? 'Milestone Tasks' : 'Milestone Görevleri'}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {projectTasks.length} {lang === 'en' ? 'tasks' : 'görev'}
                    </span>
                  </h3>
                  {projectTasks.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs">
                      {lang === 'en' ? 'No tasks registered yet.' : 'Henüz tanımlı görev bulunmuyor.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {projectTasks.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                              <span className="font-mono font-bold text-blue-600">{t.milestone_key}</span>
                              <span>·</span>
                              <span>{t.assignee_name || t.assignee_student_no}</span>
                              <span>·</span>
                              <span>{t.deadline || 'Süresiz'}</span>
                            </div>
                          </div>
                          <StatusBadge status={t.status} lang={lang} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Advisor Feedback & Action Items */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <MessageSquareQuote className="w-4 h-4 text-indigo-600" />
                    <span>{lang === 'en' ? 'Advisor Feedback & Action Items' : 'Danışman Değerlendirmesi & Direktif'}</span>
                  </h3>

                  <form onSubmit={handleSendFeedback} className="space-y-3">
                    <textarea
                      rows={3}
                      placeholder={lang === 'en' ? 'Write official review for this project...' : 'Proje ilerleyişi hakkında resmi danışman notunuz...'}
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder={lang === 'en' ? 'Action item / next milestone goal...' : 'Aksiyon maddesi / sonraki hedef...'}
                      value={actionItem}
                      onChange={(e) => setActionItem(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <label className="flex items-center space-x-1.5 text-xs text-rose-600 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={revisionRequired}
                          onChange={(e) => setRevisionRequired(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span>{lang === 'en' ? 'Revision required before next step' : 'Revizyon zorunlu'}</span>
                      </label>
                      <button
                        type="submit"
                        disabled={sendingFeedback || !feedbackText.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition cursor-pointer"
                      >
                        {sendingFeedback
                          ? (lang === 'en' ? 'Sending...' : 'İletiliyor...')
                          : (lang === 'en' ? 'Send Feedback' : 'Geri Bildirim Gönder')}
                      </button>
                    </div>
                  </form>

                  {/* Previous Feedbacks */}
                  {projectFeedbacks.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {lang === 'en' ? 'Feedback History' : 'Geçmiş Değerlendirmeler'}
                      </div>
                      {projectFeedbacks.map((fb) => (
                        <div key={fb.id} className="p-3 bg-indigo-50/60 border border-indigo-100/80 rounded-xl text-xs space-y-1.5">
                          <div className="text-slate-800 font-medium leading-relaxed">{fb.feedback}</div>
                          {fb.action_item && (
                            <div className="text-[11px] text-indigo-700 font-semibold flex items-center space-x-1">
                              <span>🎯</span>
                              <span>{fb.action_item}</span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-indigo-100/50">
                            <span>{fb.advisor_name}</span>
                            <span>{fb.created_at}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
