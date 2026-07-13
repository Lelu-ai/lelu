import Link from "next/link";
import { LeluMark } from "@/components/ui/LeluMark";

/* Accounts are disabled while Lelu is in free beta — no login needed. */
export default function NoAccountPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0B10] px-4 text-center">
      <LeluMark size={36} />
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-[#0A0A0A] dark:text-white">
        No account needed.
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-[#737373] dark:text-[#8B8D98]">
        Lelu is free and open source while we're in beta — there's nothing to sign
        up for. Run the engine locally with one command, or ask for early access
        to the hosted cloud.
      </p>
      <div className="mt-6 inline-flex items-center gap-3 rounded-lg border border-[#E7E5E4] dark:border-white/[0.08] bg-white dark:bg-[#0D0E13] px-4 py-2.5 font-mono text-[13px] text-[#3F3F46] dark:text-[#C9C9D2]">
        <span className="text-[#30A46C]">$</span> npx -y lelu-mcp start
      </div>
      <div className="mt-7 flex items-center gap-3">
        <Link
          href="/docs/quickstart"
          className="rounded-md bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] px-4 py-2 text-[13.5px] font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Get started
        </Link>
        <Link
          href="/pricing"
          className="rounded-md border border-[#D6D3D1] dark:border-white/[0.12] px-4 py-2 text-[13.5px] font-medium text-[#0A0A0A] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
        >
          Pricing
        </Link>
      </div>
    </div>
  );
}
