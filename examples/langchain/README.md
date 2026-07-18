# Secure plain LangChain tools with Lelu

LangChain tools execute real code: refunds, database writes, messages, scripts.
This example wraps a plain `StructuredTool` with a small policy-enforcement
point that calls `lelu.authorize(...)` before LangChain invokes the underlying
function.

The tool only executes after Lelu returns `allow`. A `deny` raises a
`PermissionError`, and `human_review` returns a pending-approval message without
running the refund function.

## Run the demo

From the repository root:

```bash
cd examples/langchain
python -m pip install "../../sdk/python[langchain]"
python secure_refund_tool.py
```

The default demo authorizer does not call the hosted service, so it is
reproducible without credentials:

```text
Refund issued for invoice INV-1001 ($25.00): duplicate charge
Blocked by Lelu: demo policy: protected invoice
Awaiting human approval for request demo-human_review: demo policy: large refund needs approval
```

## Use a local Lelu engine

Start a local Lelu engine with a policy that grants `invoice_bot` the
`approve_refunds` action, then run:

```bash
LELU_EXAMPLE_MODE=live \
LELU_BASE_URL=http://localhost:8080 \
LELU_API_KEY=lelu-dev-key \
python secure_refund_tool.py
```

The important boundary is in `run_secured_tool`: it builds an `AuthorizeRequest`
with the tool action, actor, confidence, scope, and LangChain tool arguments,
then calls `lelu.authorize(...)`. The `StructuredTool` receives the arguments
only after that decision is `allow`.
