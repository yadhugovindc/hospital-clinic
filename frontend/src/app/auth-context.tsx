import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services';
import type { SessionUser, Role } from '../types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {
    throw new Error('AuthProvider missing');
  },
  logout: async () => undefined,
  refresh: async () => undefined,
});

export function roleHome(role: Role | undefined): string {
  if (!role) return '/login';
  const homes: Record<Role, string> = {
    admin: '/admin/dashboard',
    receptionist: '/reception/dashboard',
    doctor: '/doctor/dashboard',
    pharmacist: '/pharmacy/dashboard',
    therapist: '/therapist/dashboard',
    accountant: '/accounts/dashboard',
  };
  return homes[role];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const u = await authApi.login(email, password);
      setUser(u);
      queryClient.clear();
      return u;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
