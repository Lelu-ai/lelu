"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  FaGithub,
  FaNpm,
  FaPython,
  FaDocker,
  FaLinkedin,
  FaDiscord,
  FaXTwitter,
} from "react-icons/fa6";
import {
  SiKubernetes,
  SiPostgresql,
  SiSqlite,
  SiOpentelemetry,
  SiTypescript,
} from "react-icons/si";
import {
  FiBook,
  FiExternalLink,
  FiMail,
  FiShield,
  FiAlertTriangle,
  FiDatabase,
  FiCheckCircle,
} from "react-icons/fi";
export default function AboutPage() {
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  return (
    <main className="relative min-h-screen bg-[#FAFAFA] dark:bg-[#0B0B0C] flex flex-col items-center overflow-hidden mx-auto sm:px-10 px-5 pt-24 md:pt-32">

      <div className="max-w-7xl w-full relative z-10">
        {/* HERO SECTION - Exact text match */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="max-w-4xl mb-32 px-6 md:px-0"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            About{" "}
            <span className="text-[#0A0A0A] dark:text-white">
              Lelu AI
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed mb-6">
            We are building an authorization and security platform for AI agents.
          </p>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed mb-8">
            Lelu helps companies safely deploy autonomous AI systems by providing real-time access
            control, human oversight, and complete audit trails.
          </p>
        </motion.section>

        <div className="px-6 md:px-0 space-y-40 pb-20">
          {/* ────── COMPANY OVERVIEW ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            id="overview"
          >
            <div className="rounded-[2.5rem] p-8 md:p-14 border border-zinc-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-xl">
              <h2 className="text-3xl font-bold mb-12 text-zinc-900 dark:text-white">Company Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-12">
                {[
                  { label: "Company", value: "Lelu AI" },
                  { label: "Founder", value: "Abenezer Getachew" },
                  { label: "Product", value: "Authorization Engine for AI Agents" },
                  { label: "Status", value: "Production-ready (v1.0)" },
                  { label: "SDKs Available", value: "TypeScript, Python" },
                  { label: "License", value: "Open Source (MIT)" },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">
                      {item.label}
                    </div>
                    <div className="text-xl font-bold">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* PRODUCT LINKS - Surgical mirror */}
              <div className="mt-16 pt-12 border-t border-zinc-200 dark:border-white/10">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-8">
                  Product Links
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    {
                      name: "GitHub",
                      icon: <FaGithub />,
                      link: "https://github.com/lelu-auth/lelu",
                    },
                    {
                      name: "npm Package",
                      icon: <FaNpm />,
                      link: "https://www.npmjs.com/package/lelu-agent-auth",
                    },
                    {
                      name: "PyPI Package",
                      icon: <FaPython />,
                      link: "https://pypi.org/project/lelu-auth",
                    },
                    { name: "Documentation", icon: <FiBook />, link: "/docs" },
                  ].map((item, i) => (
                    <a
                      key={i}
                      href={item.link}
                      className="flex items-center justify-between px-6 py-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-zinc-500 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl text-zinc-700 dark:text-zinc-300 group-hover:scale-110 transition-transform">
                          {item.icon}
                        </span>
                        <span className="font-bold text-sm">{item.name}</span>
                      </div>
                      <FiExternalLink className="opacity-30 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* ────── FOUNDER ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            id="founder"
          >
            <div className="flex flex-col md:flex-row gap-12 items-start bg-zinc-50 dark:bg-[#141416] rounded-[2.5rem] p-10 md:p-16 border border-zinc-200 dark:border-white/10">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-[#0A0A0A] dark:bg-[#222224] flex items-center justify-center text-white text-5xl font-bold shrink-0 shadow-2xl">
                AG
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">Abenezer Getachew</h2>
                <p className="text-zinc-500 font-bold text-lg mb-8 uppercase tracking-widest">
                  Founder & Software Engineer
                </p>
                <div className="space-y-6 text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  <p>
                    Software engineer with 5+ years of experience building scalable distributed
                    systems and production infrastructure.
                  </p>
                  <p>
                    Founded Lelu AI to solve the critical problem of AI agent security. Passionate
                    about making autonomous systems safe and trustworthy for production deployment.
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ────── THE PROBLEM ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            id="problem"
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-12">The Problem</h2>
            <div className="space-y-10 text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <p>
                AI agents are powerful enough to take real actions—processing refunds, modifying
                databases, sending emails, making business decisions.
              </p>
              <p>
                But traditional authorization systems weren't built for AI. They assume
                deterministic, human-driven actions.
              </p>
              <p>
                AI agents operate with uncertainty, make probabilistic decisions, and can be
                manipulated through prompt injection attacks. Companies need a security layer
                designed specifically for autonomous AI.
              </p>
            </div>
          </motion.section>

          {/* ────── WHY WE BUILT LELU ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            id="why-lelu"
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-12">Why We Built Lelu</h2>
            <div className="space-y-8 text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 leading-relaxed mb-16">
              <p>
                AI agents are moving from research prototypes to production systems. Companies like
                Anthropic, OpenAI, and Google are releasing increasingly capable models that can
                take real-world actions.
              </p>
              <p className="font-bold text-zinc-900 dark:text-white">
                But with this power comes risk:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              {[
                "An AI agent with database access could accidentally delete critical data",
                "A customer support agent could issue unauthorized refunds",
                "A code-writing agent could introduce security vulnerabilities",
              ].map((risk, i) => (
                <div
                  key={i}
                  className="p-10 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex flex-col gap-8 group hover:border-red-500/30 transition-colors"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#0B0B0C] flex items-center justify-center text-2xl shadow-xl">
                    <FiAlertTriangle className="text-red-500" />
                  </div>
                  <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
                    {risk}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-2xl md:text-3xl text-zinc-600 dark:text-zinc-400 leading-relaxed font-bold italic border-l-8 border-[#0A0A0A] dark:border-white pl-10">
              Lelu provides the security infrastructure that makes AI agents safe for
              production—allowing companies to move fast without breaking things.
            </p>
          </motion.section>

          {/* ────── WHAT WE BUILT ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            id="what-we-built"
            className="w-full"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mb-20">
              <div className="max-w-2xl">
                <h2 className="text-4xl font-bold mb-6">What We Built</h2>
                <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Lelu is a complete authorization engine that evaluates every AI agent action in
                  real-time.
                </p>
              </div>
              <div className="p-10 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/20 md:text-right">
                <div className="flex items-center gap-2 mb-4 md:justify-end text-emerald-500">
                  <FiCheckCircle className="text-2xl" />
                  <span className="font-bold uppercase tracking-widest text-sm">
                    Production Ready
                  </span>
                </div>
                <div className="text-lg font-medium text-emerald-800 dark:text-emerald-300 max-w-sm">
                  Version 1.0 is live and being used by development teams building AI agent
                  applications
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  icon: "🎯",
                  title: "Confidence-Aware Control",
                  desc: "Automatically routes low-confidence decisions to human reviewers, preventing costly mistakes.",
                },
                {
                  icon: "🛡️",
                  title: "Prompt Injection Defense",
                  desc: "Detects and blocks malicious prompts before they can manipulate agent behavior.",
                },
                {
                  icon: "📋",
                  title: "Policy Enforcement",
                  desc: "Define what agents can and cannot do using simple YAML or advanced Rego policies.",
                },
                {
                  icon: "📊",
                  title: "Complete Audit Trail",
                  desc: "Every decision is logged with full context for compliance and debugging.",
                },
              ].map((pill, i) => (
                <div
                  key={i}
                  className="rounded-[3rem] p-12 bg-zinc-50 dark:bg-[#141416] border border-zinc-200 dark:border-white/10 group hover:-translate-y-2 transition-all duration-300"
                >
                  <div className="text-5xl mb-10 group-hover:scale-110 transition-transform">
                    {pill.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-6">{pill.title}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-base leading-relaxed">
                    {pill.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ────── AVAILABLE SDKS ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-10">Available SDKs & Integration</h2>
            <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 mb-16 max-w-4xl leading-relaxed">
              Companies integrate Lelu using our SDKs for TypeScript and Python. All agent
              actions are evaluated through our authorization engine before execution.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
              {[
                { name: "TypeScript/Node.js", icon: <SiTypescript className="text-[#3178C6]" /> },
                { name: "Python", icon: <FaPython className="text-[#3776AB]" /> },
                { name: "Docker", icon: <FaDocker className="text-[#2496ED]" /> },
                { name: "Kubernetes", icon: <SiKubernetes className="text-[#326CE5]" /> },
              ].map((sdk, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 gap-6 group hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                >
                  <div className="text-4xl group-hover:scale-110 transition-transform">
                    {sdk.icon}
                  </div>
                  <div className="text-sm font-bold">{sdk.name}</div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ────── WHO WE SERVE ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-16 italic text-zinc-300 dark:text-zinc-800">
              Who We Serve
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {[
                {
                  title: "Enterprise Development Teams",
                  desc: "Companies building AI agents for customer support, internal automation, data analysis, and business operations. Teams that need to deploy AI safely while maintaining security and compliance standards.",
                },
                {
                  title: "AI Platform Providers",
                  desc: "Companies offering AI agent platforms to their customers who need built-in authorization and security features without building them from scratch.",
                },
                {
                  title: "Regulated Industries",
                  desc: "Financial services, healthcare, and other industries requiring strict audit trails, human oversight, and compliance documentation for AI-driven decisions.",
                },
              ].map((serve, i) => (
                <div
                  key={i}
                  className="p-12 rounded-[3rem] border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0B0B0C] shadow-sm relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-48 h-48 bg-zinc-200/20 dark:bg-white/5 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  <h3 className="text-2xl font-bold mb-8 text-zinc-900 dark:text-white">{serve.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-lg">
                    {serve.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ────── USE CASES ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-16">Real-World Use Cases</h2>
            <div className="space-y-12">
              {[
                {
                  title: "Customer Support Automation",
                  desc: "AI agents handle routine support tickets automatically, but high-value actions like refunds or account modifications require human approval based on confidence thresholds.",
                },
                {
                  title: "Database Operations",
                  desc: "AI agents can query databases freely but destructive operations (DELETE, DROP) are blocked or require explicit human review, preventing catastrophic mistakes.",
                },
                {
                  title: "Multi-Agent Systems",
                  desc: "Parent agents delegate tasks to specialized sub-agents with scoped, time-limited permissions—ensuring the principle of least privilege across agent swarms.",
                },
              ].map((cc, i) => (
                <div
                  key={i}
                  className="rounded-[3rem] p-12 md:p-16 border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416] group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
                >
                  <h3 className="text-3xl font-bold mb-6 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                    {cc.title}
                  </h3>
                  <p className="text-zinc-600 dark:text-zinc-400 text-xl leading-relaxed">
                    {cc.desc}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ────── TECHNOLOGY ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="w-full"
          >
            <div className="flex flex-col items-start mb-16">
              <h2 className="text-4xl font-bold mb-6">Technology</h2>
              <p className="text-xl md:text-2xl text-zinc-500 max-w-3xl leading-relaxed">
                Built as a modern, cloud-native platform with enterprise-grade reliability:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                {
                  icon: <FiShield className="text-[#0A0A0A] dark:text-white" />,
                  title: "Authorization Engine",
                  desc: "Sub-50ms latency, policy-as-code",
                },
                {
                  icon: <SiPostgresql className="text-[#336791]" />,
                  title: "Storage",
                  desc: "SQLite for dev, PostgreSQL for production",
                },
                {
                  icon: <FaDocker className="text-[#2496ED]" />,
                  title: "Deployment",
                  desc: "Docker, Kubernetes, self-hosted",
                },
                {
                  icon: <SiOpentelemetry className="text-[#FF6600]" />,
                  title: "Observability",
                  desc: "OpenTelemetry tracing & metrics",
                },
                { icon: <FaGithub />, title: "Open Source", desc: "MIT License on GitHub" },
                {
                  icon: <SiTypescript className="text-[#3178C6]" />,
                  title: "SDKs",
                  desc: "TypeScript, Python",
                },
              ].map((tech, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center text-center p-12 rounded-[3.5rem] bg-white/50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 group hover:-translate-y-1 transition-all"
                >
                  <div className="text-6xl mb-8 group-hover:scale-110 transition-transform">
                    {tech.icon}
                  </div>
                  <div className="text-2xl font-bold mb-3">{tech.title}</div>
                  <div className="text-base text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                    {tech.desc}
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ────── COMPANY INFORMATION ────── */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            className="w-full"
          >
            <h2 className="text-4xl font-bold mb-16">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch">
              {/* Mission */}
              <div className="rounded-[3rem] p-12 md:p-16 border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416]">
                <h3 className="text-3xl font-bold mb-8">Mission</h3>
                <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 leading-relaxed italic border-l-8 border-[#0A0A0A] dark:border-white pl-10">
                  Make AI agents safe and trustworthy for production use. We believe autonomous AI
                  will transform how businesses operate, but only if companies can deploy it with
                  confidence and control.
                </p>
              </div>

              {/* Open Source */}
              <div className="rounded-[3rem] p-12 md:p-16 border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416]">
                <h3 className="text-3xl font-bold mb-8">Open Source</h3>
                <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Lelu is open source (MIT License) and available on GitHub. Security infrastructure
                  should be transparent, auditable, and community-driven. Companies can self-host or
                  use managed services.
                </p>
              </div>

              {/* Contact */}
              <div className="md:col-span-2 rounded-[3.5rem] p-12 md:p-16 border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416]">
                <h3 className="text-3xl font-bold mb-10 tracking-tight">Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <a
                    href="mailto:support@lelu-ai.com"
                    className="flex items-center gap-10 group bg-white/30 dark:bg-white/5 p-10 rounded-[3rem] border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-300"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-white dark:bg-[#141416] flex items-center justify-center text-3xl shadow-xl transition-all group-hover:scale-110">
                      <FiMail className="text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-400 mb-1 uppercase tracking-widest">
                        General:
                      </div>
                      <div className="text-2xl font-bold tracking-tight">support@lelu-ai.com</div>
                    </div>
                  </a>
                  <a
                    href="mailto:security@lelu-ai.com"
                    className="flex items-center gap-10 group bg-white/30 dark:bg-white/5 p-10 rounded-[3rem] border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 transition-all duration-300"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-white dark:bg-[#141416] flex items-center justify-center text-3xl shadow-xl transition-all group-hover:scale-110">
                      <FiShield className="text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-400 mb-1 uppercase tracking-widest">
                        Security:
                      </div>
                      <div className="text-2xl font-bold tracking-tight">security@lelu-ai.com</div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
