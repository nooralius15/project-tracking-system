import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import {
  Crown,
  Plus,
  MessageSquare,
  Upload,
  Calendar,
  X,
  AlertCircle,
  Layers,
  ExternalLink,
  FileCheck,
  User,
  Filter,
} from 'lucide-react';

const MILESTONES = [
  { key: 'M1', titleTr: 'M1: Literatür Taraması', titleEn: 'M1: Literature Review' },
  { key: 'M2', titleTr: 'M2: Algoritma & Tasarım', titleEn: 'M2: Algorithm & Design' },
  { key: 'M3', titleTr: 'M3: Uygulama & Geliştirme', titleEn: 'M3: Implementation' },
  { key: 'M4', titleTr: 'M4: Test & Sonuç Değerlendirme', titleEn: 'M4: Testing & Results' },
  { key: 'M5', titleTr: 'M5: Hata Düzeltme & Revizyon', titleEn: 'M5: Debugging & Revision' },
  { key: 'M6', titleTr: 'M6: Final Rapor & Sunum', titleEn: 'M6: Final Report' },
];

export default function LeaderDashboard({ project }) {
  const { lang, user } = useAuth();
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Milestone Filter Tab ('ALL' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6')
  const [selectedMilestone, setSelectedMilestone] = useState('ALL');

  // New Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [milestoneKey, setMilestoneKey] = useState('M1');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assigneeNo, setAssigneeNo] = useState('');
  const [priority, setPriority] = useState('Orta');
  const [deadline, setDeadline] = useState('');
  const [evidenceReq, setEvidenceReq] = useState('Repo linki veya rapor');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskError, setTaskError] = useState('');

  // Comment Modal
  const [activeTaskComments, setActiveTaskComments] = useState(null);
  const [commentsList, setCommentsList] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Evidence upload modal
  const [evidenceModalTask, setEvidenceModalTask] = useState(null);
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [evidenceLink, setEvidenceLink] = useState('');
  const [uploading, setUploading] = useState(false);

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
      const mems = pRes.data.members || [];
      setMembers(mems);
      if (mems.length > 0 && !assigneeNo) {
        setAssigneeNo(mems[0].student_no);
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load project details.' : 'Proje verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = (presetMilestone = null) => {
    if (presetMilestone && presetMilestone !== 'ALL') {
      setMilestoneKey(presetMilestone);
    } else if (selectedMilestone !== 'ALL') {
      setMilestoneKey(selectedMilestone);
    } else {
      setMilestoneKey('M1');
    }
    setTaskTitle('');
    setTaskDesc('');
    setTaskError('');
    setPriority('Orta');
    setDeadline('');
    if (members.length > 0 && !assigneeNo) {
      setAssigneeNo(members[0].student_no);
    }
    setShowTaskModal(true);
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskError('');
    if (!taskTitle.trim()) {
      setTaskError(lang === 'en' ? 'Task title is required.' : 'Görev başlığı gereklidir.');
      return;
    }
    setTaskSubmitting(true);
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
      const msg = err.response?.data?.detail || (lang === 'en' ? 'Failed to create task.' : 'Görev oluşturulamadı.');
      setTaskError(msg);
      toast.error(msg);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, {
        status: newStatus,
        skip_milestone_check: true,
      });
      toast.success(lang === 'en' ? 'Task status updated!' : 'Görev durumu güncellendi!');
      loadProjectData();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Status update failed.' : 'Durum güncellenemedi.'));
    }
  };

  const handleOpenComments = async (task) => {
    setActiveTaskComments(task);
    try {
      const res = await api.get(`/tasks/${task.id}/comments`);
      setCommentsList(res.data);
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load comments.' : 'Yorumlar yüklenemedi.');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !activeTaskComments) return;
    setCommentSubmitting(true);
    try {
      await api.post(`/tasks/${activeTaskComments.id}/comments`, {
        comment: newComment.trim(),
      });
      toast.success(lang === 'en' ? 'Comment added!' : 'Yorum eklendi!');
      setNewComment('');
      const res = await api.get(`/tasks/${activeTaskComments.id}/comments`);
      setCommentsList(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to add comment.' : 'Yorum eklenemedi.'));
    } finally {
      setCommentSubmitting(false);
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
      if (evidenceLink) {
        await api.patch(`/tasks/${evidenceModalTask.id}`, {
          status: 'DONE',
          evidence_link: evidenceLink,
          skip_milestone_check: true,
        });
      }
      toast.success(lang === 'en' ? 'Evidence saved successfully!' : 'Kanıt başarıyla kaydedildi!');
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

  // Filter tasks based on selected milestone
  const filteredTasks = tasks.filter((t) => {
    if (selectedMilestone === 'ALL') return true;
    return t.milestone_key === selectedMilestone;
  });

  const completedCount = tasks.filter((t) => t.status === 'DONE').length;
  const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-slate-800">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-3xl shrink-0 shadow-inner">
            👑
          </div>
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-1 flex items-center space-x-1.5">
              <span>{lang === 'en' ? 'Group Leader Panel' : 'Grup Lideri Yönetim Paneli'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">{project?.name}</h1>
            <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">👤 {user?.display_name}</span>
              <span>·</span>
              <span className="text-slate-300">👨‍🏫 {project?.advisor_name || 'Danışman'}</span>
            </div>
          </div>
        </div>

        {/* Big Progress Gauge */}
        <div className="flex items-center space-x-5 shrink-0 bg-white/10 backdrop-blur-md px-6 py-3.5 rounded-xl border border-white/10">
          <div>
            <div className="text-xs text-slate-300 font-semibold">{lang === 'en' ? 'Completion' : 'İlerleme'}</div>
            <div className="text-3xl font-extrabold text-amber-300">%{pct}</div>
          </div>
          <div className="text-right text-xs text-slate-300 border-l border-white/20 pl-4">
            <div className="font-bold text-white text-base">{completedCount} / {tasks.length}</div>
            <div className="text-[11px] text-slate-400">{lang === 'en' ? 'tasks done' : 'görev tamam'}</div>
          </div>
        </div>
      </div>

      {/* Team Roster Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <User className="w-4 h-4 text-blue-600" />
            <span>{lang === 'en' ? 'Team Members' : 'Proje Ekip Üyeleri'}</span>
          </span>
          <span className="text-xs text-slate-400 font-normal">
            {members.length} {lang === 'en' ? 'members' : 'öğrenci'}
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {members.map((m) => (
            <div key={m.student_no} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900 flex items-center space-x-1">
                  <span>{m.student_name}</span>
                  {m.role === 'Lider' && <Crown className="w-3 h-3 text-amber-500" />}
                </div>
                <div className="text-[11px] text-slate-400">{m.student_no}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  m.role === 'Lider'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Task Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>{lang === 'en' ? 'Project Tasks' : 'Proje Görevleri'}</span>
              <span className="text-xs font-normal text-slate-400">({tasks.length})</span>
            </h2>
          </div>
          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'en' ? 'Create Task' : 'Yeni Görev Ekle'}</span>
          </button>
        </div>

        {/* Milestone Filter Tabs */}
        <div className="flex items-center overflow-x-auto pb-1 gap-1.5 scrollbar-thin">
          <button
            onClick={() => setSelectedMilestone('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
              selectedMilestone === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{lang === 'en' ? 'All Milestones' : 'Tüm Aşamalar'}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedMilestone === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tasks.length}
            </span>
          </button>

          {MILESTONES.map((m) => {
            const count = tasks.filter((t) => t.milestone_key === m.key).length;
            const isSelected = selectedMilestone === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setSelectedMilestone(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
                title={lang === 'en' ? m.titleEn : m.titleTr}
              >
                <span>{m.key}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tasks Table / Empty States */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>{lang === 'en' ? 'Loading tasks...' : 'Görevler yükleniyor...'}</span>
          </div>
        ) : tasks.length === 0 ? (
          /* Empty State: Zero Tasks */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
              <Layers className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {lang === 'en' ? 'No tasks created yet' : 'Henüz görev oluşturulmadı'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {lang === 'en'
                  ? 'Plan your capstone milestones by breaking them down into tasks and assigning them to team members.'
                  : 'Bitirme projenizi aşamalara bölerek ekip üyelerinize görev atayabilir ve ilerlemeyi takip edebilirsiniz.'}
              </p>
            </div>
            <button
              onClick={() => handleOpenCreateModal()}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'en' ? 'Create First Task' : 'İlk Görevi Oluştur'}</span>
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          /* Empty State: Filtered to specific milestone but no tasks */
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3 shadow-xs">
            <Filter className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'en'
                  ? `No tasks found for ${selectedMilestone}`
                  : `${selectedMilestone} aşaması için henüz görev tanımlanmamış`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'en'
                  ? 'Add a task for this milestone to keep progress moving forward.'
                  : 'Bu milestone için görev oluşturarak süreci hızlandırabilirsiniz.'}
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                onClick={() => setSelectedMilestone('ALL')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
              >
                {lang === 'en' ? 'Show All Tasks' : 'Tüm Görevleri Göster'}
              </button>
              <button
                onClick={() => handleOpenCreateModal(selectedMilestone)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? `Add ${selectedMilestone} Task` : `${selectedMilestone}'a Görev Ekle`}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Milestone</th>
                    <th className="py-3 px-4">Görev</th>
                    <th className="py-3 px-4">Sorumlu</th>
                    <th className="py-3 px-4">Durum</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 border border-slate-200">
                          {t.milestone_key}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900">{t.title}</div>
                        {t.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1">{t.description}</div>
                        )}
                        {/* Evidence preview indicator */}
                        {(t.evidence_link || t.evidence_file) && (
                          <div className="mt-1 flex items-center space-x-1 text-[10px] text-emerald-600 font-semibold">
                            <FileCheck className="w-3 h-3" />
                            <span>{lang === 'en' ? 'Evidence provided' : 'Kanıt eklendi'}</span>
                            {t.evidence_link && (
                              <a
                                href={t.evidence_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center ml-1"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {t.assignee_name || t.assignee_student_no}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} lang={lang} />
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {t.deadline ? (
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{t.deadline}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {/* Status select */}
                        <select
                          value={t.status}
                          onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                          className="text-[11px] border border-slate-300 rounded-md px-2 py-1 bg-white font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="TODO">TODO</option>
                          <option value="DOING">DOING</option>
                          <option value="DONE">DONE</option>
                        </select>

                        {/* Evidence upload button */}
                        <button
                          onClick={() => setEvidenceModalTask(t)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition inline-flex items-center"
                          title={lang === 'en' ? 'Attach Evidence' : 'Kanıt Ekle'}
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>

                        {/* Comments button */}
                        <button
                          onClick={() => handleOpenComments(t)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition inline-flex items-center"
                          title={lang === 'en' ? 'Comments' : 'Yorumlar'}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Improved Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    {lang === 'en' ? 'Create Milestone Task' : 'Yeni Milestone Görevi'}
                  </h3>
                  <div className="text-[11px] text-slate-400">
                    {lang === 'en' ? 'Assign task to team member' : 'Ekip üyesine görev tanımlayın'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {taskError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{taskError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Milestone' : 'Milestone Aşaması'}
                  </label>
                  <select
                    value={milestoneKey}
                    onChange={(e) => setMilestoneKey(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MILESTONES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {lang === 'en' ? m.titleEn : m.titleTr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Assignee' : 'Sorumlu Üye'}
                  </label>
                  <select
                    value={assigneeNo}
                    onChange={(e) => setAssigneeNo(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {members.map((m) => (
                      <option key={m.student_no} value={m.student_no}>
                        {m.student_name} ({m.student_no})
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
                  placeholder={lang === 'en' ? 'e.g. Setup database schema & migrations' : 'örn: Veritabanı şeması ve migrasyonların yazılması'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Description & Requirements' : 'Açıklama & Beklentiler'}
                </label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder={lang === 'en' ? 'Detailed requirements, expectations, and acceptance criteria...' : 'Görevle ilgili teknik detaylar ve kabul kriterleri...'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Priority' : 'Öncelik Seviyesi'}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['Düşük', 'Orta', 'Yüksek'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`py-1.5 text-xs rounded-lg font-bold transition border cursor-pointer ${
                          priority === p
                            ? p === 'Yüksek'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : p === 'Orta'
                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                              : 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Evidence Required' : 'Beklenen Kanıt'}
                </label>
                <input
                  type="text"
                  value={evidenceReq}
                  onChange={(e) => setEvidenceReq(e.target.value)}
                  placeholder={lang === 'en' ? 'e.g. GitHub PR, test report, or presentation PDF' : 'örn: GitHub PR linki, test raporu veya sunum dosyası'}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  {lang === 'en' ? 'Cancel' : 'İptal'}
                </button>
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  {taskSubmitting
                    ? (lang === 'en' ? 'Creating...' : 'Oluşturuluyor...')
                    : (lang === 'en' ? 'Create Task' : 'Görevi Oluştur')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Comments Slide-over */}
      {activeTaskComments && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-bold text-sm">💬 {lang === 'en' ? 'Task Discussion' : 'Görev Yorumları'}</h3>
                <div className="text-[11px] text-slate-400">
                  #{activeTaskComments.id} - {activeTaskComments.title}
                </div>
              </div>
              <button
                onClick={() => setActiveTaskComments(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {commentsList.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs">
                  {lang === 'en' ? 'No comments yet. Start the conversation!' : 'Henüz yorum yapılmadı. İlk yorumu siz yazın!'}
                </div>
              )}
              {commentsList.map((c) => (
                <div key={c.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1 shadow-xs">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-slate-800">
                      {c.author_name || c.author_id} ({c.author_role})
                    </span>
                    <span>{c.created_at}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={lang === 'en' ? 'Type your comment...' : 'Yorumunuzu yazın...'}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={commentSubmitting || !newComment.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition cursor-pointer"
              >
                {commentSubmitting ? '...' : (lang === 'en' ? 'Send' : 'Gönder')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Upload Modal */}
      {evidenceModalTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  {lang === 'en' ? 'Attach Evidence & Artifacts' : '📎 Kanıt Dosyası veya Linki Ekle'}
                </h3>
                <div className="text-[11px] text-slate-400">
                  #{evidenceModalTask.id} - {evidenceModalTask.title}
                </div>
              </div>
              <button
                onClick={() => setEvidenceModalTask(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadEvidence} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Repository or Document URL' : 'Repo / Doküman / PR Linki'}
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={evidenceLink}
                  onChange={(e) => setEvidenceLink(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {lang === 'en' ? 'Upload File (PDF, DOCX, ZIP, PNG)' : 'Dosya Yükle (PDF, PNG, ZIP vb.)'}
                </label>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files[0])}
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
                    : (lang === 'en' ? 'Save Evidence' : 'Kaydet')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
