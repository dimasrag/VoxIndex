import { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setUser(null);
      setAuthReady(true);
      return () => {
        cancelled = true;
      };
    }

    setAuthReady(false);
    apiClient.get('/auth/me')
      .then((res) => {
        if (!cancelled) {
          setUser(res.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    const res = await apiClient.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    setToken(res.data.access_token);
    setUser({ username, is_admin: res.data.is_admin });
    setAuthReady(true);
    return res.data;
  };

  const register = async (username, email, password) => {
    const res = await apiClient.post('/auth/register', { username, email, password });
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAuthReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, token, authReady, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
