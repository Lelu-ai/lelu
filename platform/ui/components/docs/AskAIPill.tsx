"use client";

export function AskAIPill() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#27272A] rounded-full shadow-md hover:shadow-lg transition-shadow text-sm font-medium text-[#0A0A0A] dark:text-white">
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Ask AI
        <kbd className="flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#737373] bg-[#F5F5F4] dark:bg-[#27272A] border border-[#E7E5E4] dark:border-[#27272A] rounded">
          ⌘I
        </kbd>
      </button>
    </div>
  );
}
