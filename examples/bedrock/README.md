# Lelu × Amazon Bedrock

Gate an **Amazon Bedrock** agent's tool calls on the model's *own verified
confidence* — not a number the agent makes up. When the model is sure, the
action runs; when it's hedging, Lelu blocks or escalates it.

## Why this matters

A Bedrock agent that's been prompt-injected or is simply uncertain will still
call your tools with total conviction. Lelu reads the **token log-probabilities**
from the Bedrock response, derives a confidence score the agent can't forge, and
gates the action on it.

## The flow

```
Bedrock InvokeModel ──▶ confidenceFrom.bedrock(response) ──▶ lelu.agentAuthorize()
   (token likelihoods)        (verified score, 0–1)            (allow / deny / review)
```

**1. Call your Bedrock model** (Cohere Command shown — `return_likelihoods: "ALL"`
surfaces per-token log-likelihoods):

```js
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });
const res = await bedrock.send(new InvokeModelCommand({
  modelId: "cohere.command-text-v14",
  contentType: "application/json",
  body: JSON.stringify({ prompt, max_tokens: 200, return_likelihoods: "ALL" }),
}));
const modelResponse = JSON.parse(new TextDecoder().decode(res.body));
```

**2. Derive a verified confidence score** (never let the agent supply it):

```js
import { LeluClient } from "lelu-agent-auth";
const confidence = LeluClient.confidenceFrom.bedrock(modelResponse); // 0–1, or null
```

**3. Authorize the tool call, gated on that confidence:**

```js
const decision = await lelu.agentAuthorize({
  actor: "invoice_bot",
  action: "approve_refunds",
  context: confidence !== null ? { confidence } : {}, // omit → MissingSignalMode
});
if (decision.decision !== "allow") throw new Error(decision.reason);
```

## Run it

```bash
# 1. start a local engine (no AWS account needed for the demo)
cd ../quickstart && ./demo.sh   # or run the engine yourself on :8088

# 2. run the example (uses a mocked Bedrock response so it works offline)
cd ../bedrock
npm install
node authorize-with-bedrock.mjs
```

Actual output:

```
confident refund : confidence=0.974 → allow — action authorized
uncertain refund: confidence=0.301 → deny — confidence 30% is below hard-deny threshold (50%) — request blocked
```

Same agent, same action — the **only** difference is how sure the model was, and
Lelu turned that into an allow vs. a block.

## Model support — the honest version

Bedrock fronts many model families, and token log-probs are **model-dependent**:

| Bedrock model | Log-probs? | What `confidenceFrom.bedrock` returns |
|---|---|---|
| Cohere Command | ✅ `token_likelihoods` | a verified score |
| Meta Llama / Titan / Nova | ⚠️ config-dependent | a score where present |
| **Anthropic Claude** | ❌ none | `null` |

When it returns `null` (Claude), **omit** `confidence` from the request — the
engine then applies its `MissingSignalMode` policy (default: deny) rather than
trusting a fabricated score. For Claude, derive confidence another way (e.g.
self-consistency sampling) and pass it through.

## Next

- Swap the mock `invokeBedrock` for the real `@aws-sdk/client-bedrock-runtime`
  call above.
- Tune the confidence thresholds in [../quickstart/policy.yaml](../quickstart/policy.yaml).
