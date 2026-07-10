"use client";

import { usePathname } from "next/navigation";

const NAV_TABS = [
  { label: "README", href: "/", exact: true },
  { label: "DOCS", href: "/docs", exact: false },
  { label: "PRODUCTS", href: "#", chevron: true },
  { label: "ENTERPRISE", href: "#" },
  { label: "RESOURCES", href: "#", chevron: true },
] as const;

export function DocsNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-[4999] h-14 bg-white dark:bg-[#0A0B10] border-b border-[#E7E5E4] dark:border-[#27272A]">
      <div className="h-full flex items-stretch max-w-[1400px] mx-auto">
        {/* Left — sidebar zone; root layout's fixed logo appears here */}
        <div className="w-[240px] shrink-0 flex items-center px-6 border-r border-[#E7E5E4] dark:border-[#27272A]">
          <span className="text-[13px] font-bold tracking-[0.12em] text-[#0A0A0A] dark:text-white select-none">
            LELU.
          </span>
        </div>

        {/* Center — tab navigation */}
        <nav className="flex-1 flex items-stretch px-4">
          {NAV_TABS.map((tab) => {
            const active =
              tab.href !== "#" &&
              ("exact" in tab && tab.exact
                ? pathname === tab.href
                : pathname.startsWith(tab.href));
            return (
              <a
                key={tab.label}
                href={tab.href}
                className={[
                  "flex items-center gap-1 px-3 text-[11px] font-semibold tracking-[0.07em] border-b-[1.5px] -mb-px transition-colors",
                  active
                    ? "text-[#0A0A0A] dark:text-white border-[#0A0A0A] dark:border-white"
                    : "text-[#737373] hover:text-[#0A0A0A] dark:hover:text-white border-transparent",
                ].join(" ")}
              >
                {tab.label}
                {"chevron" in tab && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                )}
              </a>
            );
          })}
        </nav>

        {/* Right — CTA */}
        <div className="flex items-center px-6">
          <a
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold tracking-[0.05em] bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] rounded border border-[#0A0A0A] dark:border-white hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors whitespace-nowrap"
          >
            SIGN IN
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
