"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FaGithub } from "react-icons/fa6";

interface User {
  name: string;
  email: string;
  isAdmin?: boolean;
}

const NAV_LINKS = [
  { name: "Docs", href: "/docs" },
  { name: "Sandbox", href: "/sandbox" },
  { name: "About", href: "/about" },
  { name: "Agents", href: "/agents" },
  { name: "Security", href: "/nhi" },
  { name: "Audit Log", href: "/audit" },
  { name: "Policies", href: "/policies" },
];

const AUTH_ROUTES = ["/login", "/register"];

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null | "loading">("loading");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch current user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user ?? null))
      .catch(() => setUser(null));
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDropdownOpen(false);
    router.push("/");
    router.refresh();
  }

  // Home and auth pages manage their own nav/logo
  if (pathname === "/" || AUTH_ROUTES.includes(pathname)) return null;

  const initials = typeof user === "object" && user
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[5000] h-14 border-b border-[#E7E5E4] dark:border-[#27272A] bg-white/80 dark:bg-[#0B0B0C]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <LeluMark size={22} className="transition-transform group-hover:scale-105" />
            <span className="font-semibold text-[15px] text-[#0A0A0A] dark:text-white" style={{ letterSpacing: "-0.02em" }}>
              lelu
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[13px] font-medium transition-colors ${
                    active
                      ? "text-[#0A0A0A] dark:text-white"
                      : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right section */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://github.com/lelu-ai/lelu"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <FaGithub className="h-[18px] w-[18px]" />
            </a>

            {/* Auth: loading skeleton */}
            {user === "loading" && (
              <div className="w-8 h-8 rounded-full bg-[#F5F5F4] dark:bg-[#141416] animate-pulse" />
            )}

            {/* Auth: logged out */}
            {user === null && (
              <div className="hidden sm:flex items-center gap-2">
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
            )}

            {/* Auth: logged in — avatar dropdown */}
            {user !== null && user !== "loading" && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-1.5 group"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-[11px] font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    className={`text-[#737373] transition-transform hidden sm:block ${dropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[200px] bg-white dark:bg-[#111113] border border-[#E7E5E4] dark:border-[#27272A] rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[#E7E5E4] dark:border-[#27272A]">
                      <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white truncate">{user.name}</p>
                      <p className="text-[12px] text-[#737373] truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { label: "Dashboard", href: "/dashboard" },
                        ...(user.isAdmin ? [{ label: "Admin Analytics", href: "/admin" }] : []),
                        { label: "Agent Registry", href: "/agents" },
                        { label: "NHI Security", href: "/nhi" },
                        { label: "API Keys", href: "/api-key" },
                        { label: "Audit Log", href: "/audit" },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
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
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden flex items-center justify-center w-8 h-8 text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="fixed top-14 left-0 right-0 z-[4999] bg-white dark:bg-[#0B0B0C] border-b border-[#E7E5E4] dark:border-[#27272A] shadow-md md:hidden">
          <nav className="flex flex-col px-4 py-3 gap-0.5">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2.5 text-[14px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#141416] rounded-md transition-colors"
              >
                {item.name}
              </Link>
            ))}
            <div className="h-px bg-[#E7E5E4] dark:bg-[#27272A] my-2" />
            <a
              href="https://github.com/lelu-ai/lelu"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2.5 text-[14px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#141416] rounded-md transition-colors flex items-center gap-2"
            >
              <FaGithub className="h-4 w-4" /> GitHub
            </a>
            {user === null && (
              <>
                <Link href="/login" className="px-3 py-2.5 text-[14px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#141416] rounded-md transition-colors">
                  Sign in
                </Link>
                <Link href="/register" className="mx-3 mt-1 py-2.5 text-[14px] font-semibold bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded-md text-center hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}

      {/* Spacer so page content doesn't hide under fixed nav */}
      <div className="h-14" />
    </>
  );
}
