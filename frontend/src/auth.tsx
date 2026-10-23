import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api } from './api';
import type { Role, User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (b: { email: string; password: string; fullName: string; role: Exclude<Role, 'admin'>; companyName?: string }) => Promise<User>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<User>('/auth/me').then(setUser).catch((e) => {
      if (!(e instanceof ApiError) || e.status !== 401) console.warn(e);
    }).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.post<User>('/auth/login', { email, password });
    setUser(u);
    return u;
  }, []);
  const register: AuthCtx['register'] = useCallback(async (b) => {
    const u = await api.post<User>('/auth/register', b);
    setUser(u);
    return u;
  }, []);
  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}

export const homeFor = (r: Role) => (r === 'admin' ? '/admin' : r === 'employer' ? '/employer' : '/seeker');
