import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { apiFetch } from "../utils/api";
import type { ApiAuthLoginResponse, ApiAuthStatusResponse } from "../../../shared/api";

type AuthContextType = {
  isAuthenticated: boolean;
  authRequired: boolean;
  publicDashboard: boolean;
  loading: boolean;
  token: string | null;
  login: (password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  setupPassword: (password: string) => Promise<{ ok: boolean; message?: string }>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [publicDashboard, setPublicDashboard] = useState(true);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const checkAuth = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ApiAuthStatusResponse>("/api/auth/status");
      const nextAuthRequired = Boolean(data.enabled && data.configured);
      setAuthRequired(nextAuthRequired);
      setPublicDashboard(data.publicDashboard !== false);

      const storedToken = localStorage.getItem("nebula_auth_token");
      if (nextAuthRequired) {
        if (storedToken) {
          try {
            await apiFetch<{ ok: true }>("/api/auth/me", {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
            setToken(storedToken);
            setIsAuthenticated(true);
          } catch {
            localStorage.removeItem("nebula_auth_token");
            setToken(null);
            setIsAuthenticated(false);
          }
        } else {
          setToken(null);
          setIsAuthenticated(false);
        }
      } else {
        localStorage.removeItem("nebula_auth_token");
        setToken(null);
        setIsAuthenticated(true);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (password: string) => {
    try {
      const data = await apiFetch<ApiAuthLoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      setToken(data.token);
      setIsAuthenticated(true);
      localStorage.setItem("nebula_auth_token", data.token);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: String(e?.message ?? e) };
    }
  };

  const logout = () => {
    if (token) {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});
    }

    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem("nebula_auth_token");
  };

  const setupPassword = async (password: string) => {
    try {
      await apiFetch<{ ok: true }>("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });
      await checkAuth();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: String(e?.message ?? e) };
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, authRequired, publicDashboard, loading, token, login, logout, setupPassword, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useAuthHeaders(): Record<string, string> {
  const { token } = useAuth();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
