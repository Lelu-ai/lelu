#!/usr/bin/env node

// Lelu Policies CLI
async function main() {
  try {
    // Dynamic import to handle ESM module
    const { createClient } = await import('@lelu-auth/lelu');
    
    const baseUrl = process.env.LELU_PLATFORM_URL || 'http://localhost:9091';
    const apiKey = process.env.LELU_PLATFORM_API_KEY || 'platform-dev-key';
    const tenantId = process.env.LELU_TENANT_ID || 'default';
    
    const command = process.argv[2] || 'list';
    const policyName = process.argv[3];
    const filePath = process.argv[4];
    
    const lelu = createClient({ baseUrl, apiKey });
    
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
      console.log('To manage policies, you need the Lelu platform service running.');
      console.log('');
      console.log('🚀 Quick start with Docker:');
      console.log('  git clone https://github.com/lelu-auth/lelu.git');
      console.log('  cd lelu');
      console.log('  docker compose up -d');
      console.log('  lelu policies list  # Try again');
      console.log('');
      console.log('🌐 Or set LELU_PLATFORM_URL to point to your hosted instance:');
      console.log('  LELU_PLATFORM_URL=https://your-lelu-platform.com lelu policies list');
      console.log('');
      console.log(`💡 Currently trying to connect to: ${baseUrl}`);
      process.exit(1);
    }
    
    switch (command) {
      case 'list':
        await listPolicies(lelu, tenantId);
        break;
      case 'get':
        if (!policyName) {
          console.log('❌ Policy name is required');
          console.log('Usage: lelu policies get <policy-name>');
          process.exit(1);
        }
        await getPolicy(lelu, policyName, tenantId);
        break;
      case 'set':
        if (!policyName || !filePath) {
          console.log('❌ Policy name and file path are required');
          console.log('Usage: lelu policies set <policy-name> <file-path>');
          process.exit(1);
        }
        await setPolicy(lelu, policyName, filePath, tenantId);
        break;
      case 'delete':
        if (!policyName) {
          console.log('❌ Policy name is required');
          console.log('Usage: lelu policies delete <policy-name>');
          process.exit(1);
        }
        await deletePolicy(lelu, policyName, tenantId);
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        console.log(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
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
      console.error('❌ Error:', err.message || err);
    }
    process.exit(1);
  }
}

async function listPolicies(lelu, tenantId) {
  console.log(`Fetching policies from ${lelu.baseUrl}...`);
  
  const result = await lelu.listPolicies({ tenantId });
  
  if (!result.policies.length) {
    console.log('📋 No policies found.');
    console.log('');
    console.log('This could mean:');
    console.log('- No policies have been created yet');
    console.log('- You are looking at the wrong tenant');
    console.log('- The policies are stored elsewhere');
    return;
  }
  
  console.log(`\n📊 Policies (${result.count} total)`);
  console.log('─'.repeat(80));
  
  for (const policy of result.policies) {
    const createdAt = new Date(policy.createdAt).toLocaleString();
    const updatedAt = new Date(policy.updatedAt).toLocaleString();
    
    console.log(`📄 ${policy.name} (v${policy.version})`);
    console.log(`  ID: ${policy.id}`);
    console.log(`  Created: ${createdAt}`);
    console.log(`  Updated: ${updatedAt}`);
    console.log(`  Content: ${policy.content.length} characters`);
    console.log('');
  }
}

async function getPolicy(lelu, name, tenantId) {
  console.log(`Fetching policy "${name}"...`);
  
  try {
    const policy = await lelu.getPolicy({ name, tenantId });
    
    console.log(`\n📄 Policy: ${policy.name} (v${policy.version})`);
    console.log('─'.repeat(80));
    console.log(`ID: ${policy.id}`);
    console.log(`Tenant: ${policy.tenantId}`);
    console.log(`Created: ${new Date(policy.createdAt).toLocaleString()}`);
    console.log(`Updated: ${new Date(policy.updatedAt).toLocaleString()}`);
    console.log(`HMAC: ${policy.hmacSha256}`);
    console.log('');
    console.log('Content:');
    console.log('─'.repeat(40));
    console.log(policy.content);
    
  } catch (err) {
    if (err.status === 404) {
      console.log(`❌ Policy "${name}" not found`);
      console.log('');
      console.log('💡 Use "lelu policies list" to see available policies');
    } else {
      throw err;
    }
  }
}

async function setPolicy(lelu, name, filePath, tenantId) {
  const fs = await import('fs/promises');
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    console.log(`Setting policy "${name}" from ${filePath}...`);
    
    const policy = await lelu.upsertPolicy({
      name,
      content,
      tenantId
    });
    
    console.log(`✅ Policy "${name}" saved successfully`);
    console.log(`  ID: ${policy.id}`);
    console.log(`  Version: ${policy.version}`);
    console.log(`  Updated: ${new Date(policy.updatedAt).toLocaleString()}`);
    console.log(`  Content: ${content.length} characters`);
    
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`❌ File not found: ${filePath}`);
    } else if (err.code === 'EACCES') {
      console.log(`❌ Permission denied reading file: ${filePath}`);
    } else {
      throw err;
    }
  }
}

async function deletePolicy(lelu, name, tenantId) {
  console.log(`Deleting policy "${name}"...`);
  
  try {
    const result = await lelu.deletePolicy({ name, tenantId });
    
    if (result.deleted) {
      console.log(`✅ Policy "${name}" deleted successfully`);
    } else {
      console.log(`❌ Failed to delete policy "${name}"`);
    }
    
  } catch (err) {
    if (err.status === 404) {
      console.log(`❌ Policy "${name}" not found`);
      console.log('');
      console.log('💡 Use "lelu policies list" to see available policies');
    } else {
      throw err;
    }
  }
}

function showHelp() {
  console.log(`
Lelu Policies CLI

Usage:
  lelu policies list                    List all policies
  lelu policies get <name>              Get a specific policy
  lelu policies set <name> <file>       Create or update a policy from file
  lelu policies delete <name>           Delete a policy
  lelu policies help                    Show this help

Environment Variables:
  LELU_PLATFORM_URL       Platform API URL (default: http://localhost:9091)
  LELU_PLATFORM_API_KEY   Platform API key (default: platform-dev-key)
  LELU_TENANT_ID          Tenant ID (default: default)

Examples:
  lelu policies list                           # List all policies
  lelu policies get auth                       # View the "auth" policy
  lelu policies set auth ./auth.rego           # Create/update auth policy from file
  lelu policies delete old-policy              # Delete a policy
  LELU_TENANT_ID=prod lelu policies list       # List policies for prod tenant
`);
}

main();