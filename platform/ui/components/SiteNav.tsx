"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LeluMark } from "@/components/ui/LeluMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FaGithub } from "react-icons/fa6";
import {
  Menu,
  X,
  BookOpen,
  Tag,
  Box,
  Info,
  Bot,
  ShieldCheck,
  Activity,
  Lock,
  LayoutDashboard,
  Sparkles,
  Key,
  LogOut,
  ChevronRight,
  User as UserIcon,
  FileText,
} from "lucide-react";

interface User {
  name: string;
  email: string;
  isAdmin?: boolean;
}

interface NavLinkItem {
  name: string;
  href: string;
  icon: any;
  external?: boolean;
}

const NAV_LINKS: NavLinkItem[] = [
  { name: "Docs", href: "/docs", icon: BookOpen },
  { name: "Pricing", href: "/pricing", icon: Tag },
  { name: "Sandbox", href: "/sandbox", icon: Box },
  { name: "About", href: "/about", icon: Info },
  { name: "GitHub", href: "https://github.com/lelu-ai/lelu", icon: FaGithub, external: true },
  { name: "Agents", href: "/agents", icon: Bot },
  { name: "Security", href: "/nhi", icon: ShieldCheck },
  { name: "Audit Log", href: "/audit", icon: Activity },
  { name: "Policies", href: "/policies", icon: Lock },
  { name: "Terms", href: "/terms", icon: FileText },
  { name: "Privacy", href: "/privacy", icon: ShieldCheck },
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
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent scroll when mobile Sidenav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDropdownOpen(false);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  // Auth pages and standalone demo manage their own nav/logo
  if (pathname === "/demo" || AUTH_ROUTES.includes(pathname)) return null;

  const initials =
    typeof user === "object" && user
      ? user.name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[5000] h-14 border-b border-[#E7E5E4] dark:border-[#20222B] bg-white/80 dark:bg-[#0A0B10]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <LeluMark size={22} className="transition-transform group-hover:scale-105" />
            <span
              className="font-semibold text-[15px] text-[#0A0A0A] dark:text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              lelu
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-5">
            {NAV_LINKS.map((item) => {
              if (item.external) {
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                );
              }
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[13px] font-medium transition-colors ${
                    active
                      ? "text-[#0A0A0A] dark:text-white font-semibold"
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
              <div className="w-8 h-8 rounded-full bg-[#F5F5F4] dark:bg-[#0D0E13] animate-pulse" />
            )}

            {user === null && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="hidden sm:block px-3 py-1.5 text-[13px] font-medium text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/docs/quickstart"
                  className="px-3.5 py-1.5 text-[12px] sm:text-[13px] font-semibold bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white rounded-md hover:opacity-90 transition-opacity whitespace-nowrap shadow-sm"
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
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-[#737373] transition-transform hidden sm:block ${
                      dropdownOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[200px] bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-lg shadow-lg overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-[#E7E5E4] dark:border-[#20222B]">
                      <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white truncate">
                        {user.name}
                      </p>
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
                          className="block px-4 py-2 text-[13px] text-[#0A0A0A] dark:text-[#E4E4E7] hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-[#E7E5E4] dark:border-[#20222B] py-1">
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-[13px] text-red-600 dark:text-red-400 hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sidenav trigger button (accessible on desktop & mobile) */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border border-[#E7E5E4] dark:border-[#20222B] bg-white dark:bg-[#0D0E13] text-[#0A0A0A] dark:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors text-[13px] font-medium"
              aria-label="Open Sidenav"
            >
              <Menu className="w-4 h-4 text-[#737373] dark:text-[#8B8D98]" />
              <span className="hidden sm:inline font-mono text-[12px]">Menu</span>
            </button>
          </div>
        </div>
      </header>

      {/* Off-Canvas Sidenav Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-sm"
            />

            {/* Sidenav Drawer Panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="fixed top-0 left-0 bottom-0 z-[6001] w-[300px] max-w-[85vw] bg-white dark:bg-[#0A0B10] border-r border-[#E7E5E4] dark:border-[#20222B] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Sidenav Drawer Header */}
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#E7E5E4] dark:border-[#20222B] shrink-0 bg-white/50 dark:bg-[#0A0B10]/50 backdrop-blur-md">
                <Link
                  href="/"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 group"
                >
                  <LeluMark size={24} className="transition-transform group-hover:scale-105" />
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-base text-[#0A0A0A] dark:text-white tracking-tight">
                      lelu
                    </span>
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F5F5F4] dark:bg-[#1A1C24] text-[#737373] border border-[#E7E5E4] dark:border-[#20222B]">
                      v1.0
                    </span>
                  </div>
                </Link>

                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#1A1C24] transition-colors"
                  aria-label="Close Sidenav"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sidenav Drawer Body */}
              <div className="flex-1 overflow-y-auto py-5 px-4 space-y-6">
                {/* Navigation Section */}
                <div>
                  <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[#737373] uppercase">
                    Navigation
                  </div>
                  <nav className="space-y-1">
                    {NAV_LINKS.map((item) => {
                      const Icon = item.icon;
                      if (item.external) {
                        return (
                          <a
                            key={item.name}
                            href={item.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium text-[#737373] dark:text-zinc-400 hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-4 h-4 text-[#737373]" />
                              <span>{item.name}</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 opacity-60 text-[#737373]" />
                          </a>
                        );
                      }
                      const active =
                        pathname === item.href || pathname.startsWith(item.href + "/");

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                            active
                              ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-[#0A0A0A] font-semibold shadow-sm"
                              : "text-[#737373] dark:text-zinc-400 hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#12141A]"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${active ? "text-white dark:text-[#0A0A0A]" : "text-[#737373]"}`} />
                            <span>{item.name}</span>
                          </div>
                          <ChevronRight
                            className={`w-3.5 h-3.5 opacity-60 ${
                              active ? "text-white dark:text-[#0A0A0A]" : "text-[#737373]"
                            }`}
                          />
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#E7E5E4] dark:bg-[#20222B]" />

                {/* Account / User Section */}
                <div>
                  <div className="px-3 mb-2 text-[10px] font-bold tracking-wider text-[#737373] uppercase">
                    Account & Access
                  </div>

                  {user === "loading" && (
                    <div className="px-3 py-3 rounded-lg bg-[#F5F5F4] dark:bg-[#12141A] animate-pulse h-12" />
                  )}

                  {user === null && (
                    <div className="space-y-2 pt-1">
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-medium text-[#0A0A0A] dark:text-white border border-[#E7E5E4] dark:border-[#20222B] rounded-lg hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
                      >
                        <UserIcon className="w-4 h-4 text-[#737373]" />
                        <span>Sign in</span>
                      </Link>
                      <Link
                        href="/docs/quickstart"
                        onClick={() => setMobileOpen(false)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <span>Get started</span>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  )}

                  {user !== null && user !== "loading" && (
                    <div className="space-y-3">
                      {/* User Info Header Box */}
                      <div className="p-3 rounded-xl bg-[#F5F5F4] dark:bg-[#12141A] border border-[#E7E5E4] dark:border-[#20222B] flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white truncate">
                            {user.name}
                          </p>
                          <p className="text-[11px] text-[#737373] truncate">{user.email}</p>
                        </div>
                        {user.isAdmin && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                            Admin
                          </span>
                        )}
                      </div>

                      {/* Quick links list */}
                      <div className="space-y-1">
                        {[
                          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                          ...(user.isAdmin
                            ? [{ label: "Admin Analytics", href: "/admin", icon: Sparkles }]
                            : []),
                          { label: "Agent Registry", href: "/agents", icon: Bot },
                          { label: "NHI Security", href: "/nhi", icon: ShieldCheck },
                          { label: "API Keys", href: "/api-key", icon: Key },
                          { label: "Audit Log", href: "/audit", icon: Activity },
                        ].map((item) => {
                          const LinkIcon = item.icon;
                          const active = pathname === item.href;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                                active
                                  ? "bg-[#E7E5E4]/50 dark:bg-[#20222B]/70 text-[#0A0A0A] dark:text-white"
                                  : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#12141A]"
                              }`}
                            >
                              <LinkIcon className="w-4 h-4 text-[#737373]" />
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}

                        <button
                          onClick={logout}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors mt-2"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidenav Drawer Footer */}
              <div className="p-4 border-t border-[#E7E5E4] dark:border-[#20222B] bg-[#FAFAFA] dark:bg-[#07080C] shrink-0 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[#737373]">Appearance</span>
                  <ThemeToggle />
                </div>

                <a
                  href="https://github.com/lelu-ai/lelu"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg border border-[#E7E5E4] dark:border-[#20222B] text-[12px] font-semibold text-[#0A0A0A] dark:text-white hover:bg-white dark:hover:bg-[#12141A] transition-colors"
                >
                  <FaGithub className="w-4 h-4" />
                  <span>GitHub Repository</span>
                </a>

                <div className="flex items-center justify-between text-[10px] text-[#737373] pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Engine Operational
                  </span>
                  <span>Lelu AI © 2026</span>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Spacer so page content doesn't hide under fixed nav */}
      <div className="h-14" />
    </>
  );
}

