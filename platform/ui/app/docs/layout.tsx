import { DocsEnhancements } from "@/components/docs/DocsEnhancements";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { OnThisPage } from "@/components/docs/OnThisPage";
import { DocsNav } from "@/components/docs/DocsNav";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0B0C]">
      <DocsNav />
      <div className="docs-page flex max-w-[1400px] mx-auto w-full">
        <DocsSidebar />

        {/* Main content */}
        <main className="flex-1 min-w-0 py-10 px-10 lg:px-14">
          <div className="max-w-[720px]">{children}</div>
        </main>

        <OnThisPage />
        <DocsEnhancements />
      </div>
    </div>
  );
}
