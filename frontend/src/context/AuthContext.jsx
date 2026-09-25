import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'tr');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (userId, role, password) => {
    const res = await api.post('/auth/login', {
      user_id: userId,
      role: role,
      password: password,
    });
    const { access_token, user: userData } = res.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const changePassword = async (newPassword, confirmPassword) => {
    await api.post('/auth/change-password', {
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    if (user) {
      const updated = { ...user, force_password_change: false };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  };

  const toggleLang = () => {
    const next = lang === 'tr' ? 'en' : 'tr';
    setLang(next);
    localStorage.setItem('lang', next);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        lang,
        loading,
        login,
        logout,
        changePassword,
        toggleLang,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
