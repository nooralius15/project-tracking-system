import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Globe, Shield, User, GraduationCap, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout, lang, toggleLang } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleIcon = () => {
    if (!user) return <User className="w-4 h-4" />;
    if (user.role === 'advisor') return <Shield className="w-4 h-4 text-amber-400" />;
    return <GraduationCap className="w-4 h-4 text-blue-400" />;
  };

  const getRoleTitle = () => {
    if (!user) return '';
    if (user.role === 'advisor') {
      if (lang === 'en') return user.is_admin ? 'Admin Advisor' : 'Academic Advisor';
      return user.is_admin ? 'Admin Danışman' : 'Danışman';
    }
    return lang === 'en' ? 'Student' : 'Öğrenci';
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Branding */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-xl shadow-inner shrink-0">
            🎓
          </div>
          <div>
            <div className="font-bold text-sm sm:text-base leading-tight tracking-tight text-white">
              OSTİM Teknik Üniversitesi
            </div>
            <div className="text-xs text-slate-400 font-medium hidden sm:block">
              {lang === 'en' ? 'Capstone Project Tracking System' : 'Bitirme Projesi Takip Sistemi'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium sm:hidden">
              {lang === 'en' ? 'Project Tracker' : 'Proje Takip'}
            </div>
          </div>
        </div>

        {/* Desktop Controls (sm & up) */}
        <div className="hidden sm:flex items-center space-x-3">
          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            title={lang === 'en' ? 'Switch to Turkish' : 'İngilizceye Geç'}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}</span>
          </button>

          {/* User Session Profile */}
          {user && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
              {getRoleIcon()}
              <div className="text-left">
                <div className="text-xs font-semibold text-white leading-tight">
                  {user.display_name}
                </div>
                <div className="text-[10px] text-slate-400 leading-none">
                  {getRoleTitle()}
                </div>
              </div>
            </div>
          )}

          {/* Logout Button */}
          {user && (
            <button
              onClick={logout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition cursor-pointer"
              title={lang === 'en' ? 'Logout' : 'Çıkış Yap'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'Logout' : 'Çıkış'}</span>
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center space-x-2 sm:hidden">
          <button
            onClick={toggleLang}
            className="p-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 border border-slate-700"
            aria-label="Toggle language"
          >
            {lang === 'tr' ? '🇹🇷' : '🇬🇧'}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            aria-label="Menüyü Aç/Kapat"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden fixed top-16 left-0 right-0 bg-slate-900 border-b border-slate-800 p-4 space-y-4 z-40 shadow-2xl animate-in slide-in-from-top duration-200">
          {user && (
            <div className="flex items-center space-x-3 p-3 bg-slate-800/80 rounded-xl border border-slate-700">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                {getRoleIcon()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {user.display_name}
                </div>
                <div className="text-xs text-slate-400">
                  {getRoleTitle()} {user.user_id ? `· ${user.user_id}` : ''}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => {
                toggleLang();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold text-slate-200 border border-slate-700 transition"
            >
              <Globe className="w-4 h-4 text-blue-400" />
              <span>{lang === 'tr' ? 'English (EN)' : 'Türkçe (TR)'}</span>
            </button>

            {/* Logout Button */}
            {user && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="flex items-center justify-center space-x-2 py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/30 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>{lang === 'en' ? 'Logout' : 'Çıkış Yap'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
