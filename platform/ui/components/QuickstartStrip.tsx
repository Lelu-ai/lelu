"use client";
import { motion } from "framer-motion";

const steps = [
  { cmd: "npm install lelu-agent-auth", label: "Install" },
  { cmd: "npx lelu init", label: "Configure" },
  { cmd: "lelu.agentAuthorize({ agentId, action })", label: "Enforce" },
];

const QuickstartStrip = () => (
  <section className="w-full py-20 border-t border-[#E7E5E4] dark:border-[#20222B]">
    <div className="max-w-6xl mx-auto px-4">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-8 text-center"
      >
        Get running in 3 steps
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="rounded-lg border border-[#E7E5E4] dark:border-[#20222B] bg-[#F5F5F4] dark:bg-[#0D0E13] p-4"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] font-mono text-zinc-300 dark:text-zinc-600">
                0{i + 1}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{s.label}</span>
            </div>
            <pre className="font-mono text-[12px] text-zinc-700 dark:text-zinc-300 overflow-x-auto scrollbar-hide">
              <code>
                <span className="text-lelu-amber select-none">$ </span>
                {s.cmd}
              </code>
            </pre>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export default QuickstartStrip;
