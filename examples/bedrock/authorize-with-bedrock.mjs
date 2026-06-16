// Lelu × Amazon Bedrock — gate a Bedrock agent's tool call on the model's own
// verified confidence.
//
//   node authorize-with-bedrock.mjs
//
// Requires a running Lelu engine (see ../quickstart) and `npm install
// lelu-agent-auth`. This script uses a MOCK Bedrock response so it runs without
// an AWS account; the real InvokeModel call is shown in `invokeBedrock` below.

import { createClient, LeluClient } from "lelu-agent-auth";

const lelu = createClient({
  baseUrl: process.env.LELU_BASE_URL ?? "http://localhost:8088",
  apiKey: process.env.LELU_API_KEY ?? "lelu-dev-key",
});

// ── 1. Get a response from a Bedrock model ────────────────────────────────────
//
// The REAL call for Cohere Command on Bedrock looks like this — note
// `return_likelihoods: "ALL"`, which is what surfaces per-token log-likelihoods:
//
//   import { BedrockRuntimeClient, InvokeModelCommand }
//     from "@aws-sdk/client-bedrock-runtime";
//   const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
//   const res = await bedrock.send(new InvokeModelCommand({
//     modelId: "cohere.command-text-v14",
//     contentType: "application/json",
//     body: JSON.stringify({ prompt, max_tokens: 200, return_likelihoods: "ALL" }),
//   }));
//   return JSON.parse(new TextDecoder().decode(res.body));
//
// For this offline demo we mock that response shape. `certain` toggles between a
// high-likelihood (confident) and low-likelihood (uncertain) generation.
function invokeBedrock({ certain }) {
  const likelihoods = certain
    ? [-0.02, -0.05, -0.01] // model was sure
    : [-1.2, -0.9, -1.5]; // model was hedging
  return {
    generations: [{ token_likelihoods: likelihoods.map((l) => ({ likelihood: l })) }],
  };
}

// ── 2. Derive a VERIFIED confidence score from the model output ───────────────
// Never let the agent self-report this — it comes from the model's logprobs.
// Returns null when the model exposes no token signal (e.g. Claude on Bedrock),
// in which case we omit it and the engine applies its MissingSignalMode policy.
function bedrockConfidence(modelResponse) {
  return LeluClient.confidenceFrom.bedrock(modelResponse);
}

// ── 3. Authorize the tool call, gated on that confidence ──────────────────────
async function run(label, { certain }) {
  const modelResponse = invokeBedrock({ certain });
  const confidence = bedrockConfidence(modelResponse);

  const decision = await lelu.agentAuthorize({
    actor: "invoice_bot",
    action: "approve_refunds",
    context: confidence !== null ? { confidence } : {},
  });

  const conf = confidence === null ? "none (MissingSignalMode)" : confidence.toFixed(3);
  console.log(`${label}: confidence=${conf} → ${decision.decision} — ${decision.reason}`);
}

await run("confident refund ", { certain: true });
await run("uncertain refund", { certain: false });
