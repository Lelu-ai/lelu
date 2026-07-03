"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

const inputCls =
  "w-full h-11 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  if (!token) {
    return (
      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200/70 dark:border-red-800/40 text-[13px] text-red-700 dark:text-red-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        This reset link is missing its token. Please request a new one from the{" "}
        <Link href="/forgot-password" className="underline underline-offset-2 font-semibold">
          forgot password
        </Link>{" "}
        page.
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Password reset failed. Please try again.");
        return;
      }
      router.push("/login?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
        <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-[#E4E4E7]" htmlFor="password">
          New password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
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

      <div className="space-y-1.5">
        <label className="block text-[13px] font-medium text-[#0A0A0A] dark:text-[#E4E4E7]" htmlFor="confirm">
          Confirm new password
        </label>
        <input
          id="confirm"
          type={showPw ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your new password"
          className={inputCls}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 mt-1 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA] dark:bg-[#0B0B0C]">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
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
              Choose a new password
            </h1>
            <p className="text-[14px] text-[#737373]">
              Pick a strong password you don&apos;t use elsewhere.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] dark:shadow-none">
            <Suspense>
              <ResetForm />
            </Suspense>
          </div>

          <p className="mt-5 text-center text-[13px] text-[#737373]">
            <Link
              href="/login"
              className="text-[#0A0A0A] dark:text-white font-semibold hover:underline underline-offset-2"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
