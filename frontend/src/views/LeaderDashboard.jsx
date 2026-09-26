import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MilestoneProgress from '../components/MilestoneProgress';
import MemberTable from '../components/MemberTable';
import MetricCards from '../components/MetricCards';
import ActiveTaskCard from '../components/ActiveTaskCard';
import StatusBadge from '../components/StatusBadge';
import { Crown, Plus, MessageSquare, Upload, Calendar, X, Sparkles, UserCheck, Shield } from 'lucide-react';

export default function LeaderDashboard({ project }) {
  const { lang, user } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Milestone Filter Tab (All, M1, M2, M3, M4, M5, M6)
  const [activeMilestoneTab, setActiveMilestoneTab] = useState('ALL');

  // Role Assignment Form
  const [roleMemberNo, setRoleMemberNo] = useState('');
  const [roleTitle, setRoleTitle] = useState('Yazılım');
  const [roleResp, setRoleResp] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [milestoneKey, setMilestoneKey] = useState('M1');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assigneeNo, setAssigneeNo] = useState('');
  const [priority, setPriority] = useState('Orta');
  const [deadline, setDeadline] = useState('');
  const [evidenceReq, setEvidenceReq] = useState('Repo linki veya rapor');
  const [taskError, setTaskError] = useState('');

  // Selected Task for Update
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Comment Modal
  const [activeTaskComments, setActiveTaskComments] = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Evidence upload modal
  const [evidenceModalTask, setEvidenceModalTask] = useState(null);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceLink, setEvidenceLink] = useState('');
  const [uploading, setUploading] = useState(false);

  // AI Group Analysis
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModelTag, setAiModelTag] = useState('');

  useEffect(() => {
    if (project?.name) {
      loadProjectData();
    }
  }, [project]);

  const loadProjectData = async () => {
    try {
      setLoading(true);
      const [tRes, pRes] = await Promise.all([
        api.get(`/tasks?project_name=${encodeURIComponent(project.name)}`),
        api.get(`/projects/${encodeURIComponent(project.name)}`),
      ]);
      setTasks(tRes.data);
      setMembers(pRes.data.members || []);
      if (pRes.data.members?.length > 0 && !roleMemberNo) {
        setRoleMemberNo(pRes.data.members[0].student_no);
        setAssigneeNo(pRes.data.members[0].student_no);
      }
      if (tRes.data.length > 0 && !selectedTaskId) {
        setSelectedTaskId(tRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load project data.' : 'Proje verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!roleMemberNo) return;
    setRoleSaving(true);
    try {
      await api.post(`/projects/${encodeURIComponent(project.name)}/roles`, {
        student_no: roleMemberNo,
        role: roleTitle,
        responsibility: roleResp,
      });
      toast.success(lang === 'en' ? 'Member role saved!' : 'Üye rolü başarıyla kaydedildi!');
      loadProjectData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to assign role.' : 'Rol atanamadı.'));
    } finally {
      setRoleSaving(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskError('');
    if (!taskTitle.trim()) {
      setTaskError(lang === 'en' ? 'Task title is required.' : 'Görev başlığı gereklidir.');
      return;
    }
    try {
      await api.post('/tasks', {
        project_name: project.name,
        milestone_key: milestoneKey,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assignee_student_no: assigneeNo,
        priority: priority,
        deadline: deadline || null,
        evidence_required: evidenceReq,
      });
      toast.success(lang === 'en' ? 'Task created successfully!' : 'Görev başarıyla oluşturuldu!');
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      loadProjectData();
    } catch (err) {
      setTaskError(err.response?.data?.detail || (lang === 'en' ? 'Failed to create task.' : 'Görev oluşturulamadı.'));
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, {
        status: newStatus,
        skip_milestone_check: true, // Leaders can override sequential check
      });
      toast.success(lang === 'en' ? 'Task status updated!' : 'Görev durumu güncellendi!');
      loadProjectData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to update status.' : 'Durum güncellenemedi.'));
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
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to post comment.' : 'Yorum eklenemedi.'));
    }
  };

  const handleUploadEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceModalTask) return;
    setUploading(true);
    try {
      if (evidenceFile) {
        const formData = new FormData();
        formData.append('file', evidenceFile);
        await api.post(`/tasks/${evidenceModalTask.id}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await api.patch(`/tasks/${evidenceModalTask.id}`, {
        status: 'DONE',
        evidence_link: evidenceLink,
        skip_milestone_check: true,
      });
      toast.success(lang === 'en' ? 'Evidence saved and task marked DONE!' : 'Kanıt kaydedildi ve görev tamamlandı!');
      setEvidenceModalTask(null);
      setEvidenceFile(null);
      setEvidenceLink('');
      loadProjectData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to upload evidence.' : 'Kanıt yüklenemedi.'));
    } finally {
      setUploading(false);
    }
  };

  const handleRunGroupAI = async () => {
    setAiLoading(true);
    try {
      const promptContent =
        lang === 'en'
          ? `Please analyze our project ${project.name}'s overall task progress, completion percentages, potential bottlenecks, and goals for next week. Generate a guidance report for the team leader.`
          : `Lütfen ${project.name} projemizin genel görev ilerlemesini, tamamlanma yüzdelerini, olası darboğazları ve gelecek haftaki hedeflerimizi analiz et. Grup lideri için rehberlik raporu oluştur.`;
      const res = await api.post('/ai/chat', {
        messages: [
          {
            role: 'user',
            content: promptContent,
          },
        ],
        project_name: project.name,
      });
      setAiReport(res.data.reply);
      setAiModelTag(`${res.data.provider} (${res.data.model})`);
      toast.success(lang === 'en' ? 'AI analysis complete!' : 'AI grup analizi tamamlandı!');
    } catch (err) {
      toast.error(lang === 'en' ? 'AI analysis failed.' : 'AI analizi yapılamadı.');
    } finally {
      setAiLoading(false);
    }
  };

  // Metrics
  const myTasks = tasks.filter((t) => String(t.assignee_student_no) === String(user?.user_id));
  const myDone = myTasks.filter((t) => t.status === 'DONE').length;
  const myPct = myTasks.length > 0 ? (myDone / myTasks.length) * 100 : 0;
  const prjDone = tasks.filter((t) => t.status === 'DONE').length;
  const prjPct = tasks.length > 0 ? (prjDone / tasks.length) * 100 : 0;
  const overdueCount = tasks.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'DONE'
  ).length;

  // Selected task object
  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  // Filtered tasks by milestone tab
  const filteredTasks =
    activeMilestoneTab === 'ALL'
      ? tasks
      : tasks.filter((t) => t.milestone_key === activeMilestoneTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── 1. Hero Banner matching Streamlit dm-hero-banner ──────────────────────── */}
      <div className="bg-[#0a2342] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-slate-800">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-3xl shrink-0">
            👑
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-300 uppercase tracking-widest mb-1">
              {lang === 'en' ? 'Group Leader Panel' : 'Grup Lider Paneli'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{user?.display_name}</h1>
            <div className="text-xs text-slate-300 mt-1 flex items-center space-x-2">
              <span>📁 {project?.name}</span>
              <span>·</span>
              <span>👨‍🏫 {project?.advisor_name}</span>
            </div>
          </div>
        </div>

        {/* 3 Metric Pills on Right (Proje %, Geciken, Üye) */}
        <div className="flex items-center space-x-4 shrink-0 bg-white/10 px-6 py-3.5 rounded-2xl border border-white/10">
          <div className="text-center px-2">
            <div className="text-2xl font-black text-amber-300">%{Math.round(prjPct)}</div>
            <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Project' : 'Proje'}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className={`text-2xl font-black ${overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {overdueCount}
            </div>
            <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Overdue' : 'Geciken'}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-2">
            <div className="text-2xl font-black text-blue-300">{members.length}</div>
            <div className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Members' : 'Üye'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Overview Metrics Row (c1, c2, c3, c4 = st.columns(4)) ─────────────── */}
      <MetricCards
        projectTaskCount={tasks.length}
        projectCompletionPct={prjPct}
        myTaskCount={myTasks.length}
        myCompletionPct={myPct}
        lang={lang}
      />

      {/* ── 3. Milestone Progress Stepper (render_milestone_progress) ────────────── */}
      <MilestoneProgress tasks={tasks} lang={lang} />

      {/* ── 4. Team Members & Roles Table (render_member_table) ──────────────────── */}
      <MemberTable members={members} leaderNo={user?.user_id} lang={lang} />

      {/* ── 5. Role Assignment Form (upsert_role) ─────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2">
          <span className="text-base">🎭</span>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {lang === 'en' ? 'Assign Team Roles & Responsibilities' : 'Rol & Görev Tanımı Atama'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'en'
                ? 'Assign software, hardware, testing, or reporting roles to your teammates.'
                : 'Takım üyelerine rol ve özel sorumluluk tanımları atayın.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAssignRole} className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-4">
            <label className="block font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Member' : 'Üye Seç'}</label>
            <select
              value={roleMemberNo}
              onChange={(e) => setRoleMemberNo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
            >
              {members.map((m) => (
                <option key={m.student_no} value={m.student_no}>
                  {m.student_name} ({m.student_no})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Role' : 'Rol'}</label>
            <select
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white"
            >
              <option value="Lider">{lang === 'en' ? 'Leader' : 'Lider'}</option>
              <option value="Yazılım">{lang === 'en' ? 'Software' : 'Yazılım'}</option>
              <option value="Donanım">{lang === 'en' ? 'Hardware' : 'Donanım'}</option>
              <option value="Test">{lang === 'en' ? 'Testing' : 'Test'}</option>
              <option value="Raporlama">{lang === 'en' ? 'Reporting' : 'Raporlama'}</option>
              <option value="Üye">{lang === 'en' ? 'Member' : 'Üye'}</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="block font-semibold text-slate-700 mb-1">{lang === 'en' ? 'Responsibility' : 'Görev Tanımı'}</label>
            <input
              type="text"
              placeholder={lang === 'en' ? 'e.g. Backend API & DB' : 'örn: Backend API & DB'}
              value={roleResp}
              onChange={(e) => setRoleResp(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5"
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={roleSaving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
            >
              {roleSaving ? '...' : lang === 'en' ? 'Save Role' : 'Rolü Kaydet'}
            </button>
          </div>
        </form>
      </div>

      {/* ── 6. Task Management: Table + Create Task ─────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>🗂️</span>
              <span>{lang === 'en' ? 'Task Tracking' : 'Görev Takibi'}</span>
              <span className="text-xs text-slate-400 font-normal">({tasks.length})</span>
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'en' ? 'Manage, track and update milestone tasks.' : 'Tüm görevleri görüntüleyin ve durumlarını güncelleyin.'}
            </p>
          </div>

          <button
            onClick={() => setShowTaskModal(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'en' ? 'Create New Task' : 'Yeni Görev Oluştur'}</span>
          </button>
        </div>

        {/* Milestone Filter Tabs (M1-M6) */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
          {['ALL', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map((tab) => {
            const count = tab === 'ALL' ? tasks.length : tasks.filter((t) => t.milestone_key === tab).length;
            const active = activeMilestoneTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveMilestoneTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                  active
                    ? 'bg-[#0a2342] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>{tab === 'ALL' ? (lang === 'en' ? 'All' : 'Tümü') : tab}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tasks Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0a2342] text-white uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Milestone</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Task' : 'Görev'}</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Assignee' : 'Sorumlu'}</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Status' : 'Durum'}</th>
                  <th className="py-3 px-4">{lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'en' ? 'Actions' : 'İşlemler'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`hover:bg-slate-50/80 transition cursor-pointer ${
                      selectedTaskId === t.id ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-500">{t.milestone_key}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{t.title}</div>
                      {t.description && <div className="text-[11px] text-slate-400 line-clamp-1">{t.description}</div>}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{t.assignee_name || t.assignee_student_no}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} lang={lang} />
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono">{t.deadline || '—'}</td>
                    <td className="py-3 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEvidenceModalTask(t)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition"
                        title={lang === 'en' ? 'Attach Evidence' : 'Kanıt Ekle'}
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
      </div>

      {/* ── 7. Active Task Inspector Card (render_active_task_card) ──────────────── */}
      {activeTask && (
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <span>✏️</span>
            <span>{lang === 'en' ? 'Selected Task Inspector' : 'Seçili Görev & Güncelleme'}</span>
          </div>
          <ActiveTaskCard
            task={activeTask}
            milestoneLabel={activeTask.milestone_key}
            onUpdateStatus={handleUpdateStatus}
            onAttachEvidence={() => setEvidenceModalTask(activeTask)}
            lang={lang}
          />
        </div>
      )}

      {/* ── 8. Member Progress Summary (member_progress) ─────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
          <span>📈</span>
          <span>{lang === 'en' ? 'Member Workload & Progress Summary' : 'Üye İlerleme Özeti'}</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">{lang === 'en' ? 'Member' : 'Üye'}</th>
                <th className="py-2.5 px-3">{lang === 'en' ? 'Total Tasks' : 'Toplam Görev'}</th>
                <th className="py-2.5 px-3">{lang === 'en' ? 'Completed' : 'Tamamlanan'}</th>
                <th className="py-2.5 px-3">{lang === 'en' ? 'Completion %' : 'Tamamlanma %'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const memTasks = tasks.filter((t) => String(t.assignee_student_no) === String(m.student_no));
                const memDone = memTasks.filter((t) => t.status === 'DONE').length;
                const memPct = memTasks.length > 0 ? Math.round((memDone / memTasks.length) * 100) : 0;
                return (
                  <tr key={m.student_no} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{m.student_name}</td>
                    <td className="py-2.5 px-3 font-mono">{memTasks.length}</td>
                    <td className="py-2.5 px-3 font-mono text-emerald-600 font-bold">{memDone}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${memPct}%` }} />
                        </div>
                        <span className="font-bold font-mono">%{memPct}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 9. AI Group Analysis (build_group_prompt) ────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                {lang === 'en' ? 'AI Group Analysis' : '🤖 AI Grup Analizi'}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === 'en'
                  ? 'The AI Assistant evaluates group task data, bottlenecks, and velocity.'
                  : 'Yapay zeka grubunuzun ilerlemesini, görev yükünü ve risklerini analiz eder.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleRunGroupAI}
            disabled={aiLoading}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer self-start sm:self-auto"
          >
            {aiLoading
              ? (lang === 'en' ? 'Analyzing...' : 'Analiz Yapılıyor...')
              : (lang === 'en' ? '✨ Analyze My Group' : '✨ Grubumu Analiz Et')}
          </button>
        </div>

        {aiReport && (
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
            {aiReport}
            {aiModelTag && <div className="mt-2 text-[10px] text-slate-400 font-mono">Engine: {aiModelTag}</div>}
          </div>
        )}
      </div>

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                {lang === 'en' ? 'Create New Milestone Task' : 'Yeni Milestone Görevi Oluştur'}
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {taskError && (
              <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs">
                {taskError}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Milestone</label>
                  <select
                    value={milestoneKey}
                    onChange={(e) => setMilestoneKey(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="M1">{lang === 'en' ? 'M1: Literature Review' : 'M1: Literatür taraması'}</option>
                    <option value="M2">{lang === 'en' ? 'M2: Algorithm & Architecture' : 'M2: Algoritma ve uygulama planı'}</option>
                    <option value="M3">{lang === 'en' ? 'M3: MVP Bootstrapping' : 'M3: Uygulamayı boot etme'}</option>
                    <option value="M4">{lang === 'en' ? 'M4: Testing & Evaluation' : 'M4: Deneme ve sonuç değerlendirme'}</option>
                    <option value="M5">{lang === 'en' ? 'M5: Bug Fixes & Refinements' : 'M5: Hata düzeltme ve revizyon'}</option>
                    <option value="M6">{lang === 'en' ? 'M6: Documentation & Final Report' : 'M6: Proje yazımı ve final rapor'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Assignee' : 'Sorumlu Üye'}
                  </label>
                  <select
                    value={assigneeNo}
                    onChange={(e) => setAssigneeNo(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    {members.map((m) => (
                      <option key={m.student_no} value={m.student_no}>
                        {m.student_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Task Title' : 'Görev Başlığı'}
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. Frontend API integration' : 'örn: Frontend API entegrasyonu'}
                  className="w-full border border-slate-300 rounded-lg p-2"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Description' : 'Açıklama'}
                </label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder={lang === 'en' ? 'Details, objectives...' : 'Detaylar, hedefler...'}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Priority' : 'Öncelik'}
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  >
                    <option value="Düşük">{lang === 'en' ? 'Low' : 'Düşük'}</option>
                    <option value="Orta">{lang === 'en' ? 'Medium' : 'Orta'}</option>
                    <option value="Yüksek">{lang === 'en' ? 'High' : 'Yüksek'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50"
                >
                  {lang === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                >
                  {lang === 'en' ? 'Create Task' : 'Görevi Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Comments Slide-over */}
      {activeTaskComments && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
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

      {/* Evidence Upload Modal */}
      {evidenceModalTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                📎 {lang === 'en' ? 'Attach Evidence File or Link' : 'Kanıt Dosyası veya Linki Ekle'}
              </h3>
              <button onClick={() => setEvidenceModalTask(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadEvidence} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Repo / Document Link' : 'Repo / Doküman Linki'}
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Upload File (PDF, PNG, ZIP, etc.)' : 'Dosya Yükle (PDF, PNG, ZIP vb.)'}
                </label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files[0])}
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
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition"
                >
                  {uploading
                    ? (lang === 'en' ? 'Uploading...' : 'Yükleniyor...')
                    : (lang === 'en' ? 'Save' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
