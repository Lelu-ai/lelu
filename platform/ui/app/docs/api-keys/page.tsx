export default function ApiKeysPage() {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <h1>API Key Management</h1>
      
      <p className="lead">
        Learn how to generate, manage, and use API keys to authenticate with the Lelu Authorization Engine.
      </p>

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

      <h2>Generating API Keys</h2>

      <h3>Method 1: Using PowerShell Script (Recommended)</h3>
      <p>
        We provide a convenient PowerShell script that generates a key and stores it in Redis automatically.
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

      <h3>Method 3: Anonymous Beta Keys</h3>
      <p>
        For beta testing, you can generate anonymous keys through the web UI at{' '}
        <a href="/beta" className="text-blue-600 dark:text-blue-400 hover:underline">/beta</a>.
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
        <li><a href="/beta">Beta Access</a> - Try anonymous keys without signup</li>
      </ul>
    </div>
  );
}
