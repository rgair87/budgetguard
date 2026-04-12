import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../api/client';
import type { User } from '@spenditure/shared';

interface AuthState {
  user: Omit<User, 'password_hash'> | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const defaultState: AuthState = {
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthState>(defaultState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Omit<User, 'password_hash'> | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('runway_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Validate token by fetching runway (implicitly checks auth)
      api.get('/runway')
        .then(() => {
          // Token is valid, try to get user info from stored data
          const stored = localStorage.getItem('runway_user');
          if (stored) {
            try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('runway_user'); }
          }
        })
        .catch(() => {
          localStorage.removeItem('runway_token');
          localStorage.removeItem('runway_refresh_token');
          localStorage.removeItem('runway_user');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('runway_token', data.token);
    localStorage.setItem('runway_refresh_token', data.refreshToken);
    localStorage.setItem('runway_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  async function register(email: string, password: string) {
    const { data } = await api.post('/auth/register', { email, password });
    localStorage.setItem('runway_token', data.token);
    localStorage.setItem('runway_refresh_token', data.refreshToken);
    localStorage.setItem('runway_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    const refreshToken = localStorage.getItem('runway_refresh_token');
    if (refreshToken) {
      // Fire-and-forget: revoke on server
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('runway_token');
    localStorage.removeItem('runway_refresh_token');
    localStorage.removeItem('runway_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
