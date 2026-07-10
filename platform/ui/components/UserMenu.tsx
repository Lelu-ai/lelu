"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface User {
  name: string;
  email: string;
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | "loading">("loading");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  if (pathname === "/login" || pathname === "/register") return null;

  if (user === "loading") return <div className="w-8 h-8 rounded-full bg-[#F5F5F4] dark:bg-[#0D0E13] animate-pulse" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1.5 text-[13px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="px-3 py-1.5 text-[13px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
        >
          Get started
        </Link>
      </div>
    );
  }

  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 group"
        aria-label="User menu"
      >
        <div className="w-8 h-8 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[12px] font-bold flex items-center justify-center ring-2 ring-[#E7E5E4] dark:ring-[#27272A] group-hover:ring-[#0A0A0A] dark:group-hover:ring-white transition-all">
          {initials}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[#737373] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[200px] bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#27272A] rounded-lg shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-[#E7E5E4] dark:border-[#27272A]">
            <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white truncate">{user.name}</p>
            <p className="text-[12px] text-[#737373] truncate">{user.email}</p>
          </div>
          <div className="py-1">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "API Keys", href: "/api-key" },
              { label: "Audit Log", href: "/audit" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] hover:bg-[#F5F5F4] dark:hover:bg-[#1A1A1C] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-[#E7E5E4] dark:border-[#27272A] py-1">
            <button
              onClick={logout}
              className="w-full text-left px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-[#F5F5F4] dark:hover:bg-[#1A1A1C] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
