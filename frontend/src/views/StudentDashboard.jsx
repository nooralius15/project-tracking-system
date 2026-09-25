import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import {
  CheckCircle2,
  Clock,
  Upload,
  Calendar,
  FileText,
  ExternalLink,
  Layers,
  AlertTriangle,
  History,
  FileCheck,
  X,
} from 'lucide-react';

export default function StudentDashboard() {
  const { lang, user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Task Filter
  const [taskFilter, setTaskFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'DONE'

  // Weekly diary form
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [completedWork, setCompletedWork] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [submittingDiary, setSubmittingDiary] = useState(false);

  // Evidence Modal
  const [evidenceModalTask, setEvidenceModalTask] = useState(null);
  const [taskEvidenceLink, setTaskEvidenceLink] = useState('');
  const [taskEvidenceFile, setTaskEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchStudentData();
  }, []);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const [prjRes, tasksRes, weeklyRes] = await Promise.all([
        api.get('/projects'),
        api.get('/tasks'),
        api.get('/weekly'),
      ]);
      setProjects(prjRes.data);
      if (prjRes.data.length > 0) {
        const prj = prjRes.data[0];
        setActiveProject(prj);
        const fbRes = await api.get(`/feedback?project_name=${encodeURIComponent(prj.name)}`);
        setFeedbacks(fbRes.data);
      }
      setMyTasks(tasksRes.data);
      setWeeklyUpdates(weeklyRes.data);
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to fetch student data.' : 'Öğrenci verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    if (newStatus === 'DONE') {
      const task = myTasks.find((t) => t.id === taskId);
      if (!task?.evidence_link && !task?.evidence_file) {
        setEvidenceModalTask(task);
        toast.info(
          lang === 'en'
            ? 'Evidence is required to complete this task. Please provide link or file.'
            : 'Görevi tamamlamak için lütfen kanıt dosyası veya linki ekleyin.'
        );
        return;
      }
    }
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      toast.success(lang === 'en' ? 'Task status updated!' : 'Görev durumu güncellendi!');
      fetchStudentData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Update failed.' : 'Görev güncellenemedi.'));
    }
  };

  const handleSaveEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceModalTask) return;
    if (!taskEvidenceLink && !taskEvidenceFile) {
      toast.warning(
        lang === 'en'
          ? 'Please provide either a repository URL or upload a file.'
          : 'Lütfen bir bağlantı linki girin veya dosya yükleyin.'
      );
      return;
    }
    setUploading(true);
    try {
      if (taskEvidenceFile) {
        const formData = new FormData();
        formData.append('file', taskEvidenceFile);
        await api.post(`/tasks/${evidenceModalTask.id}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await api.patch(`/tasks/${evidenceModalTask.id}`, {
        status: 'DONE',
        evidence_link: taskEvidenceLink,
      });
      toast.success(
        lang === 'en'
          ? 'Task marked as DONE with attached evidence!'
          : 'Kanıt kaydedildi ve görev DONE olarak işaretlendi!'
      );
      setEvidenceModalTask(null);
      setTaskEvidenceLink('');
      setTaskEvidenceFile(null);
      fetchStudentData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to save evidence.' : 'Kanıt kaydedilemedi.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitDiary = async (e) => {
    e.preventDefault();
    if (!activeProject) {
      toast.warning(lang === 'en' ? 'No active project selected.' : 'Aktif proje bulunamadı.');
      return;
    }
    if (!completedWork.trim()) {
      toast.warning(lang === 'en' ? 'Please describe completed work.' : 'Lütfen tamamlanan çalışmaları belirtin.');
      return;
    }

    setSubmittingDiary(true);
    try {
      await api.post('/weekly', {
        project_name: activeProject.name,
        week_start: weekStart,
        completed: completedWork,
        blockers: blockers,
        next_step: nextStep,
        evidence_link: evidenceLink,
      });
      toast.success(
        lang === 'en'
          ? 'Weekly progress diary submitted successfully!'
          : 'Haftalık ilerleme raporunuz başarıyla kaydedildi!'
      );
      setCompletedWork('');
      setBlockers('');
      setNextStep('');
      setEvidenceLink('');
      const weeklyRes = await api.get('/weekly');
      setWeeklyUpdates(weeklyRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Submission failed.' : 'Rapor gönderilemedi.'));
    } finally {
      setSubmittingDiary(false);
    }
  };

  // Filter tasks
  const filteredTasks = myTasks.filter((t) => {
    if (taskFilter === 'ACTIVE') return t.status === 'TODO' || t.status === 'DOING';
    if (taskFilter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const completedTasksCount = myTasks.filter((t) => t.status === 'DONE').length;
  const isOverdue = (deadline, status) => {
    if (!deadline || status === 'DONE') return false;
    const today = new Date().toISOString().split('T')[0];
    return deadline < today;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Student Profile Hero */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-3xl shrink-0 shadow-inner">
            🎓
          </div>
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              {lang === 'en' ? 'Student Workspace' : 'Öğrenci Çalışma Paneli'}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{user?.display_name}</h1>
            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">{user?.user_id}</span>
              <span>·</span>
              <span>📁 {activeProject?.name || 'Bitirme Projesi'}</span>
              <span>·</span>
              <span>👨‍🏫 {activeProject?.advisor_name || 'Danışman'}</span>
            </div>
          </div>
        </div>

        {/* Task counter */}
        <div className="bg-slate-50 px-6 py-3.5 rounded-xl border border-slate-200 flex items-center space-x-4 shrink-0">
          <div>
            <div className="text-xs text-slate-400 font-semibold">{lang === 'en' ? 'My Progress' : 'Görev Takibi'}</div>
            <div className="text-2xl font-extrabold text-blue-600">
              {completedTasksCount} / {myTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Tasks & Weekly Diary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: My Assigned Tasks */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{lang === 'en' ? 'My Assigned Tasks' : 'Sorumlu Olduğum Görevler'}</span>
              <span className="text-xs font-normal text-slate-400">({myTasks.length})</span>
            </h2>

            {/* Quick Task Filter Tabs */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs self-start">
              <button
                onClick={() => setTaskFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  taskFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                {lang === 'en' ? 'All' : 'Tümü'} ({myTasks.length})
              </button>
              <button
                onClick={() => setTaskFilter('ACTIVE')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  taskFilter === 'ACTIVE' ? 'bg-white text-blue-600 shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                {lang === 'en' ? 'Active' : 'Devam Eden'} ({myTasks.filter((t) => t.status !== 'DONE').length})
              </button>
              <button
                onClick={() => setTaskFilter('DONE')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  taskFilter === 'DONE' ? 'bg-white text-emerald-600 shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                {lang === 'en' ? 'Done' : 'Tamamlanan'} ({completedTasksCount})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center space-y-2">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>{lang === 'en' ? 'Loading tasks...' : 'Görevler yükleniyor...'}</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                {taskFilter === 'DONE'
                  ? (lang === 'en' ? 'No completed tasks yet.' : 'Henüz tamamlanan görev yok.')
                  : (lang === 'en' ? 'No active tasks assigned to you.' : 'Size atanmış aktif görev bulunmuyor.')}
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'en'
                  ? 'Your project leader assigns tasks during each capstone milestone.'
                  : 'Grup lideriniz her proje aşamasında görev dağılımı yapacaktır.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredTasks.map((t) => {
                const overdue = isOverdue(t.deadline, t.status);
                const hasEvidence = !!(t.evidence_link || t.evidence_file);

                return (
                  <div
                    key={t.id}
                    className={`bg-white p-5 rounded-2xl border transition-all space-y-3 shadow-xs hover:shadow-md ${
                      overdue
                        ? 'border-rose-300 bg-rose-50/20'
                        : t.status === 'DONE'
                        ? 'border-slate-200 bg-white opacity-90'
                        : 'border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1.5">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {t.milestone_key}
                          </span>
                          {t.priority && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                t.priority === 'Yüksek'
                                  ? 'bg-rose-100 text-rose-700'
                                  : t.priority === 'Orta'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {t.priority}
                            </span>
                          )}
                          {overdue && (
                            <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded">
                              <AlertTriangle className="w-3 h-3" />
                              <span>{lang === 'en' ? 'OVERDUE' : 'GECİKTİ'}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{t.title}</h3>
                        {t.description && (
                          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{t.description}</p>
                        )}
                      </div>
                      <StatusBadge status={t.status} lang={lang} />
                    </div>

                    {/* Evidence Status Pill */}
                    {hasEvidence ? (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50/80 border border-emerald-200/80 p-2.5 rounded-xl flex items-center justify-between font-medium">
                        <div className="flex items-center space-x-2">
                          <FileCheck className="w-4 h-4 text-emerald-600" />
                          <span>{lang === 'en' ? 'Evidence submitted & verified' : 'Kanıt teslim edildi'}</span>
                        </div>
                        {t.evidence_link && (
                          <a
                            href={t.evidence_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center space-x-1 text-blue-600 hover:underline font-semibold"
                          >
                            <span>{lang === 'en' ? 'View' : 'Görüntüle'}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-800 bg-amber-50/60 border border-amber-200/60 p-2 rounded-xl flex items-center justify-between">
                        <span className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>{lang === 'en' ? 'Evidence required upon completion' : 'Tamamlamak için kanıt gereklidir'}</span>
                        </span>
                        <button
                          onClick={() => setEvidenceModalTask(t)}
                          className="text-xs font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                        >
                          {lang === 'en' ? 'Attach Now' : 'Kanıt Ekle'}
                        </button>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className={overdue ? 'text-rose-600 font-bold' : ''}>
                          {t.deadline || (lang === 'en' ? 'No deadline' : 'Bitiş tarihi yok')}
                        </span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateTaskStatus(t.id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-slate-50 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          <option value="TODO">TODO</option>
                          <option value="DOING">DOING</option>
                          <option value="DONE">DONE</option>
                        </select>
                        <button
                          onClick={() => setEvidenceModalTask(t)}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition cursor-pointer"
                          title="Kanıt Dosyası / Linki Ekle"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{lang === 'en' ? 'Evidence' : 'Kanıt'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Weekly Diary & Feedback */}
        <div className="lg:col-span-5 space-y-6">
          {/* Weekly Report Form */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {lang === 'en' ? 'Weekly Progress Diary' : 'Haftalık İlerleme Raporu'}
                </h2>
                <div className="text-[11px] text-slate-400">
                  {lang === 'en' ? 'Submit your weekly capstone log' : 'Haftalık çalışma günlüğünüzü kaydedin'}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitDiary} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Week Starting Date' : 'Hafta Başlangıç Tarihi'}
                </label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Completed Work & Tasks' : 'Bu Hafta Tamamlanan Çalışmalar'}
                </label>
                <textarea
                  rows={2}
                  placeholder={lang === 'en' ? 'Code written, research done, meetings held...' : 'Yazılan kod, testler, yapılan araştırmalar...'}
                  value={completedWork}
                  onChange={(e) => setCompletedWork(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Blockers / Challenges' : 'Karşılaşılan Engeller / Sorunlar'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Any technical blockers or missing dependencies?' : 'Teknik aksaklık veya engel var mı?'}
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Next Week Goals' : 'Gelecek Hafta Hedefleri'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Planned tasks for next week...' : 'Gelecek hafta planlanan maddeler...'}
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Evidence / Commit / PR Link' : 'Kanıt / Commit / PR Linki'}
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingDiary}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition shadow-xs cursor-pointer"
              >
                {submittingDiary
                  ? (lang === 'en' ? 'Submitting Diary...' : 'Kaydediliyor...')
                  : (lang === 'en' ? 'Submit Weekly Diary' : 'Raporu Kaydet')}
              </button>
            </form>
          </div>

          {/* Advisor Feedbacks Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <FileText className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">
                {lang === 'en' ? 'Advisor Feedback & Directives' : 'Danışman Notları & Yönergeler'}
              </h2>
            </div>

            {feedbacks.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                {lang === 'en' ? 'No advisor notes provided yet.' : 'Danışmandan henüz not iletilmedi.'}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {feedbacks.map((fb) => (
                  <div key={fb.id} className="p-3.5 bg-indigo-50/50 rounded-xl text-xs space-y-1.5 border border-indigo-100">
                    <p className="text-slate-800 font-medium leading-relaxed">{fb.feedback}</p>
                    {fb.action_item && (
                      <div className="text-[11px] font-semibold text-indigo-700 flex items-center space-x-1">
                        <span>🎯</span>
                        <span>{fb.action_item}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-indigo-100/60">
                      <span>{fb.advisor_name}</span>
                      <span>{fb.created_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Weekly Reports Card */}
          {weeklyUpdates.length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <History className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">
                  {lang === 'en' ? 'My Weekly Diary Entries' : 'Haftalık Günlük Kayıtlarım'}
                </h2>
                <span className="text-xs text-slate-400 font-normal">({weeklyUpdates.length})</span>
              </div>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {weeklyUpdates.map((rep) => (
                  <div key={rep.id} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-200">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                      <span>📅 {rep.week_start}</span>
                      {rep.evidence_link && (
                        <a
                          href={rep.evidence_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center font-bold"
                        >
                          <span>{lang === 'en' ? 'Evidence' : 'Kanıt'}</span>
                          <ExternalLink className="w-3 h-3 ml-0.5" />
                        </a>
                      )}
                    </div>
                    <div className="text-slate-800 font-medium leading-relaxed">{rep.completed}</div>
                    {rep.next_step && (
                      <div className="text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{lang === 'en' ? 'Next:' : 'Hedef:'}</span> {rep.next_step}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Upload Modal */}
      {evidenceModalTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {lang === 'en' ? 'Submit Task Evidence' : '📎 Görevi Tamamlamak İçin Kanıt Ekleyin'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  #{evidenceModalTask.id} - {evidenceModalTask.title}
                </p>
              </div>
              <button
                onClick={() => setEvidenceModalTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvidence} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Repository or PR URL' : 'Repo / PR / Doküman Linki'}
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={taskEvidenceLink}
                  onChange={(e) => setTaskEvidenceLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Upload Evidence File (PDF, PNG, ZIP)' : 'Dosya Yükle (PDF, PNG, ZIP vb.)'}
                </label>
                <input
                  type="file"
                  onChange={(e) => setTaskEvidenceFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvidenceModalTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                >
                  {lang === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  {uploading
                    ? (lang === 'en' ? 'Uploading...' : 'Yükleniyor...')
                    : (lang === 'en' ? 'Complete Task (DONE)' : 'Görevi Tamamla (DONE)')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
