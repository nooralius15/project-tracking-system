import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { GraduationCap, Shield, Lock, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

export default function LoginView() {
  const { login, lang } = useAuth();
  const toast = useToast();
  const [role, setRole] = useState('student'); // 'student' | 'advisor'
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // First-time token activation modal state
  const [showActivate, setShowActivate] = useState(false);
  const [actUserId, setActUserId] = useState('');
  const [actRole, setActRole] = useState('student');
  const [actToken, setActToken] = useState('');
  const [actNewPw, setActNewPw] = useState('');
  const [actSuccess, setActSuccess] = useState('');

  useEffect(() => {
    api.get('/auth/advisors')
      .then((res) => {
        setAdvisors(res.data);
        if (role === 'advisor' && res.data.length > 0) {
          setUserId(res.data[0].user_id);
        }
      })
      .catch(() => {});
  }, []);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
    if (newRole === 'advisor') {
      if (advisors.length > 0) setUserId(advisors[0].user_id);
    } else {
      setUserId('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!userId.trim()) {
      setError(lang === 'en' ? 'User ID is required.' : 'Kullanıcı bilgisi gerekli.');
      return;
    }
    if (!password) {
      setError(lang === 'en' ? 'Password is required.' : 'Şifre alanı boş bırakılamaz.');
      return;
    }

    setLoading(true);
    try {
      await login(userId.trim(), role, password);
      toast.success(lang === 'en' ? 'Welcome back!' : 'Giriş başarılı! Hoş geldiniz.');
    } catch (err) {
      const msg = err.response?.data?.detail || (lang === 'en' ? 'Login failed.' : 'Giriş başarısız.');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    setActSuccess('');
    try {
      const res = await api.post('/auth/activate', {
        user_id: actUserId.trim(),
        role: actRole,
        token: actToken.trim(),
        new_password: actNewPw,
      });
      const msg = res.data.message || (lang === 'en' ? 'Account activated! You can now log in.' : 'Hesap başarıyla aktive edildi!');
      setActSuccess(msg);
      toast.success(msg);
      setTimeout(() => {
        setShowActivate(false);
        setUserId(actUserId);
        setPassword(actNewPw);
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || (lang === 'en' ? 'Activation failed.' : 'Aktivasyon başarısız.');
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-slate-900 p-8 text-center text-white relative">
          <div className="w-16 h-16 bg-blue-600/30 border border-blue-400/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">
            🎓
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            OSTİM Teknik Üniversitesi
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {lang === 'en' ? 'Capstone Project Tracking System' : 'Bitirme Projesi Takip Sistemi'}
          </p>
        </div>

        {/* Form Body */}
        <div className="p-8">
          {/* Role Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => handleRoleChange('student')}
              className={`flex-1 flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition ${
                role === 'student'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4 mr-1.5" />
              {lang === 'en' ? 'Student' : 'Öğrenci'}
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('advisor')}
              className={`flex-1 flex items-center justify-center py-2 text-xs font-semibold rounded-lg transition ${
                role === 'advisor'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4 mr-1.5" />
              {lang === 'en' ? 'Academic Advisor' : 'Danışman'}
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 flex items-start space-x-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {actSuccess && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-medium">
              {actSuccess}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'student' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'en' ? 'Student ID Number' : 'Öğrenci Numarası'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="210208001"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    required
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {lang === 'en' ? 'Select Advisor' : 'Danışman Seçimi'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <select
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    required
                  >
                    {advisors.map((adv) => (
                      <option key={adv.user_id} value={adv.user_id}>
                        {adv.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {lang === 'en' ? 'Password' : 'Şifre'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? (lang === 'en' ? 'Logging in...' : 'Giriş yapılıyor...') : (lang === 'en' ? 'Sign In' : 'Giriş Yap')}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Token activation shortcut */}
          <div className="mt-6 pt-4 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={() => setShowActivate(!showActivate)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center space-x-1"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Have a one-time activation token?' : 'Aktivasyon kodunuz mu var?'}</span>
            </button>
          </div>

          {showActivate && (
            <form onSubmit={handleActivate} className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-800">
                {lang === 'en' ? 'Account Activation' : 'Hesap Aktivasyonu'}
              </h3>
              <input
                type="text"
                placeholder={lang === 'en' ? 'Student ID / Username' : 'Öğrenci No / Kullanıcı Adı'}
                value={actUserId}
                onChange={(e) => setActUserId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                required
              />
              <input
                type="text"
                placeholder={lang === 'en' ? 'Activation Token (8-char)' : 'Aktivasyon Kodu (8 haneli)'}
                value={actToken}
                onChange={(e) => setActToken(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                required
              />
              <input
                type="password"
                placeholder={lang === 'en' ? 'New Password (min 6 chars)' : 'Yeni Şifre (en az 6 karakter)'}
                value={actNewPw}
                onChange={(e) => setActNewPw(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                required
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition"
              >
                {lang === 'en' ? 'Activate Account' : 'Hesabı Aktive Et'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
