"use client";
import { motion } from "framer-motion";
import { marqueeRow1, marqueeRow2 } from "@/data";

const Pill = ({ label, "aria-hidden": ariaHidden }: { label: string; "aria-hidden"?: boolean }) => (
  <span
    aria-hidden={ariaHidden}
    className="inline-flex shrink-0 items-center px-3.5 py-1.5 rounded-full border border-[#E7E5E4] dark:border-[#20222B] bg-white dark:bg-[#0D0E13] text-[13px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap select-none mx-1.5"
  >
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
  // Repeat the set 6× so half the track (the -50% loop distance) is always
  // wider than the viewport — otherwise wide screens see a blank gap.
  const repeated = Array.from({ length: 6 }, () => items).flat();
  return (
    <div className="relative flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className={`flex w-max shrink-0 gap-0 ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}
        style={{ willChange: "transform", animationDuration: reverse ? "80s" : "95s" }}
      >
        {repeated.map((item, i) => (
          <Pill key={`${item}-${i}`} label={item} aria-hidden={i >= items.length} />
        ))}
      </div>
    </div>
  );
};

const IntegrationMarquee = () => (
  <section className="w-full py-20 border-t border-[#E7E5E4] dark:border-[#20222B] overflow-hidden">
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
