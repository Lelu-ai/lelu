import Link from "next/link";
import { FiMail } from "react-icons/fi";
import { OVERAGE_BLOCK, OVERAGE_USD_PER_BLOCK } from "@/lib/billing/plans";
import { CONTACT_EMAIL as CONTACT } from "@/lib/contact";

// Refund policy for the hosted cloud plans. Paddle, our merchant of record,
// processes every payment and refund, so this page has to agree with what
// Paddle tells buyers and is linked from the terms, pricing page and footer.

export const metadata = {
  title: "Refund Policy · Lelu",
  description: "How refunds work for Lelu's hosted cloud plans, sold through Paddle.",
};

const UPDATED = "November 23, 2026";
const OVERAGE = `$${OVERAGE_USD_PER_BLOCK.toFixed(2)} per ${OVERAGE_BLOCK.toLocaleString("en-US")} calls`;

const CARD = "bg-white dark:bg-[#0D0E13] border border-[#E7E5E4] dark:border-[#20222B] rounded-2xl p-6 sm:p-8 space-y-4";
const H2 = "text-[20px] font-bold tracking-[-0.01em] text-[#0A0A0A] dark:text-white";
const STRONG = "text-[#0A0A0A] dark:text-white";
const LINK = "text-[#0A0A0A] dark:text-white font-semibold underline";

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0B10] text-[#0A0A0A] dark:text-zinc-100">
      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-10 border-b border-[#E7E5E4] dark:border-[#20222B] pb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-zinc-200/70 dark:bg-white/10 text-zinc-800 dark:text-zinc-200">
              Legal & Billing
            </span>
            <span className="text-[12px] text-[#737373]">Last updated: {UPDATED}</span>
          </div>
          <h1 className="text-[32px] sm:text-[42px] font-bold tracking-[-0.03em] text-[#0A0A0A] dark:text-white leading-tight mb-4">
            Refund Policy
          </h1>
          <p className="text-[16px] text-[#737373] leading-relaxed">
            This policy covers the paid plans of Lelu&apos;s hosted cloud (Starter, Growth and their usage charges).
            The open-source engine, SDKs and MCP server are free and are not sold. Lelu is operated by Abenezer Getachew Birhane, an individual sole proprietor based in Addis Ababa, Ethiopia, trading as Lelu.
          </p>
        </div>

        <main className="space-y-8 text-[14px] text-[#52525B] dark:text-zinc-300 leading-relaxed">
          <section className={CARD}>
            <h2 className={H2}>1. Who processes your payment</h2>
            <p>
              Our order process is conducted by our online reseller <strong className={STRONG}>Paddle.com</strong>. Paddle.com is
              the Merchant of Record for all our orders: it sells to you, charges your card, adds and files the applicable sales
              tax or VAT, and issues refunds. Your purchase is also covered by{" "}
              <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer" className={LINK}>
                Paddle&apos;s Buyer Terms
              </a>
              , and nothing in this policy limits the rights they or the law give you.
            </p>
          </section>

          <section className={CARD}>
            <h2 className={H2}>2. 14-day money-back guarantee</h2>
            <p>
              If Lelu is not right for you, ask for a refund within <strong className={STRONG}>14 days</strong> of your first
              payment for a plan and we will refund that payment in full. No reason is needed.
            </p>
            <p>
              <strong className={STRONG}>Renewals:</strong> a plan renews every month until you cancel. If a renewal charged you
              after you meant to cancel, ask within 14 days of that renewal and we will refund it and cancel the plan.
            </p>
          </section>

          <section className={CARD}>
            <h2 className={H2}>3. Usage charges</h2>
            <p>
              Starter and Growth include a monthly number of authorize calls. Calls past that are billed at {OVERAGE} on your
              next invoice, for usage that has already happened. Usage charges are refunded when they were billed in error, for
              example a duplicate charge or calls counted that our system should not have counted. Tell us within 30 days of the
              invoice and we will check and correct it.
            </p>
          </section>

          <section className={CARD}>
            <h2 className={H2}>4. Cancelling and changing plans</h2>
            <ul className="list-disc pl-5 space-y-2 text-[#737373] dark:text-zinc-400">
              <li>
                Cancel any time from <strong className={STRONG}>Manage billing</strong> on your dashboard. Your plan stays active
                until the end of the period you paid for, then moves to the free tier. Cancelling does not delete your account or
                data.
              </li>
              <li>
                <strong className={STRONG}>Upgrades</strong> start immediately and charge the prorated difference.
              </li>
              <li>
                <strong className={STRONG}>Downgrades</strong> also take effect immediately; the unused part of the higher price
                is credited to your next bill rather than refunded.
              </li>
            </ul>
          </section>

          <section className={CARD}>
            <h2 className={H2}>5. How to ask for a refund</h2>
            <p>
              Email{" "}
              <a href={`mailto:${CONTACT}`} className={LINK}>
                {CONTACT}
              </a>{" "}
              from the address on your account, or contact Paddle through the link in your receipt email or at{" "}
              <a href="https://paddle.net" target="_blank" rel="noreferrer" className={LINK}>
                paddle.net
              </a>
              . Approved refunds go back to the original payment method; your bank may take 5 to 10 business days to show them.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href={`mailto:${CONTACT}?subject=Refund%20request`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0A0A] dark:bg-white text-white dark:text-[#0A0A0A] font-bold text-[13px] hover:opacity-90 transition-opacity"
              >
                <FiMail size={15} /> Request a refund
              </a>
              <Link
                href="/terms#billing"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#20222B] text-[#0A0A0A] dark:text-white font-bold text-[13px] hover:bg-[#F5F5F4] dark:hover:bg-[#12141A] transition-colors"
              >
                Billing terms
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
