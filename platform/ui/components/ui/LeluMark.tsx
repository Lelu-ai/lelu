import { cn } from "@/lib/utils";

/**
 * Lelu abstract mark — three stacked capsule bars with progressive rightward
 * stagger. Represents sequential authorization checkpoints. Monochromatic,
 * scales from 16px favicon to hero size without loss of fidelity.
 *
 * flip=true mirrors horizontally for the right-side hero bookend.
 */
export const LeluMark = ({
  size = 32,
  className,
  flip = false,
}: {
  size?: number;
  className?: string;
  flip?: boolean;
}) => (
  <svg
    width={Math.round(size * (32 / 35))}
    height={size}
    viewBox="0 0 32 35"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={cn("text-[#0A0A0A] dark:text-white", className)}
    style={flip ? { transform: "scaleX(-1)" } : undefined}
  >
    <rect x="0" y="0"  width="26" height="9" rx="4.5" fill="currentColor" />
    <rect x="3" y="13" width="26" height="9" rx="4.5" fill="currentColor" />
    <rect x="6" y="26" width="26" height="9" rx="4.5" fill="currentColor" />
  </svg>
);
