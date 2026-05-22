"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-md bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 text-[13px] text-red-700 dark:text-red-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full h-10 px-3 rounded-md border border-[#E7E5E4] dark:border-[#27272A] bg-white dark:bg-[#141416] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] dark:focus:ring-white focus:ring-offset-0 transition"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-[#0A0A0A] dark:text-white" htmlFor="password">
            Password
          </label>
          <button type="button" className="text-[12px] text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors">
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full h-10 px-3 pr-10 rounded-md border border-[#E7E5E4] dark:border-[#27272A] bg-white dark:bg-[#141416] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] dark:focus:ring-white transition"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
            tabIndex={-1}
          >
            {showPw ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-10 rounded-md bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 bg-[#FAFAFA] dark:bg-[#0B0B0C]">
      <div className="w-full max-w-[400px]">
        {/* Card */}
        <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#27272A] rounded-xl p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] dark:text-white mb-1">
              Welcome back
            </h1>
            <p className="text-[14px] text-[#737373]">
              Sign in to your Lelu account
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <p className="mt-6 text-center text-[13px] text-[#737373]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-[#0A0A0A] dark:text-white font-medium hover:underline underline-offset-2"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[12px] text-[#A3A3A3]">
          By signing in, you agree to our{" "}
          <a href="/terms" className="hover:text-[#737373] transition-colors">Terms</a>
          {" "}and{" "}
          <a href="/privacy" className="hover:text-[#737373] transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
