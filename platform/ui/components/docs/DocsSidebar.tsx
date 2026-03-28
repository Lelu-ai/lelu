"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NavItem = { 
  href: string; 
  label: string;
  icon?: React.ReactNode;
};

type NavSection = { 
  title: string; 
  items: NavItem[];
  icon?: React.ReactNode;
  defaultOpen?: boolean;
};

const sections: NavSection[] = [
  {
    title: "Get Started",
    defaultOpen: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    items: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/docker", label: "Docker Deployment" },
      { href: "/llms.txt", label: "LLMs.txt" },
    ],
  },
  {
    title: "Concepts",
    defaultOpen: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
        <path d="M12 2v10l8.66 5"/>
      </svg>
    ),
    items: [
      { href: "/docs/concepts/architecture", label: "Architecture" },
      { href: "/docs/concepts/api", label: "API" },
      { href: "/docs/concepts/client", label: "Client SDK" },
      { href: "/docs/concepts/cli", label: "CLI & MCP" },
      { href: "/docs/cli-commands", label: "CLI Commands" },
      { href: "/docs/concepts/skills", label: "Skills" },
    ],
  },
  {
    title: "Features",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    items: [
      { href: "/docs/confidence", label: "Confidence Scores" },
      { href: "/docs/human-in-loop", label: "Human-in-the-loop" },
      { href: "/docs/audit-trail", label: "Audit Trail" },
      { href: "/docs/sso", label: "SSO & Authentication" },
    ],
  },
  {
    title: "API Reference",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>
      </svg>
    ),
    items: [
      { href: "/docs/api-keys", label: "API Keys" },
      { href: "/docs/api/authorize", label: "/authorize" },
      { href: "/docs/api/queue", label: "/queue" },
      { href: "/docs/api/agent", label: "Agent SDK" },
    ],
  },
  {
    title: "Integrations",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
    items: [
      { href: "/docs/integrations/backend", label: "Backend" },
      { href: "/docs/integrations/nextjs", label: "Next.js" },
      { href: "/docs/integrations/react", label: "React / Frontend" },
      { href: "/docs/integrations/mobile", label: "Mobile" },
    ],
  },
  {
    title: "Databases",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
    items: [
      { href: "/docs/database", label: "Configuration" },
      { href: "/docs/databases/postgresql", label: "PostgreSQL" },
      { href: "/docs/databases/redis", label: "Redis" },
    ],
  },
  {
    title: "Plugins",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v6M12 18v4M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M18 12h4M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24"/>
      </svg>
    ),
    items: [
      { href: "/docs/plugins/confidence-plugin", label: "Confidence Score" },
      { href: "/docs/plugins/audit-plugin", label: "Audit Trail" },
      { href: "/docs/plugins/rate-limit", label: "Rate Limiting" },
    ],
  },
  {
    title: "Advanced Features",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    items: [
      { href: "/docs/observability", label: "Observability & Tracing" },
      { href: "/docs/behavioral-analytics", label: "Behavioral Analytics" },
      { href: "/docs/risk-assessment", label: "Risk Assessment" },
      { href: "/docs/multi-agent", label: "Multi-Agent Coordination" },
      { href: "/docs/prompt-injection", label: "Prompt Injection Detection" },
      { href: "/docs/predictive-analytics", label: "Predictive Analytics" },
    ],
  },
  {
    title: "Guides",
    defaultOpen: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
    items: [
      { href: "/docs/guides/production", label: "Production" },
      { href: "/docs/guides/testing", label: "Testing Policies" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((section) => {
      initial[section.title] = section.defaultOpen ?? false;
    });
    return initial;
  });

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const active = root.querySelector(".docs-sidebar-link.is-active") as HTMLAnchorElement | null;
    if (!active) return;
    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pathname]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <aside className="hidden md:block w-64 shrink-0 border-r border-zinc-200/80 dark:border-white/[0.06] bg-white dark:bg-[#09090B]">
      <div ref={scrollRef} className="docs-sidebar-scroll sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto overscroll-contain py-6 px-4 no-scrollbar">
        {/* Logo/Brand */}
        <div className="mb-6">
          <a href="/" className="flex items-center gap-2 font-semibold text-base text-zinc-900 dark:text-white hover:opacity-80 transition-opacity">
            <img src="/logo.svg" alt="Lelu" className="w-6 h-6 rounded" />
            Lelu
          </a>
        </div>

        {/* Search Bar */}
        <button className="w-full mb-6 flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/10 rounded-lg transition-colors group">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 dark:text-zinc-500">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-zinc-400 dark:text-zinc-500 bg-white dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded">
            ⌘K
          </kbd>
        </button>

        <nav className="space-y-4">
          {sections.map((section) => {
            const isOpen = openSections[section.title];
            
            return (
              <div key={section.title} className="flex flex-col">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="group flex items-center justify-between py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer w-full text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                      {section.icon}
                    </span>
                    {section.title}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-zinc-400 dark:text-zinc-500 transition-transform duration-200 ${isOpen ? "rotate-90" : "rotate-0"}`}
                  >
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="flex flex-col space-y-0.5 mt-2 overflow-hidden"
                    >
                      {section.items.map((item) => {
                        const active = pathname === item.href;
                        return (
                          <li key={item.href}>
                            <a
                              href={item.href}
                              className={[
                                "docs-sidebar-link relative flex items-center py-1.5 px-2.5 rounded-md text-sm transition-all duration-150",
                                active
                                  ? "is-active text-zinc-900 dark:text-white bg-zinc-100 dark:bg-white/10 font-medium"
                                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-white/5",
                              ].join(" ")}
                            >
                              {active && (
                                <motion.div 
                                  layoutId="active-indicator"
                                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-900 dark:bg-white rounded-r-full -ml-4" 
                                />
                              )}
                              {item.label}
                            </a>
                          </li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
