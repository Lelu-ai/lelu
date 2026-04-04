import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { FloatingNav } from "@/components/ui/FloatingNavbar";
import { navItems } from "@/data";
import LeluFooter from "@/components/LeluFooter";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "Lelu - Authorization Engine for AI Agents",
    template: "%s | Lelu",
  },
  description:
    "Authorization and security platform for AI agents. Control what your agents can do with confidence-aware gating, human oversight, and complete audit trails.",
  applicationName: "Lelu",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className="bg-white dark:bg-black-100 text-zinc-900 dark:text-zinc-100 font-sans min-h-screen selection:bg-black/10 dark:selection:bg-white/30 flex flex-col transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="fixed top-8 left-6 md:left-10 z-[5001] pointer-events-none">
            <a href="/" className="pointer-events-auto flex items-center gap-3 group">
              <div className="transition-all duration-300">
                <img
                  src="/logo.png"
                  alt="Lelu logo"
                  className="w-8 h-8 rounded-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[360deg] shadow-lg shadow-black/5 dark:shadow-white/5"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl tracking-tighter text-black dark:text-white transition-all duration-300 group-hover:tracking-normal">
                  Lelu
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-1 group-hover:translate-y-0">
                  Engine
                </span>
              </div>
            </a>
          </div>
          <FloatingNav navItems={navItems} />
          <main className="flex-1">{children}</main>
          <div className="flex flex-col items-center w-full px-5 sm:px-10">
            <div className="max-w-7xl w-full">
              <LeluFooter />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
