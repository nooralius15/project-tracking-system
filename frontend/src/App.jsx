import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import AIChatDrawer from './components/AIChatDrawer';
import LoginView from './views/LoginView';
import AdvisorDashboard from './views/AdvisorDashboard';
import LeaderDashboard from './views/LeaderDashboard';
import StudentDashboard from './views/StudentDashboard';
import api from './api/client';
import { Crown, GraduationCap, Lock, AlertCircle, ArrowRight } from 'lucide-react';

function MainApp() {
  const { user, loading, changePassword, lang } = useAuth();
  const [studentProjects, setStudentProjects] = useState([]);
  const [activeLeaderProject, setActiveLeaderProject] = useState(null);
  const [activeView, setActiveView] = useState('student'); // 'student' | 'leader'

  // Forced password change form state
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === 'student') {
      api.get('/projects')
        .then((res) => {
          setStudentProjects(res.data);
          // Check if student is leader of any project
          const ledProject = res.data.find((p) => p.leader_student_no === user.user_id);
          if (ledProject) {
            setActiveLeaderProject(ledProject);
            setActiveView('leader'); // Default to leader panel if leader
          }
        })
        .catch(() => {});
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-400">
            {lang === 'en' ? 'Loading...' : 'Yükleniyor...'}
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Force Password Change Gate
  if (user.force_password_change) {
    const handlePwSubmit = async (e) => {
      e.preventDefault();
      setPwError('');
      if (newPw.length < 6) {
        setPwError(lang === 'en' ? 'Minimum 6 characters.' : 'Şifre en az 6 karakter olmalıdır.');
        return;
      }
      if (newPw !== confirmPw) {
        setPwError(lang === 'en' ? 'Passwords do not match.' : 'Şifreler eşleşmiyor.');
        return;
      }
      setPwLoading(true);
      try {
        await changePassword(newPw, confirmPw);
      } catch (err) {
        setPwError(err.response?.data?.detail || 'Şifre güncellenemedi.');
      } finally {
        setPwLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-amber-50 border border-amber-200 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {lang === 'en' ? 'Change Your Password' : 'İlk Girişte Şifre Değişikliği'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {lang === 'en'
                ? 'For security reasons, you must set a new password on your first login.'
                : 'Hesap güvenliğiniz için ilk girişinizde varsayılan şifrenizi değiştirmeniz zorunludur.'}
            </p>
          </div>

          {pwError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwError}</span>
            </div>
          )}

          <form onSubmit={handlePwSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'en' ? 'New Password' : 'Yeni Şifre'}
              </label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {lang === 'en' ? 'Confirm New Password' : 'Yeni Şifre (Tekrar)'}
              </label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition"
            >
              {pwLoading
                ? (lang === 'en' ? 'Saving...' : 'Kaydediliyor...')
                : (lang === 'en' ? 'Update Password and Continue' : 'Şifremi Güncelle ve Devam Et')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <Navbar />

      {/* Role Toggle Switcher for Leaders */}
      {user.role === 'student' && activeLeaderProject && (
        <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <span className="text-slate-400">
              📁 {activeLeaderProject.name} ({lang === 'en' ? 'Team Leader Access' : 'Lider Yetkisi'})
            </span>
            <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setActiveView('leader')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                  activeView === 'leader'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Leader Panel' : 'Lider Paneli'}</span>
              </button>
              <button
                onClick={() => setActiveView('student')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md transition ${
                  activeView === 'student'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>{lang === 'en' ? 'Student Workspace' : 'Öğrenci Görünümü'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content View Routing */}
      <main className="flex-1 pb-16">
        {user.role === 'advisor' && <AdvisorDashboard />}
        {user.role === 'student' && activeView === 'leader' && (
          <LeaderDashboard project={activeLeaderProject} />
        )}
        {user.role === 'student' && activeView === 'student' && <StudentDashboard />}
      </main>

      {/* Floating AI Assistant on All Panels */}
      <AIChatDrawer projectName={activeLeaderProject?.name || studentProjects[0]?.name || ''} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
