import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: {
    default: "Lelu Engine",
    template: "%s | Lelu Engine",
  },
  description: "Confidence-Aware Auth audit trail",
  applicationName: "Lelu Engine",
  icons: {
    icon: "/lelu-mark.svg",
    shortcut: "/lelu-mark.svg",
    apple: "/lelu-mark.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans min-h-screen selection:bg-black/10 dark:selection:bg-white/30 flex flex-col transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/60 dark:bg-black/60 backdrop-blur-xl border-b border-zinc-200 dark:border-white/[0.08] transition-colors duration-300">
            <a href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight hover:opacity-80 transition-opacity text-black dark:text-white">
              <img src="/lelu-mark.svg" alt="Lelu logo" className="w-6 h-6 rounded-md" />
              Lelu Engine
            </a>
            <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              <a href="/docs" className="hover:text-black dark:hover:text-white transition-colors">Docs</a>
              <a href="/audit" className="hover:text-black dark:hover:text-white transition-colors">Audit Log</a>
              <a href="/policies" className="hover:text-black dark:hover:text-white transition-colors">Policies</a>
              <a href="/policies/safety" className="hover:text-black dark:hover:text-white transition-colors">Safety</a>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 transition-colors duration-300"></div>
              <ThemeToggle />
              <a href="https://github.com/lelu-auth/lelu" target="_blank" rel="noreferrer" className="hidden sm:flex hover:text-black dark:hover:text-white transition-colors items-center gap-2 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
                Star on GitHub
              </a>
            </div>
          </nav>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-zinc-200 dark:border-white/[0.08] py-12 mt-20 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-zinc-800 dark:text-zinc-300">
                <img src="/lelu-mark.svg" alt="Lelu logo" className="w-5 h-5 rounded" />
                Lelu Engine
              </div>
              <div className="flex gap-6 text-sm text-zinc-500">
                <a href="/docs" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Documentation</a>
                <a href="https://github.com/lelu-auth/lelu" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">GitHub</a>
                <a href="#" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors">Twitter</a>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
