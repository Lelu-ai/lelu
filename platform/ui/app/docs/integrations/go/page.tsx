export default function DocsGoSDK() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-sm font-medium mb-6">
          Integrations
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">Go SDK</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          The Lelu Go SDK integrates with any Go-based AI agent, gRPC service, or HTTP handler.
          Sub-millisecond authorization via the local engine binary or the hosted API.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Installation</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`go get github.com/lelu-auth/lelu/sdk/go`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Basic usage</h2>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">agent.go</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`package main

import (
	"context"
	"fmt"
	"log"

	lelu "github.com/lelu-auth/lelu/sdk/go"
)

func main() {
	client := lelu.NewClient(lelu.Config{
		APIKey:  "lelu_sk_...",
		BaseURL: "https://lelu-ai.com", // or your self-hosted URL
	})

	decision, err := client.Authorize(context.Background(), lelu.AuthorizeRequest{
		Tool:    "delete_record",
		Context: "record_id=42",
	})
	if err != nil {
		log.Fatal(err)
	}

	switch decision.Decision {
	case lelu.Allow:
		fmt.Println("Proceeding with deletion")
		// execute action
	case lelu.Deny:
		fmt.Printf("Blocked: %s\\n", decision.Reason)
	case lelu.HumanReview:
		fmt.Printf("Awaiting approval: %s\\n", decision.RequestID)
	}
}`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">HTTP middleware</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            Gate entire HTTP handler groups using the Lelu middleware.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">server.go</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">{`import (
	"net/http"
	leluhttp "github.com/lelu-auth/lelu/sdk/go/middleware"
)

mux := http.NewServeMux()

// All routes under /api/agent require authorization
mux.Handle("/api/agent/", leluhttp.Guard(client, http.HandlerFunc(agentHandler)))

http.ListenAndServe(":8080", mux)`}</pre>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white mb-4">Local engine mode</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">
            For the lowest latency, run the Lelu engine sidecar and connect via Unix socket.
            Decisions are evaluated in-process with no network hop.
          </p>
          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">config</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300">{`client := lelu.NewClient(lelu.Config{
	SocketPath: "/run/lelu/engine.sock", // Unix socket to local engine
})`}</pre>
          </div>
        </section>
      </div>

      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a href="/docs/integrations/vercel-ai" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Previous: Vercel AI SDK
        </a>
        <a href="/docs/human-in-loop" className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Next: Human-in-the-loop
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}
