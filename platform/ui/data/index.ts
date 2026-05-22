export const navItems = [
  { name: "Docs", link: "/docs" },
  { name: "Audit Log", link: "/audit" },
  { name: "Policies", link: "/policies" },
];

export const heroStats = [
  { value: "28k+", label: "GitHub Stars" },
  { value: "<50ms", label: "P95 Latency" },
  { value: "100%", label: "Audit Coverage" },
  { value: "SOC 2", label: "Compliant" },
];

// 6 numbered features for the grid
export const numberedFeatures = [
  {
    num: "01",
    title: "Policy-driven decisions",
    desc: "Every agent action evaluated against Rego policies in real-time. No drift, no exceptions.",
    chip: "rego.eval() → allow",
    chipColor: "allow" as const,
  },
  {
    num: "02",
    title: "Human-in-the-loop",
    desc: "High-risk actions pause automatically and route to reviewers via Slack, email, or webhook.",
    chip: "⏸ review",
    chipColor: "review" as const,
  },
  {
    num: "03",
    title: "Tamper-proof audit",
    desc: "Every decision is immutably logged with confidence context, trace IDs, and SIEM-ready export.",
    chip: "hash: 0x4f…b2",
    chipColor: "neutral" as const,
  },
  {
    num: "04",
    title: "Multi-agent delegation",
    desc: "Agent swarms mint short-lived JIT tokens to delegate restricted access to sub-agents.",
    chip: "sk-agent-•••",
    chipColor: "neutral" as const,
  },
  {
    num: "05",
    title: "Confidence-aware gating",
    desc: "LLM confidence scores gate decisions. Low-confidence actions escalate automatically.",
    chip: "0.85 ✓",
    chipColor: "allow" as const,
  },
  {
    num: "06",
    title: "Real-time enforcement",
    desc: "Behavioral analytics, anomaly detection, and prompt injection blocking — all in-line.",
    chip: "<50ms",
    chipColor: "neutral" as const,
  },
];

// Integration marquee rows
export const marqueeRow1 = [
  "Rego", "OPA", "Cedar", "LangChain", "LangGraph", "CrewAI", "AutoGen", "Vercel AI SDK", "Mastra", "Semantic Kernel",
];
export const marqueeRow2 = [
  "OpenAI", "Anthropic", "MCP", "OAuth 2.0", "JWT", "SAML", "PostgreSQL", "Redis", "Datadog", "SIEM",
];

// Code snippets per language
export const codeSnippets = {
  ts: `import { LeluClient } from 'lelu-agent-auth';

const lelu = new LeluClient({ apiKey: process.env.LELU_API_KEY });

const result = await lelu.agentAuthorize({
  agentId: 'sales-agent-7f2a',
  action:  'database:write',
  resource: 'customers',
  confidence: 0.91,
});

if (result.decision === 'allow') {
  await db.upsert(data);
} else if (result.decision === 'review') {
  await queue.enqueue(pendingAction);   // routed to human
}`,
  py: `from lelu_sdk import LeluClient

lelu = LeluClient(api_key=os.environ["LELU_API_KEY"])

result = lelu.agent_authorize(
    agent_id="sales-agent-7f2a",
    action="database:write",
    resource="customers",
    confidence=0.91,
)

if result.decision == "allow":
    db.upsert(data)
elif result.decision == "review":
    queue.enqueue(pending_action)   # routed to human`,
  go: `import "github.com/lelu-auth/lelu/sdk/go"

client := lelu.NewClient(os.Getenv("LELU_API_KEY"))

result, err := client.AgentAuthorize(ctx, &lelu.AuthRequest{
    AgentID:    "sales-agent-7f2a",
    Action:     "database:write",
    Resource:   "customers",
    Confidence: 0.91,
})

switch result.Decision {
case lelu.Allow:
    db.Upsert(data)
case lelu.Review:
    queue.Enqueue(pendingAction) // routed to human
}`,
  curl: `curl -X POST https://your-engine.run.app/v1/authorize \\
  -H "Authorization: Bearer $LELU_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent_id":   "sales-agent-7f2a",
    "action":     "database:write",
    "resource":   "customers",
    "confidence": 0.91
  }'

# Response:
# { "decision": "allow", "trace_id": "tr_4f2a...", "latency_ms": 12 }`,
};

export const socialMedia = [
  { id: 1, img: "/git.svg", link: "https://github.com/lelu-auth/lelu" },
  { id: 2, img: "/twit.svg", link: "#" },
  { id: 3, img: "/link.svg", link: "https://www.linkedin.com/in/bereketgezha/" },
];

