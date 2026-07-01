"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

const inputCls =
  "w-full h-11 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const registered = params.get("registered") === "1";

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
    <form onSubmit={submit} className="space-y-5">
      {registered && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/70 dark:border-emerald-800/40 text-[13px] text-emerald-700 dark:text-emerald-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Account created! Sign in to continue.
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200/70 dark:border-red-800/40 text-[13px] text-red-700 dark:text-red-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-[#E4E4E7]" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-medium text-[#0A0A0A] dark:text-[#E4E4E7]" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${inputCls} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
            tabIndex={-1}
            aria-label={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 mt-1 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0B0B0C]">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mb-10 group">
          <LeluMark size={22} />
          <span
            className="font-bold text-[16px] text-[#0A0A0A] dark:text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            lelu
          </span>
        </Link>

        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white mb-2">
              Welcome back
            </h1>
            <p className="text-[14px] text-[#737373]">
              Sign in to your Lelu account
            </p>
          </div>

          <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] dark:shadow-none">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-5 text-center text-[13px] text-[#737373]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-[#0A0A0A] dark:text-white font-semibold hover:underline underline-offset-2"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-10 text-center text-[12px] text-[#A3A3A3]">
          By signing in, you agree to our{" "}
          <a href="/terms" className="hover:text-[#737373] transition-colors underline underline-offset-2">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="hover:text-[#737373] transition-colors underline underline-offset-2">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
