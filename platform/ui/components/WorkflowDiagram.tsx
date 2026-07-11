"use client";

import { useEffect, useState } from "react";

/* ── Live request-flow diagram (alterauth-style) ─────────────────────
   Two scenarios auto-cycle: a legitimate request that passes policy,
   and an injected destructive request that gets blocked. Each tick
   advances one event-log step and highlights the module doing the
   work. Pausable; the toggle switches scenarios manually.            */

type Scenario = {
  key: "legit" | "malicious";
  title: string;
  request: { agent: string; verb: string; target: string };
  verdict: { label: string; color: string; reason: string };
  steps: { text: string; module: Module | null }[];
  blocked: boolean;
};

type Module = "policy" | "confidence" | "injection" | "audit";

const SCENARIOS: Scenario[] = [
  {
    key: "legit",
    title: "Agent reads a customer record with authorized scope",
    request: { agent: "support-agent", verb: "GET", target: "/v1/customers/42" },
    verdict: { label: "ALLOWED", color: "#30A46C", reason: "Policy crud-read matched grant" },
    blocked: false,
    steps: [
      { text: "Agent requests customer:read via SDK", module: null },
      { text: "Policy check — crud-read grants read on customers", module: "policy" },
      { text: "Confidence 0.96 verified, above threshold", module: "confidence" },
      { text: "Allowed — tool call executed against the API", module: null },
      { text: "Decision written to audit log (tr_4d21b8)", module: "audit" },
    ],
  },
  {
    key: "malicious",
    title: "Injected prompt tries to wipe the customer table",
    request: { agent: "support-agent", verb: "CALL", target: "delete_all_records" },
    verdict: { label: "BLOCKED", color: "#E5484D", reason: "Destructive action denied by policy" },
    blocked: true,
    steps: [
      { text: "Tool response carries injected instructions", module: null },
      { text: "Injection filter flags adversarial pattern", module: "injection" },
      { text: "Policy check — delete_all_records is destructive", module: "policy" },
      { text: "Denied — the API call never happens", module: null },
      { text: "Denial + evidence written to audit log (tr_9e07c1)", module: "audit" },
    ],
  },
];

