import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteNav } from "@/components/SiteNav";
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
    icon: [
      { url: "/lelu-mark.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <body className="bg-[#FAFAFA] dark:bg-[#0B0B0C] text-[#0A0A0A] dark:text-zinc-100 font-sans min-h-screen selection:bg-black/10 dark:selection:bg-white/20 flex flex-col transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteNav />
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
