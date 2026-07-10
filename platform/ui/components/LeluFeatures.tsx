"use client";
import { motion } from "framer-motion";
import { numberedFeatures } from "@/data";

const chipClass: Record<string, string> = {
  allow:
    "bg-[#6B9E7A]/10 text-[#6B9E7A] border border-[#6B9E7A]/20 dark:bg-[#6B9E7A]/10 dark:text-[#8FC99E] dark:border-[#6B9E7A]/25",
  review:
    "bg-[#E8B339]/10 text-[#C49A30] border border-[#E8B339]/20 dark:bg-[#E8B339]/10 dark:text-[#E8B339] dark:border-[#E8B339]/25",
  neutral:
    "bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-white/[0.05] dark:text-zinc-400 dark:border-white/10",
};

const LeluFeatures = () => {
  return (
    <section className="w-full py-24 md:py-32" id="features">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0A0A0A] dark:text-white">
            Every agent action, accounted for.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E7E5E4] dark:bg-[#222224] rounded-xl overflow-hidden border border-[#E7E5E4] dark:border-[#222224]">
          {numberedFeatures.map((feat, i) => (
            <motion.div
              key={feat.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="group relative bg-[#FAFAFA] dark:bg-[#0A0B10] p-6 flex flex-col gap-4 hover:bg-[#F5F5F4] dark:hover:bg-[#0D0E13] transition-colors duration-200"
            >
              <span className="text-xs font-mono text-zinc-300 dark:text-zinc-600 tracking-widest">
                {feat.num}
              </span>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white leading-snug">
                  {feat.title}
                </h3>
                <span
                  className={`flex-shrink-0 text-[11px] font-mono px-2 py-0.5 rounded-md ${chipClass[feat.chipColor]}`}
                >
                  {feat.chip}
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {feat.desc}
              </p>
              <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-lelu-amber group-hover:w-full transition-all duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LeluFeatures;
