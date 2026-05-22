export default function DocsDocker() {
  return (
    <div className="max-w-3xl">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-sm font-medium mb-6">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 7h-9" />
            <path d="M14 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h9" />
            <path d="M15 7v10" />
            <path d="M20 7v10a2 2 0 0 1-2 2h-2" />
          </svg>
          Docker Deployment
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Docker Deployment Guide
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Deploy Lelu using Docker containers for development and production environments. All
          components are available as pre-built images on Docker Hub.
        </p>
      </div>

      <div className="space-y-12">
        {/* Available Images */}
        <section>
          <h2
            id="available-images"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6"
          >
            Available Docker Images
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-blue-600 dark:text-blue-400"
                  >
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Engine</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Core authorization engine with policy evaluation
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                leluauth/lelu-engine:latest
              </code>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-green-100 dark:bg-green-500/10 flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-green-600 dark:text-green-400"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Platform</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Control plane API for policies and audit logs
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                leluauth/lelu-platform:latest
              </code>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-purple-600 dark:text-purple-400"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">UI</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Web dashboard for monitoring and management
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                leluauth/lelu-ui:latest
              </code>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-orange-600 dark:text-orange-400"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-zinc-900 dark:text-white">MCP</h3>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Model Context Protocol server
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                leluauth/lelu-mcp:latest
              </code>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <p className="mb-2">
                <strong>Multi-Architecture Support:</strong> All images support both linux/amd64 and
                linux/arm64 architectures.
              </p>
              <p>
                Docker automatically pulls the correct architecture for your system (Intel/AMD or
                Apple Silicon/ARM).
              </p>
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section>
          <h2
            id="quick-start"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6"
          >
            Quick Start
          </h2>

          <div className="mb-6">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              You can run Lelu using Docker in two ways:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Option 1: Build from Source (Recommended)
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Clone the repository and build Docker images locally. Best for development and
                  customization.
                </p>
              </div>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                  Option 2: Use Pre-built Images
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Pull pre-built images from Docker Hub. Quick start for production deployments.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Option 1: Build from Source */}
            <div className="border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 bg-blue-50/50 dark:bg-blue-900/10">
              <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-sm font-bold">
                  1
                </span>
                Build from Source
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Step 1: Clone Repository
                  </h4>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                      {`git clone https://github.com/lelu-auth/lelu.git
cd lelu`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Step 2: Start Services
                  </h4>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                      {`# Build and start all services
docker compose up -d --build

# Or without building (if images exist)
docker compose up -d`}
                    </pre>
                  </div>
                </div>

                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Note:</strong> The{" "}
                    <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded font-mono">
                      docker-compose.yml
                    </code>{" "}
                    file automatically builds images from local Dockerfiles in the repository.
                  </p>
                </div>
              </div>
            </div>

            {/* Option 2: Pre-built Images */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-600 text-white text-sm font-bold">
                  2
                </span>
                Use Pre-built Images
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                    Step 1: Download Production Compose File
                  </h4>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                      {`curl -O https://raw.githubusercontent.com/lelu-auth/lelu/main/docker-compose.production.yml`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                    Step 2: Pull Images (Optional)
                  </h4>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                      {`docker compose -f docker-compose.production.yml pull`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
                    Step 3: Start Services
                  </h4>
                  <div className="bg-zinc-900 dark:bg-black rounded-lg border border-zinc-800 dark:border-white/10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                      <span className="text-xs text-zinc-500 font-mono">terminal</span>
                    </div>
                    <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                      {`docker compose -f docker-compose.production.yml up -d`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">
              ✅ Services Available
            </h4>
            <div className="text-sm text-green-700 dark:text-green-400 space-y-1">
              <div>
                • <strong>Web UI:</strong>{" "}
                <a
                  href="http://localhost:3002"
                  className="underline hover:text-green-900 dark:hover:text-green-200"
                >
                  http://localhost:3002
                </a>
              </div>
              <div>
                • <strong>Engine API:</strong> http://lelu-engine-666101080696.us-central1.run.app
              </div>
              <div>
                • <strong>Platform API:</strong> http://localhost:9091
              </div>
              <div>
                • <strong>MCP Server:</strong> http://localhost:3003
              </div>
            </div>
          </div>
        </section>

        {/* Environment Variables */}
        <section>
          <h2
            id="environment-configuration"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6"
          >
            Environment Configuration
          </h2>

          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Create a{" "}
            <code className="text-sm px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              .env
            </code>{" "}
            file to customize your deployment:
          </p>

          <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
            <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
              <span className="text-xs text-zinc-500 font-mono">.env</span>
            </div>
            <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
              {`# Required: Generate secure keys
JWT_SIGNING_KEY=your_jwt_signing_key_here
API_KEY=your_api_key_here
PLATFORM_API_KEY=your_platform_api_key_here
POSTGRES_PASSWORD=your_secure_postgres_password

# Optional: Incident webhooks
INCIDENT_WEBHOOK_URL=https://hooks.slack.com/your-webhook
INCIDENT_WEBHOOK_SLACK_MODE=true

# Optional: Rate limiting
TENANT_AUTH_RATE_LIMIT=100
TENANT_MINT_RATE_LIMIT=50

# Optional: Risk thresholds
RISK_ALLOW_THRESHOLD_LOW=0.30
RISK_REVIEW_THRESHOLD_LOW=0.55`}
            </pre>
          </div>

          <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Security:</strong> Generate secure keys using{" "}
              <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">
                openssl rand -base64 32
              </code>{" "}
              and never commit them to version control.
            </div>
          </div>
        </section>

        {/* Production Deployment */}
        <section>
          <h2
            id="production-deployment"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6"
          >
            Production Deployment
          </h2>

          <div className="space-y-6">
            <div>
              <h3
                id="resource-requirements"
                className="text-lg font-semibold text-zinc-900 dark:text-white mb-3"
              >
                Resource Requirements
              </h3>
              <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white mb-2">
                      Minimum (Development)
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-400 space-y-1">
                      <div>• CPU: 2 cores</div>
                      <div>• RAM: 4GB</div>
                      <div>• Storage: 10GB</div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-zinc-900 dark:text-white mb-2">
                      Recommended (Production)
                    </div>
                    <div className="text-zinc-600 dark:text-zinc-400 space-y-1">
                      <div>• CPU: 4+ cores</div>
                      <div>• RAM: 8GB+</div>
                      <div>• Storage: 50GB+ SSD</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3
                id="health-checks"
                className="text-lg font-semibold text-zinc-900 dark:text-white mb-3"
              >
                Health Checks
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                All containers include health checks. Monitor service status:
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# Check service health
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f engine`}
                </pre>
              </div>
            </div>

            <div>
              <h3
                id="backup-persistence"
                className="text-lg font-semibold text-zinc-900 dark:text-white mb-3"
              >
                Backup & Persistence
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                Data is persisted in Docker volumes. Back up your data regularly:
              </p>
              <div className="bg-zinc-900 dark:bg-black rounded-xl border border-zinc-800 dark:border-white/10 overflow-hidden">
                <div className="px-4 py-2 border-b border-zinc-800 dark:border-white/10 bg-zinc-950 dark:bg-white/5">
                  <span className="text-xs text-zinc-500 font-mono">terminal</span>
                </div>
                <pre className="p-4 font-mono text-sm text-zinc-300 overflow-x-auto">
                  {`# Backup PostgreSQL data
docker exec lelu-postgres pg_dump -U lelu lelu > backup.sql

# Backup Redis data
docker exec lelu-redis redis-cli BGSAVE`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* Troubleshooting */}
        <section>
          <h2
            id="troubleshooting"
            className="text-2xl font-semibold text-zinc-900 dark:text-white mb-6"
          >
            Troubleshooting
          </h2>

          <div className="space-y-4">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Services won't start
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Check if ports are already in use:
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                netstat -tulpn | grep :8083
              </code>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Database connection errors
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Ensure PostgreSQL is healthy before starting other services:
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                docker-compose -f docker-compose.production.yml up postgres
              </code>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
              <h4 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Permission denied errors
              </h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                Check file permissions for mounted volumes:
              </p>
              <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono">
                sudo chown -R 1000:1000 ./config
              </code>
            </div>
          </div>
        </section>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center pt-12 mt-12 border-t border-zinc-200 dark:border-white/10">
        <a
          href="/docs/installation"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Previous: Installation
        </a>
        <a
          href="/docs/concepts/architecture"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Next: Architecture
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}
