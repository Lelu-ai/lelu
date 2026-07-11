"use client";

import { useEffect, useRef, useState } from "react";
import { LeluMark } from "@/components/ui/LeluMark";
import WorkflowDiagram from "@/components/WorkflowDiagram";

/* ── Auto-playing product demo (~2:30) ────────────────────────────────
   Built entirely from the live diagrams — no video, no voiceover.
   Used as the YC demo: record this page playing, or share the URL.   */

type Scene = {
  key: string;
  dur: number; // seconds
  kicker: string;
  caption: string;
};

const SCENES: Scene[] = [
  {
    key: "intro",
    dur: 11,
    kicker: "Lelu",
    caption: "Open-source authorization engine for AI agents.",
  },
  {
    key: "problem",
    dur: 26,
    kicker: "The problem",
    caption:
      "Agents hold real credentials — and a prompt injection can talk them into anything. Watch one try to wipe a customer table: Lelu blocks it before the API call happens.",
  },
  {
    key: "start",
    dur: 28,
    kicker: "Zero-config start",
    caption:
      "The real engine runs on your machine in one command — no account, no Docker. One HTTP call authorizes every agent action.",
  },
  {
    key: "decisions",
    dur: 30,
    kicker: "Four explicit outcomes",
    caption:
      "Every tool call from any framework returns allow, deny, human_review, or compute — and every decision is written to the audit log.",
  },
  {
    key: "live",
    dur: 36,
    kicker: "Policy · confidence · injection filters",
    caption:
      "The same request path, two outcomes: authorized reads pass, injected destructive calls die at the policy layer — with evidence logged.",
  },
  {
    key: "outro",
    dur: 17,
    kicker: "Give your agents guardrails",
    caption: "MIT licensed · self-hostable · github.com/lelu-ai/lelu",
  },
];

const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);

export default function DemoPage() {
  const [elapsed, setElapsed] = useState(0); // seconds since start
  const [done, setDone] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = performance.now();
    const t = setInterval(() => {
      if (startRef.current === null) return;
      const e = (performance.now() - startRef.current) / 1000;
      if (e >= TOTAL) {
        setElapsed(TOTAL);
        setDone(true);
        clearInterval(t);
      } else {
        setElapsed(e);
      }
    }, 100);
    return () => clearInterval(t);
  }, []);

  function replay() {
    startRef.current = performance.now();
    setElapsed(0);
    setDone(false);
    // restart the ticker
    const t = setInterval(() => {
      if (startRef.current === null) return;
      const e = (performance.now() - startRef.current) / 1000;
      if (e >= TOTAL) {
        setElapsed(TOTAL);
        setDone(true);
        clearInterval(t);
      } else {
        setElapsed(e);
      }
    }, 100);
  }

  // Find active scene + progress within it
  let acc = 0;
  let idx = SCENES.length - 1;
  for (let i = 0; i < SCENES.length; i++) {
    if (elapsed < acc + SCENES[i].dur) {
      idx = i;
      break;
    }
    acc += SCENES[i].dur;
  }
  const scene = SCENES[idx];
  const sceneElapsed = Math.min(elapsed - SCENES.slice(0, idx).reduce((a, s) => a + s.dur, 0), scene.dur);

  return (
    <div className="dark fixed inset-0 z-[100] flex flex-col bg-[#0A0B10] text-[#EDEEF0] antialiased overflow-hidden">
      <style>{`@keyframes demo-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Progress bar */}
      <div className="flex gap-1.5 px-6 pt-5" aria-hidden>
        {SCENES.map((s, i) => (
          <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6]"
              style={{
                width: i < idx ? "100%" : i === idx ? `${(sceneElapsed / s.dur) * 100}%` : "0%",
                transition: "width 120ms linear",
              }}
            />
          </div>
        ))}
      </div>

      {/* Stage */}
      <div className="flex flex-1 min-h-0 items-center justify-center px-6">
        <div key={scene.key} className="w-full max-w-[1020px]" style={{ animation: "demo-in 0.6s ease-out" }}>
          {scene.key === "intro" && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-4">
                <LeluMark size={56} className="text-white" />
                <span className="text-[64px] font-bold tracking-tight text-white">Lelu</span>
              </div>
              <h1 className="mx-auto mt-8 max-w-2xl text-[34px] font-semibold tracking-tight text-white leading-[1.15]">
                The authorization engine for AI agents.
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-[#8B8D98]">
                Every action checked. Every decision logged. Humans in the loop when it matters.
              </p>
            </div>
          )}

          {scene.key === "problem" && <WorkflowDiagram lock="malicious" hideControls />}

          {scene.key === "start" && (
            <div className="mx-auto max-w-[860px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lelu-terminal.svg" alt="" width={760} height={272} className="w-full h-auto rounded-2xl" />
            </div>
          )}

          {scene.key === "decisions" && (
            <div className="mx-auto max-w-[900px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/lelu-flow.svg" alt="" width={760} height={330} className="w-full h-auto rounded-2xl" />
            </div>
          )}

          {scene.key === "live" && <WorkflowDiagram hideControls />}

          {scene.key === "outro" && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-3">
                <LeluMark size={34} className="text-white" />
                <span className="text-[38px] font-bold tracking-tight text-white">Lelu</span>
              </div>
              <h2 className="mt-7 text-[30px] font-semibold tracking-tight text-white">
                Give your agents guardrails.
              </h2>
              <div className="mt-7 inline-flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0D0E13] px-5 py-3 font-mono text-[15px] text-[#C9C9D2]">
                <span className="text-[#30A46C]">$</span> npx -y lelu-mcp start
              </div>
              <p className="mt-6 font-mono text-[13px] text-[#5A5C66]">
                github.com/lelu-ai/lelu &nbsp;·&nbsp; lelu-ai.com/sandbox
              </p>
              {done && (
                <button
                  onClick={replay}
                  className="mt-8 rounded-md border border-white/[0.12] px-4 py-2 text-[13px] text-white hover:bg-white/[0.05] transition-colors"
                >
                  ↺ Replay demo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Caption bar */}
      <div className="px-6 pb-7 pt-2">
        <div key={`cap-${scene.key}`} className="mx-auto max-w-3xl text-center" style={{ animation: "demo-in 0.5s ease-out" }}>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#60A5FA]">{scene.kicker}</p>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#8B8D98]">{scene.caption}</p>
        </div>
      </div>
    </div>
  );
}
