"use client";
import { motion } from "framer-motion";
import { marqueeRow1, marqueeRow2 } from "@/data";

const Pill = ({ label }: { label: string }) => (
  <span className="inline-flex items-center px-3.5 py-1.5 rounded-full border border-[#E7E5E4] dark:border-[#222224] bg-white dark:bg-[#0D0E13] text-[13px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap select-none mx-1.5">
    {label}
  </span>
);

const MarqueeRow = ({
  items,
  reverse = false,
}: {
  items: string[];
  reverse?: boolean;
}) => {
  const doubled = [...items, ...items];
  return (
    <div className="relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className={`flex gap-0 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ willChange: "transform" }}
      >
        {doubled.map((item, i) => (
          <Pill key={`${item}-${i}`} label={item} />
        ))}
      </div>
    </div>
  );
};

const IntegrationMarquee = () => (
  <section className="w-full py-20 border-t border-[#E7E5E4] dark:border-[#222224] overflow-hidden">
    <div className="max-w-6xl mx-auto px-4 mb-8">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-xs uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 text-center"
      >
        Works with your stack
      </motion.p>
    </div>

    <div className="flex flex-col gap-3">
      <MarqueeRow items={marqueeRow1} />
      <MarqueeRow items={marqueeRow2} reverse />
    </div>
  </section>
);

export default IntegrationMarquee;
