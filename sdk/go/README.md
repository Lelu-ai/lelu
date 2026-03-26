# Lelu Go SDK

Go client for [Lelu](https://github.com/lelu-auth/lelu) — confidence-aware authorization for AI agents.

**Author:** Abenezer Getachew

## Install

```bash
go get github.com/lelu-auth/lelu/sdk/go
```

Or run the public Lelu engine image:

```bash
docker pull abenezer0923/lelu-engine:latest
docker run --rm -p 8083:8080 abenezer0923/lelu-engine:latest
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

	lelu "github.com/lelu-auth/lelu/sdk/go"
)

func main() {
	ctx := context.Background()
	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: "https://lelu-engine.onrender.com",
		APIKey:  "lelu-dev-key",
	})

	decision, err := client.AgentAuthorize(ctx, lelu.AgentAuthRequest{
		Actor:      "invoice_bot",
		Action:     "approve_refunds",
		Confidence: 0.92,
		ActingFor:  "user_123",
	})
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("allowed:", decision.Allowed, "reason:", decision.Reason)
}
```

### Option 2: Run Locally

For development, you can run the engine locally:

```go
package main

import (
	"context"
	lelu "github.com/lelu-auth/lelu/sdk/go"
)

func main() {
	ctx := context.Background()
	client := lelu.NewClient(lelu.ClientConfig{
		BaseURL: "http://localhost:8080",
		APIKey:  "lelu-dev-key",
	})
	
	// ... rest of your code
}
```

Start the local engine with Docker:

```bash
docker compose up -d
```

## API

- `Authorize(ctx, req)` — human authorization via `/v1/authorize`
- `AgentAuthorize(ctx, req)` — confidence-aware agent authorization via `/v1/agent/authorize`
- `MintToken(ctx, req)` — mint JIT tokens via `/v1/tokens/mint`
- `RevokeToken(ctx, tokenID)` — revoke token via `DELETE /v1/tokens/{tokenID}`
- `IsHealthy(ctx)` — health check via `/healthz`

## License

MIT
