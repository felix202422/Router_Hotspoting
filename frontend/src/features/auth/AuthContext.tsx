import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AdminProfile } from '@/types';
import { adminLogin, adminLogout } from '@/services/api';
import { getAccessToken, clearAuthTokens } from '@/services/http';

const PROFILE_KEY = 'hotspot_admin_profile';

interface AuthContextValue {
  profile: AdminProfile | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredProfile(): AdminProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw || !getAccessToken()) return null;
    return JSON.parse(raw) as AdminProfile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(readStoredProfile());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await adminLogin(email, password);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(res.profile));
    setProfile(res.profile);
  }, []);

  const logout = useCallback(async () => {
    await adminLogout();
    localStorage.removeItem(PROFILE_KEY);
    clearAuthTokens();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ profile, ready, login, logout }),
    [profile, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
