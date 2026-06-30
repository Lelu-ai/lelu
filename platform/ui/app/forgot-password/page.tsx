"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

const inputCls =
  "w-full h-11 px-3.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A2A2C] bg-white dark:bg-[#18181B] text-[#0A0A0A] dark:text-white placeholder:text-[#A3A3A3] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 dark:focus:ring-white/10 focus:border-[#0A0A0A] dark:focus:border-white/30 transition-all";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
              Reset your password
            </h1>
            <p className="text-[14px] text-[#737373]">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#222224] rounded-2xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] dark:shadow-none">
            {sent ? (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/70 dark:border-emerald-800/40 text-[13px] text-emerald-700 dark:text-emerald-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                If an account exists for that email, a reset link is on its way. The link expires in 1 hour.
              </div>
            ) : (
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 mt-1 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[14px] font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-[13px] text-[#737373]">
            Remembered it?{" "}
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
