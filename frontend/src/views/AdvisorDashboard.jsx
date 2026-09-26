import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MilestoneProgress from '../components/MilestoneProgress';
import MemberTable from '../components/MemberTable';
import ActiveTaskCard from '../components/ActiveTaskCard';
import FeedbackCard from '../components/FeedbackCard';
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
  Upload,
  Key,
  Plus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Send,
  MessageSquare,
  ExternalLink,
  GraduationCap,
} from 'lucide-react';

const MILESTONE_LABELS = {
  tr: {
    M1: 'M1: Problem & Kapsam',
    M2: 'M2: Mimari & Tasarım',
    M3: 'M3: MVP & İlk Çıktı',
    M4: 'M4: Doğrulama & Test',
    M5: 'M5: Rapor & Belgeleme',
    M6: 'M6: Final & Sunum',
  },
  en: {
    M1: 'M1: Problem & Scope',
    M2: 'M2: Architecture & Design',
    M3: 'M3: MVP & First Output',
    M4: 'M4: Verification & Testing',
    M5: 'M5: Report & Documentation',
    M6: 'M6: Final & Presentation',
  },
};

const getMilestoneLabel = (key, lang = 'tr') => {
  const dict = MILESTONE_LABELS[lang] || MILESTONE_LABELS.tr;
  return dict[key] || key;
};