// legacy exports kept for pages that still import them
export const gridItems = [
  {
    id: 1,
    title: "Behavioral Analytics",
    description: "Track agent reputation, detect anomalies, and monitor behavior patterns in real-time.",
    className: "lg:col-span-2 md:col-span-3 md:row-span-2",
    imgClassName: "w-full h-full opacity-30",
    titleClassName: "justify-start",
    img: "/grid.svg",
    spareImg: "/b4.svg",
  },
  {
    id: 2,
    title: "Predictive Analytics",
    description: "ML-powered predictions for confidence scores, human review needs, and policy optimization.",
    className: "lg:col-span-3 md:col-span-3 md:row-span-2",
    imgClassName: "",
    titleClassName: "justify-start",
    img: "",
    spareImg: "",
  },
  {
    id: 3,
    title: "OpenTelemetry Tracing",
    description: "Full distributed tracing with AI-specific semantic conventions for complete observability.",
    className: "lg:col-span-3 md:col-span-3 md:row-span-2",
    imgClassName: "",
    titleClassName: "justify-center",
    img: "",
    spareImg: "",
  },
  {
    id: 5,
    title: "Prompt Injection Detection",
    description: "Automatic detection and blocking of prompt injection attacks to keep your agents secure.",
    className: "lg:col-span-2 md:col-span-3 md:row-span-2",
    imgClassName: "absolute right-0 bottom-0 md:w-96 w-60",
    titleClassName: "justify-center md:justify-start lg:justify-center",
    img: "/b5.svg",
    spareImg: "/grid.svg",
  },
];

export const stats = [
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<50ms", label: "P95 Latency" },
  { value: "100%", label: "Audit Coverage" },
  { value: "SOC 2", label: "Compliant" },
];

export const features = [
  {
    id: 1,
    title: "Policy-Driven Decisions",
    desc: "Lelu applies Rego policies at action time so every tool call can be evaluated in real-time.",
    className: "md:col-span-2",
    thumbnail: "/exp1.svg",
  },
  {
    id: 2,
    title: "Human-in-the-Loop",
    desc: "High-risk actions are automatically paused and routed to human reviewers for ultimate safety.",
    className: "md:col-span-2",
    thumbnail: "/exp2.svg",
  },
  {
    id: 3,
    title: "Tamper-Proof Audit",
    desc: "Every single decision is captured immutably with confidence context and trace IDs for compliance.",
    className: "md:col-span-2",
    thumbnail: "/exp3.svg",
  },
  {
    id: 4,
    title: "Multi-Agent Delegation",
    desc: "Agent swarms can safely mint short-lived tokens to delegate restricted access to sub-agents.",
    className: "md:col-span-2",
    thumbnail: "/exp4.svg",
  },
];

export const decisions = [
  {
    id: 1,
    title: "Gated: DB Write Access",
    des: "Policy denied 'marketing-agent' from dropping high-value customer tables.",
    img: "/b1.svg",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg"],
    link: "/audit/1",
  },
  {
    id: 2,
    title: "Escalated: Refund Request",
    des: "Action 'payment:refund' > $1000 automatically routed to human reviewer.",
    img: "/b4.svg",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg"],
    link: "/audit/2",
  },
  {
    id: 3,
    title: "Allowed: Log Retrieval",
    des: "Short-lived JIT token minted for 'debug-agent' to read application logs safely.",
    img: "/grid.svg",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg"],
    link: "/audit/3",
  },
];

export const companies = [
  { id: 1, name: "cloudinary", img: "/cloud.svg", nameImg: "/cloudName.svg" },
  { id: 2, name: "appwrite", img: "/app.svg", nameImg: "/appName.svg" },
  { id: 3, name: "HOSTINGER", img: "/host.svg", nameImg: "/hostName.svg" },
  { id: 4, name: "stream", img: "/s.svg", nameImg: "/streamName.svg" },
  { id: 5, name: "docker.", img: "/dock.svg", nameImg: "/dockerName.svg" },
];

export const testimonials = [
  {
    quote: "Lelu has completely transformed how we secure our agent swarms. The policy-as-code approach is exactly what we needed.",
    name: "Alex River",
    title: "Director of Engineering, V-Security",
  },
  {
    quote: "Integrating Lelu into our LangChain workflows was seamless. Decisions are gated in milliseconds.",
    name: "Sarah Chen",
    title: "Senior AI Researcher, AgentX",
  },
  {
    quote: "The audit trail and confidence metadata have made SOC 2 compliance a breeze for our AI platform.",
    name: "David Kim",
    title: "CTO, SafeSwarm AI",
  },
];
