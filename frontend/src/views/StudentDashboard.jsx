import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MilestoneProgress from '../components/MilestoneProgress';
import MemberTable from '../components/MemberTable';
import MetricCards from '../components/MetricCards';
import ActiveTaskCard from '../components/ActiveTaskCard';
import FeedbackCard from '../components/FeedbackCard';
import StatusBadge from '../components/StatusBadge';
import { CheckCircle2, Clock, Upload, MessageSquare, Send, Calendar, AlertCircle, FileText, Check, ExternalLink, X } from 'lucide-react';

export default function StudentDashboard() {
  const { lang, user } = useAuth();
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [projectTasks, setProjectTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [weeklyUpdates, setWeeklyUpdates] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Weekly diary form
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().split('T')[0]);
  const [completedWork, setCompletedWork] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [evidenceLink, setEvidenceLink] = useState('');
  const [diarySubmitting, setDiarySubmitting] = useState(false);

  // Evidence Modal
  const [evidenceModalTask, setEvidenceModalTask] = useState(null);
  const [taskEvidenceLink, setTaskEvidenceLink] = useState('');
  const [taskEvidenceFile, setTaskEvidenceFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Comment Modal
  const [activeTaskComments, setActiveTaskComments] = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [newComment, setNewComment] = useState('');

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
      setMyTasks(tasksRes.data);
      setWeeklyUpdates(weeklyRes.data);

      if (prjRes.data.length > 0) {
        const prj = prjRes.data[0];
        setActiveProject(prj);
        const [detailRes, pTasksRes, fbRes] = await Promise.all([
          api.get(`/projects/${encodeURIComponent(prj.name)}`),
          api.get(`/tasks?project_name=${encodeURIComponent(prj.name)}`),
          api.get(`/feedback?project_name=${encodeURIComponent(prj.name)}`),
        ]);
        setProjectMembers(detailRes.data.members || []);
        setProjectTasks(pTasksRes.data || []);
        setFeedbacks(fbRes.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load student data.' : 'Öğrenci verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    if (newStatus === 'DONE') {
      const task = myTasks.find((t) => t.id === taskId);
      if (!task?.evidence_link && !task?.evidence_file) {
        setEvidenceModalTask(task);
        return;
      }
    }
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      toast.success(lang === 'en' ? 'Task status updated!' : 'Görev durumu güncellendi!');
      fetchStudentData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to update task.' : 'Görev güncellenemedi.'));
    }
  };

  const handleSaveEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceModalTask) return;
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
      toast.success(lang === 'en' ? 'Evidence saved and task completed!' : 'Kanıt kaydedildi ve görev tamamlandı!');
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
    if (!activeProject) return;
    setDiarySubmitting(true);
    try {
      await api.post('/weekly', {
        project_name: activeProject.name,
        week_start: weekStart,
        completed: completedWork,
        blockers: blockers,
        next_step: nextStep,
        evidence_link: evidenceLink,
      });
      toast.success(lang === 'en' ? 'Weekly report saved!' : 'Haftalık raporunuz başarıyla kaydedildi!');
      setCompletedWork('');
      setBlockers('');
      setNextStep('');
      setEvidenceLink('');
      const weeklyRes = await api.get('/weekly');
      setWeeklyUpdates(weeklyRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to submit report.' : 'Rapor gönderilemedi.'));
    } finally {
      setDiarySubmitting(false);
    }
  };

  const handleOpenComments = async (task) => {
    setActiveTaskComments(task);
    try {
      const res = await api.get(`/tasks/${task.id}/comments`);
      setCommentsList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !activeTaskComments) return;
    try {
      await api.post(`/tasks/${activeTaskComments.id}/comments`, {
        comment: newComment.trim(),
      });
      toast.success(lang === 'en' ? 'Comment posted!' : 'Yorum eklendi!');
      setNewComment('');
      const res = await api.get(`/tasks/${activeTaskComments.id}/comments`);
      setCommentsList(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to add comment.' : 'Yorum eklenemedi.'));
    }
  };

  // Metrics
  const myDoneCount = myTasks.filter((t) => t.status === 'DONE').length;
  const myPct = myTasks.length > 0 ? (myDoneCount / myTasks.length) * 100 : 0;
  const prjDoneCount = projectTasks.filter((t) => t.status === 'DONE').length;
  const prjPct = projectTasks.length > 0 ? (prjDoneCount / projectTasks.length) * 100 : 0;

  // Milestone sorted tasks
  const MS_WEIGHTS = { M1: 1, M2: 2, M3: 3, M4: 4, M5: 5, M6: 6 };
  const sortedMyTasks = [...myTasks].sort((a, b) => {
    const wa = MS_WEIGHTS[a.milestone_key] || 99;
    const wb = MS_WEIGHTS[b.milestone_key] || 99;
    return wa - wb || a.id - b.id;
  });

  // Current active task (first non-DONE task)
  const currentTask = sortedMyTasks.find((t) => t.status !== 'DONE') || sortedMyTasks[0];

  // Bar color based on progress
  const barColor = myPct >= 80 ? 'bg-emerald-600' : myPct >= 40 ? 'bg-blue-600' : 'bg-amber-500';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Hero Banner matching Streamlit dm-hero-banner ──────────────────────── */}
      <div className="bg-[#0a2342] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-slate-800">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-3xl shrink-0">
            🎓
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-1">
              {lang === 'en' ? 'Student Workspace Panel' : 'Öğrenci Paneli'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{user?.display_name}</h1>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-slate-300">{user?.user_id}</span>
              <span>·</span>
              <span>📁 {activeProject?.name}</span>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded-full px-2.5 py-0.5 text-xs font-bold">
                {lang === 'en' ? '🎓 Member' : '🎓 Üye'}
              </span>
              <span className="bg-white/10 text-slate-300 rounded-full px-2.5 py-0.5 text-xs">
                👨‍🏫 {activeProject?.advisor_name}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Gauge on Right */}
        <div className="text-right flex flex-col items-end shrink-0 bg-white/10 px-6 py-3.5 rounded-2xl border border-white/10">
          <div className="text-3xl font-black text-white">%{Math.round(myPct)}</div>
          <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold mb-2">
            {lang === 'en' ? 'Personal Progress' : 'Kişisel İlerleme'}
          </div>
          <div className="w-32 bg-white/20 rounded-full h-2 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${myPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── 2. Overview Metrics Row (c1, c2, c3, c4 = st.columns(4)) ─────────────── */}
      <MetricCards
        projectTaskCount={projectTasks.length}
        projectCompletionPct={prjPct}
        myTaskCount={myTasks.length}
        myCompletionPct={myPct}
        lang={lang}
      />

      {/* ── 3. Milestone Progress Stepper (render_milestone_progress) ────────────── */}
      <MilestoneProgress tasks={projectTasks} lang={lang} />

      {/* ── 4. Team Members & Roles Table (render_member_table) ──────────────────── */}
      <MemberTable members={projectMembers} leaderNo={activeProject?.leader_student_no} lang={lang} />

      {/* ── 5. Görev Sıram (Personal task queue + Active task highlight) ─────────── */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>✅</span>
            <span>{lang === 'en' ? 'My Task Queue' : 'Görev Sıram'}</span>
            <span className="text-xs text-slate-400 font-normal">
              ({lang === 'en' ? 'Ordered by milestone sequence' : 'Milestone sırasına göre aktif göreviniz'})
            </span>
          </h2>
        </div>

        {/* Table of all assigned tasks */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a2342] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Task' : 'Görev'}</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Status' : 'Durum'}</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'en' ? 'Action' : 'İşlem'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMyTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">{t.milestone_key}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.title}</div>
                      {t.description && <div className="text-[11px] text-slate-400 line-clamp-1">{t.description}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} lang={lang} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{t.deadline || '—'}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => setEvidenceModalTask(t)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition"
                        title={lang === 'en' ? 'Attach Evidence' : 'Kanıt Yükle'}
                      >
                        <Upload className="w-3.5 h-3.5 inline" />
                      </button>
                      <button
                        onClick={() => handleOpenComments(t)}
                        className="p-1 text-slate-400 hover:text-indigo-600 transition"
                        title={lang === 'en' ? 'Comments' : 'Yorumlar'}
                      >
                        <MessageSquare className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Task Highlight Card */}
        {currentTask ? (
          <ActiveTaskCard
            task={currentTask}
            milestoneLabel={currentTask.milestone_key}
            onUpdateStatus={handleUpdateTaskStatus}
            onAttachEvidence={(task) => setEvidenceModalTask(task)}
            lang={lang}
          />
        ) : (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-800 text-sm font-bold flex items-center space-x-2">
            <span>🎉</span>
            <span>{lang === 'en' ? 'All milestone tasks completed!' : 'Tüm milestone görevlerini tamamladınız!'}</span>
          </div>
        )}
      </div>

      {/* ── 6. Weekly Progress Diary & History ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Weekly Diary Form */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {lang === 'en' ? 'Weekly Progress Diary' : 'Haftalık İlerleme Girişi'}
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            {lang === 'en' ? 'Record your progress, blockers, and next goals.' : 'Bu haftaki çalışmalarınızı ve engellerinizi kaydedin.'}
          </p>

          <form onSubmit={handleSubmitDiary} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'en' ? 'Week Start Date' : 'Hafta Başlangıç Tarihi'}
              </label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'en' ? 'Completed Work This Week' : 'Bu Hafta Tamamlanan Çalışmalar'}
              </label>
              <textarea
                rows={3}
                placeholder={lang === 'en' ? 'Code written, tests, research conducted...' : 'Yazılan kod, testler, yapılan araştırmalar...'}
                value={completedWork}
                onChange={(e) => setCompletedWork(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Blockers / Obstacles' : 'Karşılaşılan Engeller'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Technical difficulties / impediments' : 'Teknik aksaklık / engel'}
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Next Week Goals' : 'Gelecek Hafta Hedefleri'}
                </label>
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'Planned steps' : 'Planlanan adımlar'}
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'en' ? 'Evidence / Repo Link' : 'Kanıt / Repo Linki'}
              </label>
              <input
                type="url"
                placeholder="https://github.com/..."
                value={evidenceLink}
                onChange={(e) => setEvidenceLink(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5"
              />
            </div>
            <button
              type="submit"
              disabled={diarySubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
            >
              {diarySubmitting
                ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
                : (lang === 'en' ? 'Save Weekly Report' : 'Haftalık Raporu Kaydet')}
            </button>
          </form>
        </div>

        {/* Right Column: Advisor Feedback Cards */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {lang === 'en' ? 'Advisor Feedback & Directives' : 'Danışman Notları & Yönergeler'}
            </h3>
          </div>

          {feedbacks.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              {lang === 'en' ? 'No feedback received from advisor yet.' : 'Danışmandan henüz not iletilmedi.'}
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <FeedbackCard key={fb.id} feedback={fb} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 7. Evidence Upload Modal ────────────────────────────────────────────── */}
      {evidenceModalTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                📎 {lang === 'en' ? 'Attach Evidence & Complete' : 'Kanıt Ekle & Tamamla'}
              </h3>
              <button onClick={() => setEvidenceModalTask(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEvidence} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Repo / PR Link' : 'Repo / PR Linki'}
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={taskEvidenceLink}
                  onChange={(e) => setTaskEvidenceLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Upload File (PDF, PNG, ZIP, etc.)' : 'Dosya Yükle (PDF, PNG, ZIP vb.)'}
                </label>
                <input
                  type="file"
                  onChange={(e) => setTaskEvidenceFile(e.target.files[0])}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvidenceModalTask(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
                >
                  {lang === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
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

      {/* ── 8. Task Comments Slide-over ─────────────────────────────────────────── */}
      {activeTaskComments && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-4 bg-[#0a2342] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  💬 {lang === 'en' ? 'Task Comments' : 'Görev Yorumları'}
                </h3>
                <div className="text-[11px] text-slate-400">#{activeTaskComments.id} - {activeTaskComments.title}</div>
              </div>
              <button onClick={() => setActiveTaskComments(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {commentsList.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  {lang === 'en' ? 'No comments yet.' : 'Henüz yorum yapılmadı.'}
                </div>
              )}
              {commentsList.map((c) => (
                <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-slate-800">{c.author_name || c.author_id} ({c.author_role})</span>
                    <span>{c.created_at}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{c.comment}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={lang === 'en' ? 'Write a comment...' : 'Yorumunuzu yazın...'}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
              />
              <button type="submit" className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs">
                {lang === 'en' ? 'Send' : 'Gönder'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
