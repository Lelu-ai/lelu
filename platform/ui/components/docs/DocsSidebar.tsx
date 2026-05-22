"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

type NavItem = { href: string; label: string };
type NavSection = {
  title: string;
  items: NavItem[];
  icon: React.ReactNode;
  defaultOpen?: boolean;
};

function Ico({ d }: { d: string | string[] }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

const sections: NavSection[] = [
  {
    title: "Get Started",
    defaultOpen: true,
    icon: <Ico d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
    items: [
      { href: "/docs", label: "Introduction" },
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/quickstart", label: "Quickstart" },
    ],
  },
  {
    title: "Concepts",
    defaultOpen: false,
    icon: <Ico d={["M12 2a10 10 0 1 0 10 10H12V2z", "M12 2v10l8.66 5"]} />,
    items: [
      { href: "/docs/concepts/actors", label: "Actors" },
      { href: "/docs/concepts/actions", label: "Actions" },
      { href: "/docs/concepts/resources", label: "Resources" },
      { href: "/docs/concepts/policies", label: "Policies" },
      { href: "/docs/concepts/decisions", label: "Decisions" },
    ],
  },
  {
    title: "Authorization",
    defaultOpen: false,
    icon: <Ico d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    items: [
      { href: "/docs/concepts/api", label: "Agent Authorize" },
      { href: "/docs/confidence", label: "Confidence Gating" },
      { href: "/docs/concepts/delegation", label: "Delegation" },
    ],
  },
  {
    title: "Policies",
    defaultOpen: false,
    icon: (
      <Ico
        d={[
          "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
          "M14 2v6h6",
          "M16 13H8",
          "M16 17H8",
          "M10 9H8",
        ]}
      />
    ),
    items: [
      { href: "/docs/policies/rego", label: "Writing Rego" },
      { href: "/docs/guides/testing", label: "Testing" },
      { href: "/docs/policies/versioning", label: "Versioning" },
    ],
  },
  {
    title: "Human Review",
    defaultOpen: false,
    icon: (
      <Ico
        d={[
          "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
          "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
          "M23 21v-2a4 4 0 0 0-3-3.87",
          "M16 3.13a4 4 0 0 1 0 7.75",
        ]}
      />
    ),
    items: [
      { href: "/docs/human-in-loop", label: "Routing" },
      { href: "/docs/approvals", label: "Approvals" },
      { href: "/docs/slas", label: "SLAs" },
    ],
  },
  {
    title: "Audit",
    defaultOpen: false,
    icon: <Ico d={["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"]} />,
    items: [
      { href: "/docs/audit-trail", label: "Event Schema" },
      { href: "/docs/audit-query", label: "Query API" },
      { href: "/docs/audit-siem", label: "SIEM Export" },
    ],
  },
  {
    title: "Integrations",
    defaultOpen: false,
    icon: (
      <Ico
        d={[
          "M12 2v6",
          "M12 18v4",
          "M4.93 4.93l4.24 4.24",
          "M14.83 14.83l4.24 4.24",
          "M2 12h6",
          "M18 12h4",
          "M4.93 19.07l4.24-4.24",
          "M14.83 9.17l4.24-4.24",
        ]}
      />
    ),
    items: [
      { href: "/docs/integrations/openai", label: "OpenAI" },
      { href: "/docs/integrations/anthropic", label: "Anthropic" },
      { href: "/docs/integrations/langchain", label: "LangChain" },
      { href: "/docs/integrations/langgraph", label: "LangGraph" },
      { href: "/docs/integrations/mcp", label: "MCP" },
      { href: "/docs/integrations/vercel-ai", label: "Vercel AI SDK" },
    ],
  },
  {
    title: "Infrastructure",
    defaultOpen: false,
    icon: (
      <Ico
        d={[
          "M22 12H2",
          "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
        ]}
      />
    ),
    items: [
      { href: "/docs/guides/production", label: "Self-Hosting" },
      { href: "/docs/docker", label: "Cloud" },
      { href: "/docs/scaling", label: "Scaling" },
    ],
  },
  {
    title: "SDKs",
    defaultOpen: false,
    icon: <Ico d={["M16 18l6-6-6-6", "M8 6l-6 6 6 6"]} />,
    items: [
      { href: "/docs/integrations/nextjs", label: "TypeScript" },
      { href: "/docs/integrations/backend", label: "Python" },
      { href: "/docs/integrations/go", label: "Go" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    sections.forEach((s) => {
      init[s.title] = s.defaultOpen ?? false;
    });
    return init;
  });

  // Auto-open the section that contains the active page
  useEffect(() => {
    sections.forEach((section) => {
      if (section.items.some((item) => pathname === item.href)) {
        setOpenSections((prev) => ({ ...prev, [section.title]: true }));
      }
    });
  }, [pathname]);

  // Scroll active item into view
  useEffect(() => {
    const active = scrollRef.current?.querySelector(".is-active") as HTMLElement | null;
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pathname]);

  const toggleSection = (title: string) => {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const isDark = resolvedTheme === "dark";

  return (
    <aside className="hidden md:flex flex-col w-[240px] shrink-0 sticky top-14 h-[calc(100vh-56px)] border-r border-[#E7E5E4] dark:border-[#27272A] bg-white dark:bg-[#0B0B0C]">
      {/* Scrollable nav area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain no-scrollbar py-5 px-3"
      >
        {/* Version selector */}
        <button className="w-full mb-3 flex items-center gap-2 px-3 py-2 text-xs border border-[#E7E5E4] dark:border-[#27272A] rounded-md bg-white dark:bg-[#0B0B0C] hover:bg-[#F5F5F4] dark:hover:bg-[#141416] transition-colors text-left">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#737373] shrink-0"
          >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <span className="flex-1 font-medium text-[#0A0A0A] dark:text-white">v1.0</span>
          <span className="text-[10px] text-[#737373] border border-[#E7E5E4] dark:border-[#27272A] px-1.5 py-0.5 rounded">
            Latest
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-[#737373]"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Search */}
        <button className="w-full mb-5 flex items-center gap-2 px-3 py-2 text-xs text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white bg-[#F5F5F4] dark:bg-[#141416] border border-[#E7E5E4] dark:border-[#27272A] rounded-md transition-colors">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="flex-1 text-left">Search...</span>
          <kbd className="flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#737373] bg-white dark:bg-[#0B0B0C] border border-[#E7E5E4] dark:border-[#27272A] rounded">
            ⌘K
          </kbd>
        </button>

        {/* Navigation sections */}
        <nav className="space-y-0.5">
          {sections.map((section) => {
            const isOpen = openSections[section.title];
            const hasActive = section.items.some((item) => pathname === item.href);

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className={[
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em] uppercase rounded-md transition-colors group",
                    hasActive || isOpen
                      ? "text-[#0A0A0A] dark:text-white"
                      : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white",
                  ].join(" ")}
                >
                  <span className="text-[#737373] group-hover:text-[#0A0A0A] dark:group-hover:text-white transition-colors shrink-0">
                    {section.icon}
                  </span>
                  <span className="flex-1 text-left">{section.title}</span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-[#737373] transition-transform duration-200 shrink-0 ${isOpen ? "rotate-90" : ""}`}
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden mt-0.5 mb-1"
                    >
                      {section.items.map((item) => {
                        const active = pathname === item.href;
                        return (
                          <li key={item.href + item.label}>
                            <a
                              href={item.href}
                              className={[
                                "flex items-center py-1.5 pl-8 pr-3 -mx-3 text-[13px] transition-colors",
                                active
                                  ? "is-active bg-[#F5F5F4] dark:bg-[#141416] text-[#0A0A0A] dark:text-white font-medium"
                                  : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white hover:bg-[#F5F5F4] dark:hover:bg-[#141416]",
                              ].join(" ")}
                            >
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

      {/* Bottom bar: GitHub + theme toggle */}
      <div className="px-4 py-3 border-t border-[#E7E5E4] dark:border-[#27272A] flex items-center gap-3">
        <a
          href="https://github.com/lelu-auth/lelu"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
          aria-label="GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
          aria-label="Toggle theme"
        >
          {/* Sun — shown in light mode */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dark:hidden"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          {/* Moon — shown in dark mode */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden dark:block"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
