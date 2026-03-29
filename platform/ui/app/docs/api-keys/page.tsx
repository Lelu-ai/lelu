export default function ApiKeysPage() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1>API Key Management</h1>
      
      <p className="lead">
        Learn how to generate, manage, and use API keys to authenticate with the Lelu Authorization Engine.
      </p>

      <div className="not-prose mb-8">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2 mt-0">Get Your Free Beta API Key</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                No registration required! Generate an anonymous API key instantly and start testing Lelu in under 60 seconds.
              </p>
              <a 
                href="/api-key" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors no-underline"
              >
                Generate API Key
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <h2>Overview</h2>
      <p>
        Lelu uses API keys for authentication. Each API key is associated with a tenant and environment (test or live).
        Keys are stored securely in Redis and can be revoked at any time.
      </p>

      <h2>Key Formats</h2>
      <div className="not-prose">
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
          <div>
            <code className="text-sm font-mono text-blue-600 dark:text-blue-400">lelu_test_*</code>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Test/Development keys</span>
          </div>
          <div>
            <code className="text-sm font-mono text-green-600 dark:text-green-400">lelu_live_*</code>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Production keys</span>
          </div>
          <div>
            <code className="text-sm font-mono text-purple-600 dark:text-purple-400">lelu_anon_*</code>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">Anonymous beta keys (30-day expiration)</span>
          </div>
        </div>
      </div>

      <h2>Getting API Keys</h2>

      <h3>Option 1: Anonymous API Key (Recommended for Testing)</h3>
      <p>
        The fastest way to get started! Visit the <a href="/api-key">API key page</a> to generate an anonymous API key instantly:
      </p>
      <ul>
        <li>✅ No registration or email required</li>
        <li>✅ Instant generation (under 5 seconds)</li>
        <li>✅ 500 requests per day</li>
        <li>✅ Perfect for testing and development</li>
        <li>✅ 30-day expiration (extends with use)</li>
      </ul>

      <h3>Option 2: Using PowerShell Script (Self-Hosted)</h3>
      <p>
        For self-hosted deployments, we provide a convenient PowerShell script that generates a key and stores it in Redis automatically.
      </p>

      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Run the generation script
./generate-api-key.ps1

# The script will:
# 1. Generate a secure random API key
# 2. Store it in Redis
# 3. Update your .env file
# 4. Display the key for immediate use`}</code>
        </pre>
      </div>

      <h3>Method 2: Using Redis CLI</h3>
      <p>
        You can manually create keys using the Redis CLI if needed.
      </p>

      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Generate a random key (use your preferred method)
$randomBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
$randomPart = [Convert]::ToBase64String($randomBytes).Replace('+','-').Replace('/','_').TrimEnd('=')
$apiKey = "lelu_test_$randomPart"

# Store in Redis
docker exec lelu-redis redis-cli SET "lelu:apikey:$apiKey" '{"tenant_id":"your_tenant","key_id":"key123","created_at":"2026-03-27T00:00:00Z","revoked":false,"name":"My Key","env":"test"}'`}</code>
        </pre>
      </div>

      <h3>Method 3: Anonymous API Keys</h3>
      <p>
        For testing, you can generate anonymous keys through the web UI at{' '}
        <a href="/api-key" className="text-blue-600 dark:text-blue-400 hover:underline">/api-key</a>.
        These keys:
      </p>
      <ul>
        <li>Expire after 30 days</li>
        <li>Are IP-bound on first use</li>
        <li>Have rate limits (5 per hour, 10 per day per IP)</li>
        <li>Don't require account creation</li>
      </ul>

      <h2>Using API Keys</h2>

      <h3>HTTP Header Authentication</h3>
      <p>
        Include your API key in the <code>X-API-Key</code> header with every request:
      </p>

      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# PowerShell
Invoke-WebRequest -Uri "http://localhost:8083/v1/authorize" \\
  -Headers @{"X-API-Key"="lelu_test_YOUR_KEY_HERE"} \\
  -Method POST \\
  -Body '{"principal":{"id":"user_123"},"resource":{"type":"document"},"action":"read"}'

# cURL
curl -H "X-API-Key: lelu_test_YOUR_KEY_HERE" \\
  -X POST http://localhost:8083/v1/authorize \\
  -d '{"principal":{"id":"user_123"},"resource":{"type":"document"},"action":"read"}'`}</code>
        </pre>
      </div>

      <h3>SDK Configuration</h3>
      <p>
        When using the SDKs, set the API key in your environment or configuration:
      </p>

      <div className="not-prose space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">TypeScript/JavaScript</h4>
          <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
            <code>{`import { LeluClient } from '@lelu/sdk';

const client = new LeluClient({
  baseUrl: 'http://localhost:8083',
  apiKey: 'lelu_test_YOUR_KEY_HERE'
});`}</code>
          </pre>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Python</h4>
          <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
            <code>{`from auth_pe import LeluClient

client = LeluClient(
    base_url="http://localhost:8083",
    api_key="lelu_test_YOUR_KEY_HERE"
)`}</code>
          </pre>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Go</h4>
          <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
            <code>{`import "github.com/lelu/sdk/go"

client := lelu.NewClient(lelu.Config{
    BaseURL: "http://localhost:8083",
    APIKey:  "lelu_test_YOUR_KEY_HERE",
})`}</code>
          </pre>
        </div>
      </div>

      <h2>Testing Your API Key</h2>
      <p>
        Use the provided test script to verify your API key works correctly:
      </p>

      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Test with default key from .env
