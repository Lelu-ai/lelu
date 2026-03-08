import { DocsEnhancements } from "@/components/docs/DocsEnhancements";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="docs-page flex min-h-[calc(100vh-73px)] max-w-screen-2xl mx-auto bg-white dark:bg-[#09090B]">
      <DocsSidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 py-12 px-6 md:px-16 lg:px-24">
        <div className="max-w-4xl mx-auto prose prose-zinc dark:prose-invert prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:bg-[#0d0d12] prose-pre:border prose-pre:border-zinc-800/80 prose-pre:shadow-xl dark:prose-code:bg-indigo-500/10 dark:prose-code:text-indigo-300 dark:prose-code:px-1.5 dark:prose-code:py-0.5 dark:prose-code:rounded-md dark:prose-code:before:content-none dark:prose-code:after:content-none">
          {children}
        </div>
      </main>

      <DocsEnhancements />
    </div>
  );
}