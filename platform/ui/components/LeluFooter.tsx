"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { FaGithub } from "react-icons/fa6";
import { LeluMark } from "@/components/ui/LeluMark";

const LeluFooter = ({ showCTA: manualShowCTA }: { showCTA?: boolean }) => {
  const pathname = usePathname();
  const showCTA = manualShowCTA ?? pathname === "/";

  return (
    <footer className="w-full border-t border-[#E7E5E4] dark:border-[#222224]" id="contact">
      {/* Final CTA */}
      {showCTA && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col items-center text-center py-24 px-4"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#0A0A0A] dark:text-white mb-4 lowercase">
            ship agents you can defend in a post-mortem.
          </h2>
          <p className="text-[15px] text-zinc-500 dark:text-zinc-400 mb-10 max-w-md">
            Gate every action. Route the risky ones to humans. Audit everything.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started →
            </Link>
            <a
              href="https://github.com/lelu-auth/lelu"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#E7E5E4] dark:border-[#222224] bg-transparent text-[#0A0A0A] dark:text-white px-6 py-2.5 text-sm font-medium hover:bg-[#F5F5F4] dark:hover:bg-[#141416] transition-colors"
            >
              <FaGithub className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </motion.div>
      )}

      {/* Bottom bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 px-4">
        <div className="flex items-center gap-2">
          <LeluMark size={20} />
          <span className="text-sm font-semibold text-[#0A0A0A] dark:text-white" style={{ letterSpacing: "-0.02em" }}>lelu</span>
          <span className="text-sm text-zinc-400 dark:text-zinc-500 ml-2">
            © {new Date().getFullYear()} Lelu Security
          </span>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-zinc-500 dark:text-zinc-400">
          {[
            { label: "Docs", href: "/docs" },
            { label: "Audit Log", href: "/audit" },
            { label: "Policies", href: "/policies" },
            { label: "About", href: "/about" },
            { label: "GitHub", href: "https://github.com/lelu-auth/lelu", external: true },
          ].map((l) => (
            <li key={l.label}>
              {l.external ? (
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  href={l.href}
                  className="hover:text-[#0A0A0A] dark:hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
};

export default LeluFooter;
