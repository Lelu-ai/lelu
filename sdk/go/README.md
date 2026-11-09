# Lelu Go SDK

Go client for [Lelu](https://github.com/lelu-ai/lelu) — confidence-aware authorization for AI agents.

**Author:** Abenezer Getachew

## Install

```bash
go get github.com/lelu-ai/lelu/sdk/go
```

## Quick Start

### Option 1: Use Hosted Engine (Recommended)

Connect to the hosted Lelu engine for instant setup:

```go
package main

import (
	"context"
	"fmt"
	"log"
	"os"

	lelu "github.com/lelu-ai/lelu/sdk/go"
)

func main() {
	ctx := context.Background()
	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: "https://lelu-ai.com",
		APIKey:  os.Getenv("LELU_API_KEY"), // key from lelu-ai.com/api-key
	})

	decision, err := client.Authorize(ctx, lelu.AuthorizeRequest{
		Tool: "approve_refunds",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("decision:", decision.Decision, "allowed:", decision.Allowed(), "reason:", decision.Reason)
}
```

### Option 2: Run Locally

For development, you can run the engine locally:

```go
package main

import (
	"context"
	lelu "github.com/lelu-ai/lelu/sdk/go"
)

func main() {
	ctx := context.Background()
	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: "http://localhost:8083", // engine port published by docker compose
		APIKey:  "lelu-dev-key",          // compose default; use your API_KEY if set
	})
	
	// ... rest of your code
}
```

Start the local engine with Docker (from the repo root):

```bash
docker compose up -d
```

Compose publishes the engine on host port `8083` (it listens on `8080` inside
the container).

> **Note:** `MintToken`, `RevokeToken` and `DelegateScope` call the engine's
> `/v1/...` routes and work against a local engine. `Authorize`,
> `AgentAuthorize` and `IsHealthy` currently call the hosted platform's
> `/api/v1/authorize` and `/api/config-check` routes, which the engine itself
> does not serve (it exposes `/v1/agent/authorize` and `/healthz`).

## API

- `Authorize(ctx, req)` — check whether an agent may call a tool, via the hosted platform's `POST /api/v1/authorize`
- `AgentAuthorize(ctx, req)` — deprecated wrapper around `Authorize`; only `Action` is sent (as the tool) — `Actor`, `Confidence` and `ActingFor` are recorded on the trace span, not sent
- `MintToken(ctx, req)` — mint JIT tokens via `/v1/tokens/mint`
- `RevokeToken(ctx, tokenID)` — revoke token via `DELETE /v1/tokens/{tokenID}`
- `IsHealthy(ctx)` — reachability check via the hosted platform's `GET /api/config-check`

## License

MIT
