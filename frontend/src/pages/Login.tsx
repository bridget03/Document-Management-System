import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { login, me } from "../services/authApi";
import { useAuthStore } from "../stores/authStore";
import { FileStack } from "lucide-react";
import Button from "../components/ui/Button";
import { TextInput, Field } from "../components/ui/Input";
import {
  LoadingVeil,
  prefetchWorkspace,
} from "../components/layout/LoadingVeil";
import logoUrl from "../assets/logo.jpeg";

export default function Login() {
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      setAuth(data.user, data.access_token);
      try {
        const u = await me();
        setAuth(u, data.access_token);
      } catch {
        /* ignore */
      }
      // Smooth handoff: veil + warm dashboard cache before navigating.
      setEntering(true);
      await Promise.all([
        prefetchWorkspace(qc),
        new Promise((r) => setTimeout(r, 700)),
      ]);
      nav("/dashboard");
    } catch {
      setError("Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {entering && <LoadingVeil message="Đang đăng nhập.." />}
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2.5">
            <img
              src={logoUrl}
              alt="Vicenza DMS logo"
              className="h-24 w-24 shrink-0 rounded-lg object-cover"
            />
          </div>
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white">
              <FileStack size={24} />
            </span>
            <h1 className="text-xl font-bold text-gray-900">
              Vicenza Document Management System
            </h1>
            <p className="text-sm text-gray-500">Sign in to your workspace</p>
          </div>
          <form
            onSubmit={submit}
            className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-card"
          >
            {error && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {error}
              </p>
            )}
            <Field label="Email">
              <TextInput
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button
              type="submit"
              loading={loading}
              className="w-full h-12 rounded-lg bg-slate-900 text-white font-medium shadow-sm transition-all
                      duration-200
                      hover:bg-slate-700
                      hover:shadow-md
                      active:scale-[0.99]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
            >
              Sign in
            </Button>
            <p className="text-center text-xs text-gray-400">
              Default account: admin@example.com / admin123
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