const MODULES: { key: Module; label: string; icon: string }[] = [
  { key: "policy", label: "Policy", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { key: "confidence", label: "Confidence", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "injection", label: "Injection Filter", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { key: "audit", label: "Audit", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
];

const TICK_MS = 1700;
const HOLD_TICKS = 2;

function Mono({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export default function WorkflowDiagram() {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [step, setStep] = useState(0); // 0 = nothing yet, 1..steps.length revealed
  const [paused, setPaused] = useState(false);

  const scenario = SCENARIOS[scenarioIdx];
  const total = scenario.steps.length;
  const decided = step >= total - 1;
  const activeModule = step > 0 && step <= total ? scenario.steps[step - 1].module : null;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setStep((s) => {
        if (s < total + HOLD_TICKS) return s + 1;
        setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
        return 0;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [paused, total, scenarioIdx]);

  function pick(i: number) {
    setScenarioIdx(i);
    setStep(0);
  }

  const flowing = step > 0;
  const outcome = step >= total - 1; // outgoing side resolved

  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-[#0D0E13]/40 p-4 sm:p-8">
      <style>{`
        @keyframes lelu-dash-bg { to { background-position: -14px 0; } }
        .lelu-dash { background-image: repeating-linear-gradient(90deg, currentColor 0 6px, transparent 6px 14px); background-size: 14px 1.5px; background-repeat: repeat-x; background-position: 0 0; }
        .lelu-dash-run { animation: lelu-dash-bg 0.6s linear infinite; }
        @keyframes lelu-dash-bg-v { to { background-position: 0 -14px; } }
        .lelu-dash-v { background-image: repeating-linear-gradient(180deg, currentColor 0 6px, transparent 6px 14px); background-size: 1.5px 14px; background-repeat: repeat-y; }
        @media (prefers-reduced-motion: reduce) { .lelu-dash-run { animation: none; } }
      `}</style>

      {/* Scenario toggle */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          onClick={() => pick(0)}
          className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            scenario.key === "legit"
              ? "border-[#30A46C]/50 bg-[#30A46C]/10 text-[#30A46C]"
              : "border-white/[0.08] text-[#5A5C66] hover:text-white"
          }`}
        >
          ● Legitimate request
        </button>
        <button
          onClick={() => pick(scenarioIdx === 0 ? 1 : 0)}
          aria-label="Switch scenario"
          className={`relative h-6 w-11 shrink-0 rounded-full border border-white/[0.1] transition-colors ${
            scenario.key === "malicious" ? "bg-[#E5484D]/30" : "bg-[#30A46C]/30"
          }`}
        >
          <span
            className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-all ${
              scenario.key === "malicious" ? "left-[24px]" : "left-0.5"
            }`}
          />
        </button>
        <button
          onClick={() => pick(1)}
          className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${
            scenario.key === "malicious"
              ? "border-[#E5484D]/50 bg-[#E5484D]/10 text-[#E5484D]"
              : "border-white/[0.08] text-[#5A5C66] hover:text-white"
          }`}
        >
          ● Malicious request
        </button>
      </div>

      {/* Scenario banner */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#0A0B10] px-4 py-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-white">{scenario.title}</p>
          <p className="mt-1 truncate font-mono text-[11.5px] text-[#5A5C66]">
            {scenario.request.agent} <span className="text-[#3B82F6]">→</span>{" "}
            <span className="text-[#8B8D98]">{scenario.request.verb}</span> {scenario.request.target}
          </p>
        </div>
        <div
          className={`flex items-center gap-2.5 transition-opacity duration-500 ${decided ? "opacity-100" : "opacity-0"}`}
        >
          <span
            className="rounded border px-2 py-1 font-mono text-[10.5px] font-bold tracking-[0.08em]"
            style={{ color: scenario.verdict.color, borderColor: `${scenario.verdict.color}66` }}
          >
            {scenario.verdict.label}
          </span>
          <span className="text-[11.5px]" style={{ color: scenario.verdict.color }}>
            {scenario.verdict.reason}
          </span>
        </div>
      </div>

      {/* Flow diagram */}
      <div className="mt-6 grid items-center gap-4 md:grid-cols-[minmax(150px,1fr)_minmax(40px,80px)_auto_minmax(40px,80px)_minmax(150px,1fr)]">
        {/* Left: your agents */}
        <div className={`rounded-xl border bg-[#0A0B10] p-4 transition-colors ${flowing ? "border-[#3B82F6]/40" : "border-white/[0.08]"}`}>
          <p className="mb-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#60A5FA]">Your agents</p>
          <ul className="space-y-1.5">
            {["LangChain / CrewAI", "MCP servers", "Chatbots", "Apps + scripts"].map((t) => (
              <li key={t} className="flex items-center gap-2 font-mono text-[11.5px] text-[#8B8D98]">
                <span className="h-1 w-1 rounded-full bg-[#3B82F6]/60 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Connector: SDK request */}
        <div className="relative hidden h-10 md:block">
          <div className={`lelu-dash absolute inset-x-0 top-1/2 h-[1.5px] ${flowing ? "text-[#3B82F6] lelu-dash-run" : "text-white/[0.12]"}`} />
          <span className="absolute inset-x-0 top-0 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[#5A5C66]">SDK request</span>
        </div>

        {/* Center: Lelu */}
        <div className="rounded-xl border border-white/[0.1] bg-[#0A0B10] p-4 shadow-[0_0_50px_rgba(139,92,246,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <svg width="14" height="15" viewBox="0 0 32 35" fill="#FAFAFA"><rect x="0" y="0" width="26" height="9" rx="4.5"/><rect x="3" y="13" width="26" height="9" rx="4.5"/><rect x="6" y="26" width="26" height="9" rx="4.5"/></svg>
            <span className="text-[14px] font-semibold text-white">lelu</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MODULES.map((m) => {
              const active = activeModule === m.key;
              return (
                <div
                  key={m.key}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-all duration-300 ${
                    active
                      ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/10 text-white"
                      : "border-white/[0.07] text-[#8B8D98]"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-[#A78BFA]" : "text-[#5A5C66]"}>
                    <path d={m.icon} />
                  </svg>
                  <span className="font-mono text-[11.5px] whitespace-nowrap">{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connector: outcome */}
        <div className="relative hidden h-10 md:block">
          <div
            className={`lelu-dash absolute inset-x-0 top-1/2 h-[1.5px] ${
              outcome
                ? scenario.blocked
                  ? "text-[#E5484D]"
                  : "text-[#30A46C] lelu-dash-run"
                : "text-white/[0.12]"
            }`}
          />
          {outcome && scenario.blocked && (
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E5484D]/60 bg-[#0A0B10] px-1.5 font-mono text-[10px] font-bold text-[#E5484D]">✕</span>
          )}
          <span className="absolute inset-x-0 top-0 text-center font-mono text-[9px] uppercase tracking-[0.08em] text-[#5A5C66] whitespace-nowrap">
            {outcome && scenario.blocked ? "blocked" : "tool call"}
          </span>
        </div>

        {/* Right: external services */}
        <div
          className={`rounded-xl border bg-[#0A0B10] p-4 transition-all duration-300 ${
            outcome && !scenario.blocked ? "border-[#30A46C]/40" : "border-white/[0.08]"
          } ${outcome && scenario.blocked ? "opacity-40" : "opacity-100"}`}
        >
          <p className="mb-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#8B8D98]">External services</p>
          <ul className="space-y-1.5">
            {["Databases", "Email + Slack", "Payments", "SaaS APIs"].map((t) => (
              <li key={t} className="flex items-center gap-2 font-mono text-[11.5px] text-[#8B8D98]">
                <span className="h-1 w-1 rounded-full bg-white/25 shrink-0" /> {t}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#5A5C66]">tools + APIs</p>
        </div>
      </div>

      {/* Bottom row: human review path + event log */}
      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(150px,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col justify-end">
          <div className="mb-3 hidden md:flex items-center gap-2 pl-6">
            <div className="lelu-dash-v h-10 w-[1.5px] text-white/[0.12]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#5A5C66]">human review</span>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0A0B10] px-4 py-3">
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#F5A623]">Humans</p>
            <p className="mt-1.5 flex items-center gap-2 text-[12px] text-[#8B8D98]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 5.5 0 0 1 13 0"/></svg>
              Approve risky actions in Slack
            </p>
          </div>
        </div>

        {/* Event log */}
        <div className="rounded-xl border border-white/[0.06] bg-[#0A0B10] p-4">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#30A46C]">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Event log
          </p>
          <ol className="space-y-2 min-h-[128px]">
            {scenario.steps.map((s, i) => {
              const shown = step >= i + 1;
              const latest = step === i + 1;
              return (
                <li
                  key={`${scenario.key}-${i}`}
                  className={`flex items-baseline gap-3 font-mono text-[12px] transition-all duration-400 ${
                    shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                  } ${latest ? "text-[#60A5FA]" : "text-[#8B8D98]"}`}
                >
                  <span className="text-[#5A5C66] w-3 shrink-0 text-right">{i + 1}</span>
                  {s.text}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Pause */}
      <button
        onClick={() => setPaused((p) => !p)}
        className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#5A5C66] hover:text-white transition-colors"
      >
        {paused ? (
          <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Play</>
        ) : (
          <><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg> Pause</>
        )}
      </button>
    </div>
  );
}
