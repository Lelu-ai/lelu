"use client";

import React from "react";
import Link from "next/link";
import { FaLocationArrow, FaGithub } from "react-icons/fa6";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import MagicButton from "./ui/MagicButton";

const LeluFooter = ({ showCTA: manualShowCTA }: { showCTA?: boolean }) => {
  const pathname = usePathname();

  // Show CTA automatically only on the landing page,
  // unless explicitly overridden by prop
  const showCTA = manualShowCTA ?? pathname === "/";
  return (
    <footer
      className={cn(
        "w-full pb-10 relative overflow-hidden bg-white dark:bg-black-100",
        showCTA ? "pt-32" : "pt-0",
      )}
      id="contact"
    >
      {/* Background Ambient Glow — matches the hero/about page glow pattern */}
      <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-20 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-[#3b82f6]/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] rounded-full bg-[#CBACF9]/20 blur-[120px]" />
      </div>

      {/* CTA SECTION */}
      {showCTA && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center text-center relative z-10 px-4"
        >
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-zinc-900 dark:text-white">
            Ready to secure your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#CBACF9] to-[#393BB2]">
              AI agents?
            </span>
          </h2>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Install Lelu in minutes and start building AI applications with confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center w-full sm:w-auto">
            <Link href="/docs/quickstart">
              <MagicButton title="Get Started" icon={<FaLocationArrow />} position="right" />
            </Link>
            {/* GitHub button uses same glassmorphism pattern as the navbar */}
            <a
              href="https://github.com/lelu-auth/lelu"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-md px-8 py-4 text-sm font-bold text-zinc-900 dark:text-white transition-all hover:bg-zinc-100/80 dark:hover:bg-white/10 shadow-sm hover:shadow-md"
            >
              <FaGithub className="w-5 h-5 mr-2" />
              View on GitHub
            </a>
          </div>
        </motion.div>
      )}

      {/* FOOTER BOTTOM SECTION — border uses same token as navbar: border-black/5 dark:border-white/10 */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className={cn(
          "w-full border-t border-black/5 dark:border-white/10 pt-10 flex flex-col md:flex-row justify-between items-center relative z-10 gap-8 px-4",
          showCTA ? "mt-32" : "mt-12",
        )}
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt="Lelu logo"
              className="w-8 h-8 rounded-lg transition-transform duration-500 group-hover:scale-110"
            />
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-white">
              Lelu Engine
            </span>
          </Link>
          {/* Divider uses same token as navbar */}
          <p className="md:border-l md:border-black/10 dark:md:border-white/10 md:pl-6 text-zinc-500 dark:text-neutral-400 text-sm">
            Copyright © {new Date().getFullYear()} Lelu Security.
          </p>
        </div>

        {/* Nav links use same text scale as the floating navbar: text-zinc-600 dark:text-neutral-300 */}
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-zinc-600 dark:text-neutral-300">
          <li>
            <Link href="/about" className="hover:text-[#CBACF9] transition-colors">
              About
            </Link>
          </li>
          <li>
            <Link href="/docs" className="hover:text-[#CBACF9] transition-colors">
              Documentation
            </Link>
          </li>
          <li>
            <a
              href="https://github.com/lelu"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#CBACF9] transition-colors"
            >
              GitHub
            </a>
          </li>
          <li>
            <a
              href="https://twitter.com/lelusecurity"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#CBACF9] transition-colors"
            >
              X (Twitter)
            </a>
          </li>
          <li>
            <a
              href="https://discord.gg/lelu"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#CBACF9] transition-colors"
            >
              Discord
            </a>
          </li>
          <li>
            <a
              href="https://linkedin.com/company/lelusecurity"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#CBACF9] transition-colors"
            >
              LinkedIn
            </a>
          </li>
        </ul>
      </motion.div>
    </footer>
  );
};

export default LeluFooter;
