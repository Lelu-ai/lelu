<p align="center">
  <img src="https://raw.githubusercontent.com/lelu-auth/lelu/main/platform/ui/public/lelu-mark.svg" alt="Lelu" width="64" />
</p>

<h1 align="center">Lelu</h1>

<p align="center">
  <strong>Open source authorization engine for AI agents.</strong><br/>
  Confidence-aware gating · Human-in-the-loop review · Policy-as-code · Full audit trail
</p>

<p align="center">
  <a href="https://lelu-ai.com/docs/quickstart">Quickstart</a> ·
  <a href="https://lelu-ai.com/docs">Docs</a> ·
  <a href="https://github.com/lelu-auth/lelu/discussions">Discussions</a> ·
  <a href="https://lelu-ai.com">lelu-ai.com</a>
</p>

---

## The problem

Every team shipping AI agents is solving the same authorization problem from scratch. Existing tools (OPA, Casbin, AWS AVP) were not built for agents — they don't understand confidence signals, can't pause for human review, and have no concept of autonomous action chains.

**Lelu is the missing layer.** It sits inside your agent and makes every action authorization-aware — without changing how you build.

---

## How it works

```typescript
import { createClient } from "lelu-agent-auth";

const lelu = createClient({ apiKey: process.env.LELU_API_KEY });

const decision = await lelu.agentAuthorize({
  actor: "billing-agent",
  action: "refund:process",
  resource: "order/ord_abc123",
  context: { confidence: 0.85, amount_usd: 250 },
});

if (decision.allowed) {
  await processRefund(orderId);
} else if (decision.requiresHumanReview) {
  await notifyReviewer(decision.reviewId);
} else {
  log("denied", decision.reason);
}
```

One call. Three outcomes. Every decision logged.

---

## Get started

```bash
npm install lelu-agent-auth
```

Get an API key at [lelu-ai.com/api-key](https://lelu-ai.com/api-key). Full docs at [lelu-ai.com/docs](https://lelu-ai.com/docs).

---

## Contributing

MIT licensed and built in the open. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

Good first issues are labeled [`good first issue`](https://github.com/lelu-auth/lelu/labels/good%20first%20issue).

---

## License

MIT © [Lelu](https://lelu-ai.com)
