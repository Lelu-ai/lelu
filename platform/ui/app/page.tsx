const installSteps = [
  {
    title: "1. Clone the repository",
    command: "git clone https://github.com/lelu-auth/lelu.git lelu && cd lelu",
    note: "Start from the project root so Docker and all services are available.",
  },
  {
    title: "2. Build and run with Docker",
    command: "docker-compose up -d --build",
    note: "Builds UI, engine, platform, and supporting services in one command.",
  },
  {
    title: "3. Open the UI",
    command: "http://localhost:3002",
    note: "The dashboard is available once containers are healthy.",
  },
];

const pillars = [
  {
    title: "Policy-Driven Decisions",
    text: "Lelu applies Rego policies at action time so every tool call can be evaluated, gated, and audited.",
  },
  {
    title: "Human Approval for Risk",
    text: "High-risk AI actions can be paused automatically and routed to human reviewers before execution.",
  },
  {
    title: "Full Audit Trail",
    text: "Every allow, deny, and escalation is captured with confidence context and decision metadata.",
  },
];

export default function Home() {
  return (
    <div className="relative overflow-hidden bg-white text-black dark:bg-black dark:text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.05),transparent_50%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),transparent_50%)]" />

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-20 md:pt-28">
        <div className="max-w-3xl space-y-6">
          <p className="inline-flex items-center rounded-full border border-zinc-300 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            Lelu Policy Engine
          </p>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Keep AI actions under
            <br />
            clear, enforceable control.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-300 md:text-lg">
            Lelu combines policy evaluation, confidence-aware gating, human review queues, and auditable enforcement
            so teams can ship AI systems without losing operational control.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="/docs"
              className="rounded-md bg-black px-5 py-3 text-sm font-medium text-white transition hover:opacity-85 dark:bg-white dark:text-black"
            >
              Read documentation
            </a>
            <a
              href="https://github.com/lelu-auth/lelu"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-zinc-300 px-5 py-3 text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              View GitHub
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article
              key={pillar.title}
              className="rounded-xl border border-zinc-200 bg-white/70 p-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
            >
              <h2 className="mb-3 text-lg font-semibold">{pillar.title}</h2>
              <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{pillar.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50/80 py-20 dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="mx-auto w-full max-w-6xl px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How to install</h2>
            <p className="mt-3 text-zinc-700 dark:text-zinc-300">
              A simple setup path inspired by clean documentation best practices: clone, run Docker, and open the UI.
            </p>
          </div>

          <div className="space-y-4">
            {installSteps.map((step) => (
              <article
                key={step.title}
                className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-black"
              >
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                  {step.title}
                </h3>
                <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  <code>{step.command}</code>
                </pre>
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{step.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
