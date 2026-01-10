import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login, authRequired, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await login(password);
    if (!result.ok) {
      setError(result.message || "Login failed");
      setSubmitting(false);
    } else {
      navigate("/", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-nebula flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!authRequired) {
    return null;
  }

  return (
    <div className="min-h-screen bg-nebula flex items-center justify-center px-4">
      <div className="glass-panel rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Nebula</h1>
          <p className="text-white/60 text-sm">Please login to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-sky-500/50 transition-colors"
              placeholder="Enter your password"
              autoFocus
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-sky-500/20"
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
