"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import { codeSnippets } from "@/data";
import { SiTypescript, SiPython } from "react-icons/si";
import { FiCopy, FiCheck, FiTerminal } from "react-icons/fi";

type Lang = keyof typeof codeSnippets;

const langs: { id: Lang; label: string; icon: React.ReactNode }[] = [
  { id: "ts", label: "TypeScript", icon: <SiTypescript className="w-3.5 h-3.5 text-[#3178c6]" /> },
  { id: "py", label: "Python", icon: <SiPython className="w-3.5 h-3.5 text-[#ffe873]" /> },
  { id: "curl", label: "cURL", icon: <FiTerminal className="w-3.5 h-3.5 text-zinc-400" /> },
];

const CodeShowcase = () => {
  const [activeLang, setActiveLang] = useState<Lang>("ts");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="w-full py-24 md:py-32 border-t border-[#E7E5E4] dark:border-[#222224]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — marketing copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-3">
              Code first
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0A0A0A] dark:text-white mb-4">
              Authorize every agent action in code.
            </h2>
            <p className="text-[15px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
              No dashboard clicks. Your policies live in code — version controlled, type-safe, and
              reviewable in PRs.
            </p>
            <ul className="space-y-3">
              {[
                "Single SDK call replaces hand-rolled guard logic",
                "Policy violations logged automatically with trace IDs",
                "Human review queue built-in — no extra infra",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-zinc-500 dark:text-zinc-400"
                >
                  <span className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-lelu-amber/15 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-lelu-amber" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Right — code block */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="rounded-xl border border-[#E7E5E4] dark:border-[#222224] overflow-hidden"
          >
            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#1A1A1C] border-b border-[#E7E5E4] dark:border-[#222224]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E7E5E4] dark:bg-[#333335]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E7E5E4] dark:bg-[#333335]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#E7E5E4] dark:bg-[#333335]" />
              </div>
              <span className="text-xs font-mono text-zinc-400">agent.ts</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                {copied ? (
                  <FiCheck className="w-3.5 h-3.5 text-[#6B9E7A]" />
                ) : (
                  <FiCopy className="w-3.5 h-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* Language tabs */}
            <div className="flex border-b border-[#E7E5E4] dark:border-[#222224] overflow-x-auto scrollbar-hide bg-[#F5F5F4] dark:bg-[#141416]">
              {langs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLang(l.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeLang === l.id
                      ? "text-[#0A0A0A] dark:text-white border-lelu-amber"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 border-transparent"
                  }`}
                >
                  {l.icon}
                  {l.label}
                </button>
              ))}
            </div>

            {/* Code content */}
            <pre className="p-5 text-[12.5px] leading-relaxed font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto scrollbar-hide max-h-[340px] bg-[#F5F5F4] dark:bg-[#0B0B0C]">
              <code>{codeSnippets[activeLang]}</code>
            </pre>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default CodeShowcase;
