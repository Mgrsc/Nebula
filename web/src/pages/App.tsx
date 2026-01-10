import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Settings from "./Settings";
import Login from "./Login";
import { coerceLanguage, strings, type Language } from "../i18n";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../utils/api";
import type { ApiSettingsResponse } from "../../../shared/api";

function NebulaLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nebulaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7F00FF" />
          <stop offset="50%" stopColor="#E100FF" />
          <stop offset="100%" stopColor="#00D4FF" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path
        d="M256 100 C 150 100 80 180 80 256 C 80 380 200 412 256 412 C 362 412 432 332 432 256 C 432 132 312 100 256 100 Z"
        stroke="url(#nebulaGradient)"
        strokeWidth="40"
        strokeLinecap="round"
        fill="none"
        filter="url(#glow)"
        opacity="0.9"
      />
      <path
        d="M160 256 C 160 200 200 180 256 180 C 312 180 352 200 352 256"
        stroke="white"
        strokeWidth="24"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="256" cy="256" r="30" fill="#00D4FF" filter="url(#glow)" />
    </svg>
  );
}

function Nav({ lang }: { lang: Language }) {
  const { pathname } = useLocation();
  const { isAuthenticated, authRequired, logout } = useAuth();
  const t = strings[lang];

  const item = (to: string, label: string) => (
    <Link
      to={to}
      className={[
        "rounded px-3 py-1 text-sm",
        pathname === to ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
      ].join(" ")}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-white font-semibold">
          <NebulaLogo />
          Nebula
        </div>
        <div className="flex gap-1">
          {item("/", t.navDashboard)}
          {item("/settings", t.navSettings)}
        </div>
      </div>
      {authRequired ? (
        isAuthenticated ? (
          <button
            onClick={logout}
            className="rounded px-3 py-1 text-sm text-white/70 hover:text-white hover:bg-white/5"
          >
            {lang === "zh-CN" ? "退出登录" : "Logout"}
          </button>
        ) : (
          <Link
            to="/login"
            className={[
              "rounded px-3 py-1 text-sm",
              pathname === "/login" ? "bg-white/10 text-white" : "text-white/70 hover:text-white"
            ].join(" ")}
          >
            {lang === "zh-CN" ? "登录" : "Login"}
          </Link>
        )
      ) : null}
    </div>
  );
}

function AppContent() {
  const [lang, setLang] = useState<Language>("zh-CN");
  const { isAuthenticated, authRequired, publicDashboard, loading, token } = useAuth();
  const viewRequiresAuth = authRequired && !publicDashboard;

  useEffect(() => {
    let alive = true;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    apiFetch<ApiSettingsResponse>("/api/settings", { headers })
      .then((s) => {
        if (!alive) return;
        const next = coerceLanguage(s.language);
        setLang(next);
        document.documentElement.lang = next;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (viewRequiresAuth && !isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-nebula text-slate-100">
      <Nav lang={lang} />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/settings" element={authRequired && !isAuthenticated ? <Login /> : <Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
