#!/usr/bin/env node

// Lelu Audit Log CLI
async function main() {
  try {
    // Dynamic import to handle ESM module
    const { createClient } = await import('@lelu-auth/lelu');
    
    const baseUrl = process.env.LELU_PLATFORM_URL || process.argv[2] || 'http://localhost:9091';
    const apiKey = process.env.LELU_PLATFORM_API_KEY || 'platform-dev-key';
    const limit = parseInt(process.env.LELU_AUDIT_LIMIT || process.argv[3] || '20', 10);
    
    const lelu = createClient({ baseUrl, apiKey });
    
    console.log(`Fetching audit log from ${baseUrl}...`);
    
    // First check if the service is reachable
    try {
      const healthResponse = await fetch(`${baseUrl}/healthz`, { 
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (!healthResponse.ok) {
        throw new Error('Service not healthy');
      }
    } catch (healthError) {
      console.log('❌ Lelu platform service is not running or not reachable');
      console.log('');
      console.log('To view audit logs, you need the Lelu platform service running.');
      console.log('');
      console.log('🚀 Quick start with Docker:');
      console.log('  git clone https://github.com/lelu-auth/lelu.git');
      console.log('  cd lelu');
      console.log('  docker compose up -d');
      console.log('  lelu audit-log  # Try again');
      console.log('');
      console.log('🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:');
      console.log('  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu audit-log');
      console.log('');
      console.log(`💡 Currently trying to connect to: ${baseUrl}`);
      process.exit(1);
    }
    
    const result = await lelu.listAuditEvents({ limit });
    
    if (!result.events.length) {
      console.log('📋 No audit events found.');
      console.log('');
      console.log('This could mean:');
      console.log('- No authorization requests have been made yet');
      console.log('- The audit data is stored elsewhere');
      console.log('- Filters are too restrictive');
      return;
    }
    
    console.log(`\n📊 Audit Log (${result.count} events, limit: ${limit})`);
    console.log('─'.repeat(80));
    
    for (const event of result.events) {
      const timestamp = new Date(event.timestamp).toLocaleString();
      const confidence = event.confidenceScore ? ` (confidence: ${event.confidenceScore.toFixed(2)})` : '';
      const resource = event.resource ? ` on ${JSON.stringify(event.resource)}` : '';
      
      console.log(`[${timestamp}] ${event.actor} → ${event.action}${resource}`);
      console.log(`  Decision: ${event.decision}${confidence}`);
      if (event.reason) {
        console.log(`  Reason: ${event.reason}`);
      }
      if (event.downgradedScope) {
        console.log(`  Downgraded scope: ${event.downgradedScope}`);
      }
      console.log(`  Trace ID: ${event.traceId}`);
      console.log('');
    }
    
    if (result.nextCursor > 0) {
      console.log(`📄 Use cursor ${result.nextCursor} to fetch more events.`);
    }
    
  } catch (err) {
    // Handle other types of errors
    if (err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed'))) {
      console.log('❌ Connection failed to Lelu platform service');
      console.log('');
      console.log('🔧 Troubleshooting steps:');
      console.log('1. Ensure the Lelu platform service is running');
      console.log('2. Check the platform URL is correct');
      console.log('3. Verify your network connection');
      console.log('4. Check if firewall is blocking the connection');
    } else {
      console.error('❌ Error fetching audit log:', err.message || err);
    }
    process.exit(1);
  }
}

main();