./test-api-key.ps1

# Test with specific key
./test-api-key.ps1 -ApiKey "lelu_test_YOUR_KEY_HERE"`}</code>
        </pre>
      </div>

      <h2>Key Management</h2>

      <h3>Listing Keys for a Tenant</h3>
      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# List all keys in Redis
docker exec lelu-redis redis-cli KEYS "lelu:apikey:*"

# Get key metadata
docker exec lelu-redis redis-cli GET "lelu:apikey:lelu_test_YOUR_KEY"`}</code>
        </pre>
      </div>

      <h3>Revoking Keys</h3>
      <p>
        To revoke a key, update its metadata to set <code>revoked: true</code>:
      </p>

      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Get current metadata
$metadata = docker exec lelu-redis redis-cli GET "lelu:apikey:lelu_test_YOUR_KEY"

# Update to revoked (modify the JSON)
$revokedMetadata = $metadata -replace '"revoked":false', '"revoked":true'

# Store updated metadata
docker exec lelu-redis redis-cli SET "lelu:apikey:lelu_test_YOUR_KEY" $revokedMetadata`}</code>
        </pre>
      </div>

      <h3>Deleting Keys</h3>
      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Permanently delete a key
docker exec lelu-redis redis-cli DEL "lelu:apikey:lelu_test_YOUR_KEY"`}</code>
        </pre>
      </div>

      <h2>Security Best Practices</h2>
      <div className="not-prose">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mt-0">Important Security Notes</h3>
          <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200 mb-0">
            <li>✓ Never commit API keys to version control</li>
            <li>✓ Use environment variables for key storage</li>
            <li>✓ Rotate keys regularly in production</li>
            <li>✓ Use test keys for development, live keys for production</li>
            <li>✓ Revoke keys immediately if compromised</li>
            <li>✓ Monitor key usage through audit logs</li>
            <li>✓ Use different keys for different services/environments</li>
          </ul>
        </div>
      </div>

      <h2>Troubleshooting</h2>

      <h3>Error: "unauthorized: invalid or missing API key"</h3>
      <p>This error occurs when:</p>
      <ul>
        <li>No API key is provided in the request</li>
        <li>The API key format is invalid</li>
        <li>The key doesn't exist in Redis</li>
        <li>The key has been revoked</li>
      </ul>
      <p>
        <strong>Solution:</strong> Verify your key exists in Redis and is not revoked. Generate a new key if needed.
      </p>

      <h3>Error: "rate limit exceeded"</h3>
      <p>
        Anonymous keys have rate limits. If you hit the limit, wait for the time window to reset or use a regular API key.
      </p>

      <h3>Redis Connection Issues</h3>
      <p>
        Ensure Redis is running and accessible:
      </p>
      <div className="not-prose">
        <pre className="bg-slate-900 text-slate-50 rounded-lg p-4 overflow-x-auto">
          <code>{`# Check Redis status
docker-compose ps redis

# Test Redis connection
docker exec lelu-redis redis-cli PING`}</code>
        </pre>
      </div>

      <h2>Next Steps</h2>
      <ul>
        <li><a href="/docs/quickstart">Quickstart Guide</a> - Get started with your first authorization request</li>
        <li><a href="/docs/concepts/api">API Reference</a> - Learn about all available endpoints</li>
        <li><a href="/docs/audit-trail">Audit Trail</a> - Monitor API key usage</li>
        <li><a href="/api-key">Get API Key</a> - Generate anonymous keys without signup</li>
      </ul>
    </div>
  );
}