export default function AdvisorDashboard() {
  const { lang, user } = useAuth();
  const toast = useToast();

  // Projects list
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected Project for Inspection & Detail View
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [projectDetail, setProjectDetail] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [projectWeekly, setProjectWeekly] = useState([]);
  const [projectFeedbacks, setProjectFeedbacks] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Search & Filter for Project Cards Grid
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');

  // AI Project Analysis
  const [aiReport, setAiReport] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModelTag, setAiModelTag] = useState('');

  // Student Search
  const [studentSearchInput, setStudentSearchInput] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [searchedStudent, setSearchedStudent] = useState(null);

  // Leader Assignment Form
  const [leaderAssignProject, setLeaderAssignProject] = useState('');
  const [leaderAssignMembers, setLeaderAssignMembers] = useState([]);
  const [selectedLeaderNo, setSelectedLeaderNo] = useState('');
  const [assigningLeader, setAssigningLeader] = useState(false);

  // CSV Upload Expander
  const [showCsvExpander, setShowCsvExpander] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Add Single Student Expander
  const [showAddStudentExpander, setShowAddStudentExpander] = useState(false);
  const [newStudentNo, setNewStudentNo] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [useExistingProject, setUseExistingProject] = useState(true);
  const [newStudentProjectSelect, setNewStudentProjectSelect] = useState('');
  const [newStudentProjectInput, setNewStudentProjectInput] = useState('');
  const [newStudentProgram, setNewStudentProgram] = useState('');
  const [addingStudent, setAddingStudent] = useState(false);

  // Password Reset Expander
  const [showPwdResetExpander, setShowPwdResetExpander] = useState(false);
  const [pwdResetRole, setPwdResetRole] = useState('student');
  const [resetUsersData, setResetUsersData] = useState({ students: [], advisors: [] });
  const [selectedResetUser, setSelectedResetUser] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

  // Task Status Update in Project Detail
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskNewStatus, setTaskNewStatus] = useState('DOING');
  const [taskEvidenceLink, setTaskEvidenceLink] = useState('');
  const [taskEvidenceFile, setTaskEvidenceFile] = useState(null);
  const [updatingTask, setUpdatingTask] = useState(false);

  // Task Comments
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [taskComments, setTaskComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Advisor Feedback Form
  const [feedbackText, setFeedbackText] = useState('');
  const [actionItem, setActionItem] = useState('');
  const [revisionRequired, setRevisionRequired] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchUsersForReset();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await api.get('/projects');
      setProjects(res.data);
      if (res.data.length > 0 && !selectedProjectName) {
        setSelectedProjectName(res.data[0].name);
        setLeaderAssignProject(res.data[0].name);
        setNewStudentProjectSelect(res.data[0].name);
        loadProjectDetail(res.data[0].name);
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to fetch projects.' : 'Projeler yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersForReset = async () => {
    try {
      const res = await api.get('/auth/users-for-reset');
      setResetUsersData(res.data);
      if (res.data.students?.length > 0 && !selectedResetUser) {
        setSelectedResetUser(res.data.students[0].user_id);
      }
    } catch (err) {
      console.error('Failed to load users for reset:', err);
    }
  };

  const loadProjectDetail = async (prjName) => {
    if (!prjName) return;
    setDetailLoading(true);
    try {
      const [detailRes, tasksRes, weeklyRes, fbRes] = await Promise.all([
        api.get(`/projects/${encodeURIComponent(prjName)}`),
        api.get(`/tasks?project_name=${encodeURIComponent(prjName)}`),
        api.get(`/weekly?project_name=${encodeURIComponent(prjName)}`),
        api.get(`/feedback?project_name=${encodeURIComponent(prjName)}`),
      ]);
      setProjectDetail(detailRes.data);
      setProjectTasks(tasksRes.data);
      setProjectWeekly(weeklyRes.data);
      setProjectFeedbacks(fbRes.data);

      if (tasksRes.data.length > 0) {
        const first = tasksRes.data[0];
        setSelectedTaskId(first.id);
        setTaskNewStatus(first.status);
        setTaskEvidenceLink(first.evidence_link || '');
      } else {
        setSelectedTaskId(null);
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Failed to load project details.' : 'Proje detayları yüklenemedi.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Switch project in detail view
  const handleSelectProject = (prjName) => {
    setSelectedProjectName(prjName);
    loadProjectDetail(prjName);
    const element = document.getElementById('project-detail-section');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // AI Diagnostic Run
  const handleRunAI = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/ai/advisor-report', { lang });
      setAiReport(res.data.report);
      setAiModelTag(`${res.data.provider} (${res.data.model})`);
      toast.success(lang === 'en' ? 'AI Diagnostic report ready.' : 'Yapay zeka analiz raporu oluşturuldu.');
    } catch (err) {
      toast.error(lang === 'en' ? 'AI service currently unavailable.' : 'AI servisine erişilemedi.');
    } finally {
      setAiLoading(false);
    }
  };

  // Student Search
  const handleStudentSearch = async (e) => {
    e.preventDefault();
    if (!studentSearchInput.trim()) return;
    setSearchingStudents(true);
    setSearchedStudent(null);
    try {
      const res = await api.get(`/projects/roster/students-search?q=${encodeURIComponent(studentSearchInput.trim())}`);
      setStudentSearchResults(res.data);
      if (res.data.length > 0) {
        setSearchedStudent(res.data[0]);
      } else {
        toast.info(lang === 'en' ? 'No student found matching query.' : 'Aramanızla eşleşen öğrenci bulunamadı.');
      }
    } catch (err) {
      console.error(err);
      toast.error(lang === 'en' ? 'Student search failed.' : 'Öğrenci araması başarısız.');
    } finally {
      setSearchingStudents(false);
    }
  };

  // Leader Assignment
  useEffect(() => {
    if (leaderAssignProject) {
      const prj = projects.find((p) => p.name === leaderAssignProject);
      if (prj) {
        api.get(`/projects/${encodeURIComponent(leaderAssignProject)}`).then((res) => {
          setLeaderAssignMembers(res.data.members || []);
          const currLeader = res.data.members?.find((m) => m.role === 'Lider');
          if (currLeader) {
            setSelectedLeaderNo(currLeader.student_no);
          } else if (res.data.members?.length > 0) {
            setSelectedLeaderNo(res.data.members[0].student_no);
          }
        }).catch(console.error);
      }
    }
  }, [leaderAssignProject, projects]);

  const handleAssignLeader = async (e) => {
    e.preventDefault();
    if (!leaderAssignProject || !selectedLeaderNo) return;
    setAssigningLeader(true);
    try {
      await api.post(`/projects/${encodeURIComponent(leaderAssignProject)}/leader`, {
        student_no: selectedLeaderNo,
      });
      toast.success(lang === 'en' ? 'Project leader assigned!' : 'Proje lideri başarıyla atandı!');
      fetchProjects();
      if (selectedProjectName === leaderAssignProject) {
        loadProjectDetail(leaderAssignProject);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to assign leader.' : 'Lider atanamadı.'));
    } finally {
      setAssigningLeader(false);
    }
  };

  // CSV Upload
  const handleUploadCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      toast.warning(lang === 'en' ? 'Please select a CSV file.' : 'Lütfen bir CSV dosyası seçin.');
      return;
    }
    setUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.post('/projects/roster/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || (lang === 'en' ? 'Roster updated successfully!' : 'Öğrenci listesi güncellendi!'));
      setCsvFile(null);
      fetchProjects();
      fetchUsersForReset();
      setShowCsvExpander(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'CSV upload failed.' : 'CSV yükleme hatası.'));
    } finally {
      setUploadingCsv(false);
    }
  };

  // Add Single Student
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const finalPrj = useExistingProject ? newStudentProjectSelect : newStudentProjectInput;
    if (!newStudentNo.trim() || !newStudentName.trim() || !finalPrj.trim()) {
      toast.warning(lang === 'en' ? 'Please fill in all required fields.' : 'Lütfen zorunlu alanları doldurun.');
      return;
    }
    setAddingStudent(true);
    try {
      await api.post('/projects/students', {
        student_no: newStudentNo.trim(),
        student_name: newStudentName.trim(),
        project_name: finalPrj.trim(),
        program: newStudentProgram.trim(),
      });
      toast.success(lang === 'en' ? 'Student added successfully!' : 'Öğrenci başarıyla eklendi!');
      setNewStudentNo('');
      setNewStudentName('');
      setNewStudentProgram('');
      if (!useExistingProject) setNewStudentProjectInput('');
      fetchProjects();
      fetchUsersForReset();
      setShowAddStudentExpander(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to add student.' : 'Öğrenci eklenemedi.'));
    } finally {
      setAddingStudent(false);
    }
  };

  // Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedResetUser) return;
    setResettingPwd(true);
    try {
      const res = await api.post('/auth/reset-password-to-default', {
        user_id: selectedResetUser,
        role: pwdResetRole,
      });
      toast.success(res.data.message || (lang === 'en' ? 'Password reset to 12345!' : 'Şifre 12345 olarak sıfırlandı!'));
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to reset password.' : 'Şifre sıfırlanamadı.'));
    } finally {
      setResettingPwd(false);
    }
  };

  // Task Status Update
  const activeTask = projectTasks.find((t) => t.id === selectedTaskId);

  const handleUpdateTaskStatus = async (e) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    setUpdatingTask(true);
    try {
      if (taskEvidenceFile) {
        const formData = new FormData();
        formData.append('file', taskEvidenceFile);
        await api.post(`/tasks/${selectedTaskId}/evidence`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      await api.patch(`/tasks/${selectedTaskId}`, {
        status: taskNewStatus,
        evidence_link: taskEvidenceLink,
        skip_milestone_check: true,
      });
      toast.success(lang === 'en' ? 'Task updated successfully!' : 'Görev başarıyla güncellendi!');
      setTaskEvidenceFile(null);
      loadProjectDetail(selectedProjectName);
      fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to update task.' : 'Görev güncellenemedi.'));
    } finally {
      setUpdatingTask(false);
    }
  };

  // Task Comments
  const handleOpenComments = async (taskId) => {
    try {
      const res = await api.get(`/tasks/${taskId}/comments`);
      setTaskComments(res.data);
      setCommentsOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedTaskId) return;
    setPostingComment(true);
    try {
      await api.post(`/tasks/${selectedTaskId}/comments`, {
        comment: commentText.trim(),
      });
      toast.success(lang === 'en' ? 'Comment added!' : 'Yorum eklendi!');
      setCommentText('');
      const res = await api.get(`/tasks/${selectedTaskId}/comments`);
      setTaskComments(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to post comment.' : 'Yorum eklenemedi.'));
    } finally {
      setPostingComment(false);
    }
  };

  // Advisor Feedback Submission
  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim() || !selectedProjectName) return;
    setSendingFeedback(true);
    try {
      await api.post('/feedback', {
        project_name: selectedProjectName,
        feedback: feedbackText.trim(),
        action_item: actionItem.trim(),
        revision_required: revisionRequired,
      });
      toast.success(lang === 'en' ? 'Feedback saved!' : 'Danışman geri bildirimi kaydedildi!');
      setFeedbackText('');
      setActionItem('');
      setRevisionRequired(false);
      const fbRes = await api.get(`/feedback?project_name=${encodeURIComponent(selectedProjectName)}`);
      setProjectFeedbacks(fbRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || (lang === 'en' ? 'Failed to save feedback.' : 'Geri bildirim kaydedilemedi.'));
    } finally {
      setSendingFeedback(false);
    }
  };

  // Filtered projects for cards grid
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* ── 1. Hero Banner matching Streamlit dm-hero-banner ──────────────────────── */}
      <div className="bg-[#0a2342] text-white p-6 sm:p-8 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-slate-800">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border-2 border-blue-400 flex items-center justify-center text-3xl shrink-0">
            👨‍🏫
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-300 uppercase tracking-widest mb-1">
              {lang === 'en' ? 'Advisor Panel' : 'Danışman Paneli'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{user?.display_name}</h1>
            <div className="text-xs text-slate-300 mt-1">
              {projects.length} {lang === 'en' ? 'active projects' : 'aktif proje'} · {totalMembers}{' '}
              {lang === 'en' ? 'students under supervision' : 'öğrenci takip edilmektedir'}
            </div>
          </div>
        </div>

        {/* 4 Stat Pills on Right */}
        <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 bg-white/10 px-4 sm:px-6 py-3.5 rounded-2xl border border-white/10">
          <div className="text-center px-1 sm:px-2">
            <div className="text-xl sm:text-2xl font-black text-white">{projects.length}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Projects' : 'Proje'}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-1 sm:px-2">
            <div className="text-xl sm:text-2xl font-black text-blue-300">{totalMembers}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Students' : 'Öğrenci'}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-1 sm:px-2">
            <div className={`text-xl sm:text-2xl font-black ${highRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {highRiskCount}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'High Risk' : 'Yüksek Risk'}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center px-1 sm:px-2">
            <div className={`text-xl sm:text-2xl font-black ${totalOverdue > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
              {totalOverdue}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 uppercase tracking-wider font-semibold">
              {lang === 'en' ? 'Overdue' : 'Geciken'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Project Cards Grid (📁 Proje Genel Bakışı) ───────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📁</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {lang === 'en' ? 'Projects Overview' : 'Proje Genel Bakışı'}
              </h2>
              <div className="text-xs text-slate-500">
                {projects.length} {lang === 'en' ? 'active projects' : 'aktif proje'}
              </div>
            </div>
          </div>

          {/* Search Box & Risk Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'en' ? 'Search projects or leaders...' : 'Proje adı veya lider ara...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setRiskFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  riskFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600'
                }`}
              >
                {lang === 'en' ? 'All' : 'Tümü'}
              </button>
              <button
                onClick={() => setRiskFilter('Yuksek')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  riskFilter === 'Yuksek' ? 'bg-rose-600 text-white font-bold shadow-xs' : 'text-rose-700'
                }`}
              >
                {lang === 'en' ? 'High' : 'Yüksek'}
              </button>
              <button
                onClick={() => setRiskFilter('Orta')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  riskFilter === 'Orta' ? 'bg-amber-500 text-slate-950 font-bold shadow-xs' : 'text-amber-700'
                }`}
              >
                {lang === 'en' ? 'Medium' : 'Orta'}
              </button>
              <button
                onClick={() => setRiskFilter('Dusuk')}
                className={`px-2.5 py-1 rounded-md transition font-medium ${
                  riskFilter === 'Dusuk' ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'text-emerald-700'
                }`}
              >
                {lang === 'en' ? 'Low' : 'Düşük'}
              </button>
            </div>
          </div>
        </div>

        {/* Project Cards Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>{lang === 'en' ? 'Loading projects...' : 'Projeler yükleniyor...'}</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            {lang === 'en' ? 'No projects match your filter.' : 'Filtreye uygun proje bulunamadı.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => {
              const isSelected = p.name === selectedProjectName;
              return (
                <div
                  key={p.name}
                  onClick={() => handleSelectProject(p.name)}
                  className={`bg-white rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between group hover:shadow-md ${
                    isSelected
                      ? 'border-[#0a2342] ring-2 ring-[#0a2342]/20 shadow-sm'
                      : 'border-slate-200 hover:border-blue-400'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition line-clamp-2">
                        {p.name}
                      </h3>
                      <RiskBadge risk={p.risk} lang={lang} />
                    </div>
                    <div className="text-xs text-slate-500 mb-3 flex items-center space-x-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-medium text-slate-700">{lang === 'en' ? 'Leader:' : 'Lider:'}</span>
                      <span className="truncate">{p.leader || '—'}</span>
                    </div>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    <div className="space-y-1 mb-2.5">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-500">{lang === 'en' ? 'Completion' : 'Tamamlanma'}</span>
                        <span className="text-[#0a2342] font-black">%{Math.round(p.completion_pct)}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#0a2342] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, p.completion_pct))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 border-t border-slate-100">
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.members_count} {lang === 'en' ? 'members' : 'üye'}</span>
                      </span>
                      {p.overdue_count > 0 && (
                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                          {p.overdue_count} {lang === 'en' ? 'overdue' : 'geciken'}
                        </span>
                      )}
                      <span className="text-blue-600 font-semibold flex items-center group-hover:underline">
                        {lang === 'en' ? 'Inspect' : 'İncele'} <ChevronRight className="w-3 h-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3. Proje Özeti (Summary Table) ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📊</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {lang === 'en' ? 'Projects Summary' : 'Proje Özeti'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'en'
                  ? 'All projects completion, delay and risk overview'
                  : 'Tüm projelerin tamamlanma, gecikme ve risk durumu'}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#0a2342] text-white font-semibold">
              <tr>
                <th className="px-4 py-3">{lang === 'en' ? 'Project' : 'Proje'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Leader' : 'Lider'}</th>
                <th className="px-3 py-3 text-center">{lang === 'en' ? 'Members' : 'Üye'}</th>
                <th className="px-4 py-3">{lang === 'en' ? 'Completion %' : 'Tamamlanma %'}</th>
                <th className="px-3 py-3 text-center">{lang === 'en' ? 'Overdue Tasks' : 'Geciken Görev'}</th>
                <th className="px-4 py-3 text-center">{lang === 'en' ? 'Risk' : 'Risk'}</th>
                <th className="px-4 py-3 text-right">{lang === 'en' ? 'Action' : 'İşlem'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {projects.map((p) => (
                <tr key={p.name} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3 font-bold text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <span className="flex items-center space-x-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span>{p.leader || '—'}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-600">{p.members_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-[#0a2342] h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, p.completion_pct))}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-800">%{Math.round(p.completion_pct)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {p.overdue_count > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                        {p.overdue_count}
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <RiskBadge risk={p.risk} lang={lang} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSelectProject(p.name)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                    >
                      {lang === 'en' ? 'Inspect' : 'İncele'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. AI Project Analysis (🤖 AI Proje Analizi) ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🤖</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {lang === 'en' ? 'AI Project Analysis' : 'AI Proje Analizi'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'en'
                  ? 'AI assistant analyzes all capstone data and generates an executive report for the advisor.'
                  : 'AI Asistanı tüm proje verilerini analiz eder ve danışmana özel bir rapor üretir.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRunAI}
            disabled={aiLoading}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>
              {aiLoading
                ? (lang === 'en' ? 'Analyzing projects...' : 'Analiz yapılıyor...')
                : (lang === 'en' ? '✨ Analyze All Projects' : '✨ Tüm Projeleri Analiz Et')}
            </span>
          </button>
        </div>

        {aiReport && (
          <div className="p-5 bg-gradient-to-br from-indigo-50/60 to-blue-50/60 border border-indigo-100 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
              <span className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{lang === 'en' ? 'AI Diagnostic Summary' : 'Yapay Zeka Teşhis ve Önerileri'}</span>
              </span>
              {aiModelTag && <span className="text-[11px] text-slate-400 font-mono font-normal">{aiModelTag}</span>}
            </div>
            <div className="text-xs leading-relaxed text-slate-800 whitespace-pre-wrap">
              {aiReport}
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Student Search (🔍 Öğrenci Arama) ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <span className="text-xl">🔍</span>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {lang === 'en' ? 'Student Search' : 'Öğrenci Arama'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'en' ? 'Search by student name or student number' : 'Ad veya numara ile arayın'}
            </p>
          </div>
        </div>

        <form onSubmit={handleStudentSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={lang === 'en' ? 'Example: Ali Veli or 2001234567' : 'Örnek: Ali Veli veya 2001234567'}
              value={studentSearchInput}
              onChange={(e) => setStudentSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={searchingStudents || !studentSearchInput.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shrink-0"
          >
            {searchingStudents ? (lang === 'en' ? 'Searching...' : 'Aranıyor...') : (lang === 'en' ? 'Search' : 'Ara')}
          </button>
        </form>

        {studentSearchResults.length > 1 && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500">{lang === 'en' ? 'Multiple matches found:' : 'Birden fazla sonuç bulundu:'}</span>
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value, 10);
                setSearchedStudent(studentSearchResults[idx]);
              }}
              className="border border-slate-300 rounded px-2 py-1 bg-white text-xs font-medium"
            >
              {studentSearchResults.map((s, idx) => (
                <option key={s.student_no} value={idx}>
                  {s.student_name} ({s.student_no}) - {s.project_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {searchedStudent && (
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-5 animate-in fade-in">
            {/* Student Info Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-[#0a2342] text-white flex items-center justify-center text-xl shrink-0 font-bold">
                  🎓
                </div>
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">{searchedStudent.student_name}</div>
                  <div className="text-xs text-slate-500">
                    {searchedStudent.student_no} &nbsp;·&nbsp; {searchedStudent.project_name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    📌 {searchedStudent.responsibility} &nbsp;·&nbsp; 🎓 {searchedStudent.program || (lang === 'en' ? 'Engineering' : 'Mühendislik')}
                  </div>
                </div>
              </div>
              <span
                className={`self-start sm:self-center px-3 py-1 rounded-full text-xs font-bold ${
                  searchedStudent.is_leader
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-blue-100 text-blue-800 border border-blue-300'
                }`}
              >
                {searchedStudent.is_leader
                  ? (lang === 'en' ? '👑 Leader' : '👑 Lider')
                  : `👤 ${searchedStudent.role}`}
              </span>
            </div>

            {/* 3 Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                <div className="text-xs text-slate-500">{lang === 'en' ? 'Assigned Tasks' : 'Atanan Görev'}</div>
                <div className="text-xl font-black text-slate-900 mt-1">{searchedStudent.assigned_tasks_count}</div>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                <div className="text-xs text-slate-500">{lang === 'en' ? 'Completed' : 'Tamamlanan'}</div>
                <div className="text-xl font-black text-emerald-600 mt-1">{searchedStudent.completed_tasks_count}</div>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-center">
                <div className="text-xs text-slate-500">{lang === 'en' ? 'Progress' : 'İlerleme'}</div>
                <div className="text-xl font-black text-blue-600 mt-1">%{Math.round(searchedStudent.completion_pct)}</div>
              </div>
            </div>

            {/* Student Tasks Table */}
            {searchedStudent.tasks?.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 font-bold text-xs text-slate-800">
                  {lang === 'en' ? 'Assigned Tasks (Milestone Based)' : 'Görev Durumu (Milestone Bazlı)'}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0a2342] text-white">
                      <tr>
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Milestone</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Task' : 'Görev'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Status' : 'Durum'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Priority' : 'Öncelik'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Evidence' : 'Kanıt'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {searchedStudent.tasks.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-slate-500">#{t.id}</td>
                          <td className="px-3 py-2 font-bold text-blue-700">{getMilestoneLabel(t.milestone_key, lang)}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{t.title}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={t.status} lang={lang} />
                          </td>
                          <td className="px-3 py-2">{t.priority}</td>
                          <td className="px-3 py-2 text-slate-500">{t.deadline || '—'}</td>
                          <td className="px-3 py-2">
                            {t.evidence_link ? (
                              <a
                                href={t.evidence_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline flex items-center space-x-1"
                              >
                                <span>Link</span> <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-white p-4 rounded-lg border border-slate-200">
                {lang === 'en' ? 'No tasks assigned to this student.' : 'Bu öğrenciye atanmış görev yok.'}
              </div>
            )}

            {/* Team Members */}
            {searchedStudent.team_members?.length > 0 && (
              <div>
                <div className="font-bold text-xs text-slate-800 mb-2">
                  {lang === 'en' ? 'Team Members:' : 'Proje Ekip Üyeleri:'}
                </div>
                <MemberTable members={searchedStudent.team_members} lang={lang} />
              </div>
            )}

            {/* Weekly updates */}
            {searchedStudent.weekly_updates?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 font-bold text-xs text-slate-800">
                  {lang === 'en' ? 'Weekly Updates History' : 'Haftalık Giriş Geçmişi'}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0a2342] text-white">
                      <tr>
                        <th className="px-3 py-2">{lang === 'en' ? 'Week' : 'Hafta'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Completed' : 'Yapılanlar'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Blockers' : 'Engeller'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Next Step' : 'Sonraki Adım'}</th>
                        <th className="px-3 py-2">{lang === 'en' ? 'Date' : 'Tarih'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {searchedStudent.weekly_updates.map((w, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-bold text-blue-700">{w.week_start}</td>
                          <td className="px-3 py-2 text-slate-800">{w.completed}</td>
                          <td className="px-3 py-2 text-rose-600">{w.blockers || '—'}</td>
                          <td className="px-3 py-2 text-emerald-700">{w.next_step || '—'}</td>
                          <td className="px-3 py-2 text-slate-400">{w.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 6. Leader Assignment (👑 Proje Lideri Atama) ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <span className="text-xl">👑</span>
          <h2 className="text-base font-bold text-slate-900">
            {lang === 'en' ? 'Assign Project Leader' : 'Proje Lideri Atama'}
          </h2>
        </div>

        <form onSubmit={handleAssignLeader} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'en' ? 'Select Project' : 'Proje seçin'}
            </label>
            <select
              value={leaderAssignProject}
              onChange={(e) => setLeaderAssignProject(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              {projects.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {lang === 'en' ? 'Leader Candidate' : 'Lider adayı'}
            </label>
            <select
              value={selectedLeaderNo}
              onChange={(e) => setSelectedLeaderNo(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
            >
              {leaderAssignMembers.map((m) => (
                <option key={m.student_no} value={m.student_no}>
                  {m.student_name} ({m.student_no}) {m.role === 'Lider' ? (lang === 'en' ? '★ (Current Leader)' : '★ (Mevcut Lider)') : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={assigningLeader || !selectedLeaderNo}
            className="w-full px-4 py-2 bg-[#0a2342] hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shrink-0 cursor-pointer"
          >
            {assigningLeader
              ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
              : (lang === 'en' ? '👑 Save Leader' : '👑 Lideri Kaydet')}
          </button>
        </form>
      </div>

      {/* ── 7, 8, 9. Expandable Management Tools (CSV, Tek Öğrenci, Şifre) ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* CSV Upload Expander */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowCsvExpander(!showCsvExpander)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">📤</span>
              <div>
                <div className="text-xs font-bold text-slate-900">{lang === 'en' ? 'CSV Upload' : 'CSV Yükleme'}</div>
                <div className="text-[11px] text-slate-400">
                  {lang === 'en' ? 'Update student roster via CSV' : 'Öğrenci listesini güncelle'}
                </div>
              </div>
            </div>
            {showCsvExpander ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showCsvExpander && (
            <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                onClick={handleUploadCsv}
                disabled={uploadingCsv || !csvFile}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
              >
                {uploadingCsv
                  ? (lang === 'en' ? 'Uploading...' : 'Yükleniyor...')
                  : (lang === 'en' ? '✅ Update Roster' : '✅ Öğrenci Listesini Güncelle')}
              </button>
            </div>
          )}
        </div>

        {/* Add Single Student Expander */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowAddStudentExpander(!showAddStudentExpander)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">➕</span>
              <div>
                <div className="text-xs font-bold text-slate-900">{lang === 'en' ? 'Add Single Student' : 'Tek Öğrenci Ekleme'}</div>
                <div className="text-[11px] text-slate-400">
                  {lang === 'en' ? 'Enroll student to project' : 'Projeye manuel öğrenci ekle'}
                </div>
              </div>
            </div>
            {showAddStudentExpander ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showAddStudentExpander && (
            <form onSubmit={handleAddStudent} className="p-4 border-t border-slate-100 bg-slate-50 space-y-2.5">
              <input
                type="text"
                placeholder={lang === 'en' ? 'Student No (e.g. 2001234567)' : 'Öğrenci No (Örn: 2001234567)'}
                value={newStudentNo}
                onChange={(e) => setNewStudentNo(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder={lang === 'en' ? 'Student Full Name' : 'Ad Soyad'}
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                required
              />
              <label className="flex items-center space-x-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={useExistingProject}
                  onChange={(e) => setUseExistingProject(e.target.checked)}
                />
                <span>{lang === 'en' ? 'Add to existing project' : 'Mevcut bir projeye ekle'}</span>
              </label>
              {useExistingProject ? (
                <select
                  value={newStudentProjectSelect}
                  onChange={(e) => setNewStudentProjectSelect(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                >
                  {projects.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder={lang === 'en' ? 'New Project Name' : 'Yeni Proje Adı'}
                  value={newStudentProjectInput}
                  onChange={(e) => setNewStudentProjectInput(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                  required
                />
              )}
              <input
                type="text"
                placeholder={lang === 'en' ? 'Program (e.g. Computer Eng)' : 'Program (Örn: Bilgisayar Müh)'}
                value={newStudentProgram}
                onChange={(e) => setNewStudentProgram(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={addingStudent}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
              >
                {addingStudent
                  ? (lang === 'en' ? 'Adding...' : 'Ekleniyor...')
                  : (lang === 'en' ? '✅ Add Student' : '✅ Öğrenciyi Ekle')}
              </button>
            </form>
          )}
        </div>

        {/* Password Reset Expander */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            onClick={() => setShowPwdResetExpander(!showPwdResetExpander)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition"
          >
            <div className="flex items-center space-x-2">
              <span className="text-lg">🔑</span>
              <div>
                <div className="text-xs font-bold text-slate-900">{lang === 'en' ? 'Password Reset' : 'Şifre Sıfırlama'}</div>
                <div className="text-[11px] text-slate-400">
                  {lang === 'en' ? 'Reset user password to 12345' : 'Varsayılan şifreye sıfırla'}
                </div>
              </div>
            </div>
            {showPwdResetExpander ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showPwdResetExpander && (
            <form onSubmit={handleResetPassword} className="p-4 border-t border-slate-100 bg-slate-50 space-y-2.5">
              <div className="text-[11px] text-slate-500 leading-tight">
                {lang === 'en'
                  ? 'Selected user password will be reset to 12345 and mandatory change requested on login.'
                  : 'Seçilen kullanıcının şifresi 12345 olarak sıfırlanır ve ilk girişte değiştirmesi zorunlu olur.'}
              </div>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPwdResetRole('student');
                    if (resetUsersData.students?.length > 0) setSelectedResetUser(resetUsersData.students[0].user_id);
                  }}
                  className={`flex-1 py-1 rounded border font-semibold ${
                    pwdResetRole === 'student' ? 'bg-[#0a2342] text-white border-[#0a2342]' : 'bg-white text-slate-700'
                  }`}
                >
                  🎓 {lang === 'en' ? 'Student' : 'Öğrenci'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPwdResetRole('advisor');
                    if (resetUsersData.advisors?.length > 0) setSelectedResetUser(resetUsersData.advisors[0].user_id);
                  }}
                  className={`flex-1 py-1 rounded border font-semibold ${
                    pwdResetRole === 'advisor' ? 'bg-[#0a2342] text-white border-[#0a2342]' : 'bg-white text-slate-700'
                  }`}
                >
                  👨‍🏫 {lang === 'en' ? 'Advisor' : 'Danışman'}
                </button>
              </div>

              <select
                value={selectedResetUser}
                onChange={(e) => setSelectedResetUser(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
              >
                {pwdResetRole === 'student'
                  ? resetUsersData.students?.map((s) => (
                      <option key={s.user_id} value={s.user_id}>
                        {s.display_name} - {s.project_name}
                      </option>
                    ))
                  : resetUsersData.advisors?.map((a) => (
                      <option key={a.user_id} value={a.user_id}>
                        {a.display_name}
                      </option>
                    ))}
              </select>

              <button
                type="submit"
                disabled={resettingPwd || !selectedResetUser}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
              >
                {resettingPwd
                  ? (lang === 'en' ? 'Resetting...' : 'Sıfırlanıyor...')
                  : (lang === 'en' ? '🔑 Reset Password' : '🔑 Şifreyi Sıfırla')}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── 10. Proje Detayı & Görev Yönetimi ────────────────────────────────────── */}
      <div id="project-detail-section" className="space-y-6 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🗂️</span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {lang === 'en' ? 'Project Detail & Task Management' : 'Proje Detayı & Görev Yönetimi'}
              </h2>
              <p className="text-xs text-slate-500">
                {lang === 'en' ? 'Milestone progress, task approval and feedback' : 'Milestone takibi, görev onayı ve geri bildirim'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-600">{lang === 'en' ? 'Active Project:' : 'Detay Proje:'}</span>
            <select
              value={selectedProjectName}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 shadow-xs"
            >
              {projects.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {detailLoading ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
            <span>{lang === 'en' ? 'Loading project details...' : 'Proje detayları yükleniyor...'}</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 3 Metrics: Toplam Görev, Tamamlanma, Geciken */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
                <div className="text-xs text-slate-500 font-semibold">{lang === 'en' ? 'Total Tasks' : 'Toplam Görev'}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{projectTasks.length}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
                <div className="text-xs text-slate-500 font-semibold">{lang === 'en' ? 'Completion' : 'Tamamlanma'}</div>
                <div className="text-2xl font-black text-blue-600 mt-1">
                  %{Math.round(projectDetail?.completion_pct || 0)}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
                <div className="text-xs text-slate-500 font-semibold">{lang === 'en' ? 'Overdue Tasks' : 'Geciken Görev'}</div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    (projectDetail?.overdue_count || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {projectDetail?.overdue_count || 0}
                </div>
              </div>
            </div>

            {/* Team Members Table */}
            {projectDetail?.members && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  👥 {lang === 'en' ? 'Team Members & Roles' : 'Proje Ekip Üyeleri ve Rolleri'}
                </h3>
                <MemberTable members={projectDetail.members} lang={lang} />
              </div>
            )}

            {/* Milestone Stepper */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                🎯 {lang === 'en' ? 'Milestone Progression' : 'Milestone İlerleme Durumu (M1 - M6)'}
              </h3>
              <MilestoneProgress tasks={projectTasks} lang={lang} />
            </div>

            {/* Tasks Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-2">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  📋 {lang === 'en' ? 'Project Tasks List' : 'Proje Görev Listesi'}
                </h3>
                <span className="text-[11px] text-slate-400">{projectTasks.length} {lang === 'en' ? 'tasks' : 'görev'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0a2342] text-white">
                    <tr>
                      <th className="px-3 py-2.5">ID</th>
                      <th className="px-3 py-2.5">Milestone</th>
                      <th className="px-4 py-2.5">{lang === 'en' ? 'Task' : 'Görev'}</th>
                      <th className="px-3 py-2.5">{lang === 'en' ? 'Assignee' : 'Atanan Öğrenci'}</th>
                      <th className="px-3 py-2.5">{lang === 'en' ? 'Status' : 'Durum'}</th>
                      <th className="px-3 py-2.5">{lang === 'en' ? 'Priority' : 'Öncelik'}</th>
                      <th className="px-3 py-2.5">{lang === 'en' ? 'Deadline' : 'Bitiş Tarihi'}</th>
                      <th className="px-3 py-2.5">{lang === 'en' ? 'Evidence' : 'Kanıt'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {projectTasks.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => {
                          setSelectedTaskId(t.id);
                          setTaskNewStatus(t.status);
                          setTaskEvidenceLink(t.evidence_link || '');
                        }}
                        className={`hover:bg-blue-50/50 cursor-pointer transition ${
                          selectedTaskId === t.id ? 'bg-blue-50/80 font-bold' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-slate-500">#{t.id}</td>
                        <td className="px-3 py-2.5 font-bold text-blue-700">{getMilestoneLabel(t.milestone_key, lang)}</td>
                        <td className="px-4 py-2.5 text-slate-900">{t.title}</td>
                        <td className="px-3 py-2.5 text-slate-600">{t.assignee_name || t.assignee_student_no}</td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={t.status} lang={lang} />
                        </td>
                        <td className="px-3 py-2.5">{t.priority}</td>
                        <td className="px-3 py-2.5 text-slate-500">{t.deadline || '—'}</td>
                        <td className="px-3 py-2.5">
                          {t.evidence_link ? (
                            <a
                              href={t.evidence_link}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:underline flex items-center space-x-1"
                            >
                              <span>Link</span> <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : t.evidence_file ? (
                            <span className="text-emerald-600 font-semibold">{lang === 'en' ? '📁 File' : '📁 Dosya'}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Task Update & Active Card (✏️ Görev Durumu Güncelleme) */}
            {activeTask && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">✏️</span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {lang === 'en' ? 'Update Task Status & Review' : 'Görev Durumu Güncelleme'}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleOpenComments(activeTask.id)}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{lang === 'en' ? 'Comments' : 'Yorumlar'}</span>
                  </button>
                </div>

                {/* Active Task Highlight Card */}
                <ActiveTaskCard
                  task={activeTask}
                  milestoneLabel={getMilestoneLabel(activeTask.milestone_key, lang)}
                  lang={lang}
                />

                {/* Form to update status and evidence */}
                <form onSubmit={handleUpdateTaskStatus} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'en' ? 'New Status' : 'Yeni durum'}
                    </label>
                    <select
                      value={taskNewStatus}
                      onChange={(e) => setTaskNewStatus(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    >
                      <option value="TODO">{lang === 'en' ? 'TO DO' : 'YAPILACAK'}</option>
                      <option value="DOING">{lang === 'en' ? 'IN PROGRESS' : 'DEVAM EDİYOR'}</option>
                      <option value="DONE">{lang === 'en' ? 'DONE' : 'TAMAMLANDI'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'en' ? 'Evidence Link' : 'Kanıt linki'}
                    </label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={taskEvidenceLink}
                      onChange={(e) => setTaskEvidenceLink(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {lang === 'en' ? 'Evidence File' : 'Kanıt dosyası'}
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setTaskEvidenceFile(e.target.files[0] || null)}
                      className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={updatingTask}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      {updatingTask
                        ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
                        : (lang === 'en' ? '💾 Save Task Changes' : '💾 Görevi Güncelle')}
                    </button>
                  </div>
                </form>

                {/* Comments modal/drawer */}
                {commentsOpen && (
                  <div className="mt-4 p-4 border border-blue-200 rounded-xl bg-blue-50/40 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                      <span>💬 #{activeTask.id} - {activeTask.title} ({lang === 'en' ? 'Comments' : 'Yorumlar'})</span>
                      <button onClick={() => setCommentsOpen(false)} className="text-slate-400 hover:text-slate-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {taskComments.length === 0 ? (
                        <div className="text-xs text-slate-500 py-2">
                          {lang === 'en' ? 'No comments yet.' : 'Henüz yorum bulunmuyor.'}
                        </div>
                      ) : (
                        taskComments.map((c) => (
                          <div key={c.id} className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-700">
                              <span>{c.author_name || c.author_id} ({c.author_role})</span>
                              <span className="text-slate-400 font-normal">{c.created_at}</span>
                            </div>
                            <div className="text-slate-800">{c.comment}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={lang === 'en' ? 'Write a comment...' : 'Bir yorum yazın...'}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                        required
                      />
                      <button
                        type="submit"
                        disabled={postingComment || !commentText.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                      >
                        {postingComment ? '...' : (lang === 'en' ? 'Post' : 'Gönder')}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* Weekly Updates Table (📅 Haftalık Güncellemeler) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-2">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  📅 {lang === 'en' ? 'Weekly Diaries / Logs' : 'Haftalık Güncellemeler'}
                </h3>
                <span className="text-[11px] text-slate-400">{projectWeekly.length} {lang === 'en' ? 'logs' : 'giriş'}</span>
              </div>

              {projectWeekly.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {lang === 'en' ? 'No weekly logs registered for this project.' : 'Bu projeye ait haftalık rapor bulunmuyor.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#0a2342] text-white">
                      <tr>
                        <th className="px-3 py-2.5">{lang === 'en' ? 'Student' : 'Öğrenci'}</th>
                        <th className="px-3 py-2.5">{lang === 'en' ? 'Week' : 'Hafta'}</th>
                        <th className="px-4 py-2.5">{lang === 'en' ? 'Completed Work' : 'Yapılanlar'}</th>
                        <th className="px-3 py-2.5">{lang === 'en' ? 'Blockers' : 'Engeller'}</th>
                        <th className="px-3 py-2.5">{lang === 'en' ? 'Next Step' : 'Sonraki Adım'}</th>
                        <th className="px-3 py-2.5">{lang === 'en' ? 'Date' : 'Tarih'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {projectWeekly.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{w.student_name || w.student_no}</td>
                          <td className="px-3 py-2.5 font-mono text-blue-700 font-bold">{w.week_start}</td>
                          <td className="px-4 py-2.5 text-slate-800">{w.completed}</td>
                          <td className="px-3 py-2.5 text-rose-600">{w.blockers || '—'}</td>
                          <td className="px-3 py-2.5 text-emerald-700">{w.next_step || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-400">{w.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Advisor Feedback & Action Items (📝 Danışman Geri Bildirimi) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <span className="text-xl">📝</span>
                <h3 className="text-base font-bold text-slate-900">
                  {lang === 'en' ? 'Advisor Feedback & Action Items' : 'Danışman Geri Bildirimi'}
                </h3>
              </div>

              <form onSubmit={handleSendFeedback} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Write Feedback' : 'Geri bildirim yazın'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={lang === 'en' ? 'Write official review for this project...' : 'Proje ilerleyişi hakkında resmi danışman değerlendirmesi...'}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {lang === 'en' ? 'Action Item' : 'Aksiyon maddesi'}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === 'en' ? 'Next milestone target or action...' : 'Sonraki hedef veya aksiyon...'}
                    value={actionItem}
                    onChange={(e) => setActionItem(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <label className="flex items-center space-x-2 text-xs font-bold text-rose-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={revisionRequired}
                      onChange={(e) => setRevisionRequired(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>{lang === 'en' ? 'Revision required' : 'Revizyon gerekli'}</span>
                  </label>

                  <button
                    type="submit"
                    disabled={sendingFeedback || !feedbackText.trim()}
                    className="px-5 py-2.5 bg-[#0a2342] hover:bg-slate-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {sendingFeedback
                      ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
                      : (lang === 'en' ? '💾 Save Feedback' : '💾 Kaydet')}
                  </button>
                </div>
              </form>
            </div>

            {/* Feedback History (🗃️ Geçmiş Geri Bildirimler) */}
            {projectFeedbacks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🗃️</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {lang === 'en' ? 'Feedback History' : 'Geçmiş Geri Bildirimler'}
                  </h3>
                </div>
                <div className="space-y-3">
                  {projectFeedbacks.map((fb) => (
                    <FeedbackCard key={fb.id} feedback={fb} lang={lang} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
