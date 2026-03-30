# Anonymous Beta Access - Zero Registration Workflow

## Overview

During the beta period, developers can access the Lelu hosted engine completely anonymously without creating accounts. This reduces friction and allows instant testing.

## How It Works

### 1. Developer Visits Beta Page
- Go to `lelu-ai.com/beta`
- Click "Generate Beta Key"
- Instantly receive an anonymous API key
- Key is saved to browser localStorage
- Copy key to `.env` file

### 2. Key Format
- **Format**: `lelu_anon_[8char]_[32char]`
- **Example**: `lelu_anon_a1b2c3d4_xyz789abc123def456ghi789jkl012mno345`
- **Tenant ID**: Auto-generated from key (e.g., `anon_a1b2c3d4`)

### 3. Rate Limiting Strategy

#### IP-Based Protection
- **Key Generation**: Max 5 keys per IP per hour
- **Abuse Prevention**: Block IPs that generate 50+ keys per day

#### Anonymous Key Quotas (Per Key)
- **Daily Limit**: 500 authorization requests per day
- **Per-Minute Limit**: 10 requests per minute
- **Token Mints**: 50 per day
- **Resets**: Daily at midnight UTC

#### IP + Key Binding
- First request from a key binds it to the source IP
- Subsequent requests from different IPs are rate-limited more aggressively
- Prevents key sharing abuse

### 4. Security Measures

#### Abuse Prevention
1. **IP Tracking**: Redis stores IP → key count
2. **Rate Limiting**: Strict limits on anonymous keys
3. **Monitoring**: Prometheus metrics for abuse detection
4. **Auto-Ban**: IPs exceeding thresholds are blocked
5. **Cleanup**: Anonymous keys expire after 30 days of inactivity

#### Data Protection
- No personal information collected
- No email required
- No tracking beyond abuse prevention
- Keys can be deleted anytime

## Implementation Architecture

### Frontend (Next.js)
```
/beta
  - Generate anonymous key button
  - Display key with copy button
  - Save to localStorage
  - Show usage stats
  - Quick start code examples
```

### Backend API
```
POST /api/beta/generate
  - Check IP rate limit
  - Generate anonymous key
  - Store in Redis with IP binding
  - Return key + tenant_id

GET /api/beta/usage
  - Check key usage stats
  - Return quota remaining
```

### Engine Middleware
```
- Detect anonymous keys (lelu_anon_*)
- Apply stricter rate limits
- Track IP binding
- Log usage for monitoring
```

## Usage Example

```typescript
// 1. Visit lelu-ai.com/beta and generate key
// 2. Copy key to .env
LELU_API_KEY=lelu_anon_a1b2c3d4_xyz789abc123def456ghi789jkl012mno345

// 3. Use in code
const lelu = new LeluClient({
  apiKey: process.env.LELU_API_KEY
  // Automatically connects to hosted engine
});

const decision = await lelu.agentAuthorize({
  actor: "test_bot",
  action: "read_data",
  resource: {},
  context: { confidence: 0.95 }
});
```

## Monitoring Dashboard

### Metrics Tracked
- Anonymous keys generated per hour
- Active anonymous keys
- Requests per anonymous key
- IP-based abuse attempts
- Quota exceeded events
- Key expiration rate

### Alerts
- Spike in key generation from single IP
- Unusual request patterns
- Quota abuse attempts
- High error rates

## Transition to Registered Account

When ready, developers can:
1. Create a registered account
2. Migrate policies and data
3. Get higher quotas
4. Access advanced features
5. Keep anonymous key for testing

## Benefits

### For Developers
- ✅ Zero friction onboarding
- ✅ No email required
- ✅ Instant access
- ✅ Privacy-focused
- ✅ Perfect for testing

### For Lelu
- ✅ Lower barrier to entry
- ✅ Faster adoption
- ✅ Real usage data
- ✅ Cost-controlled
- ✅ Easy to monitor

## Limitations

### Anonymous Keys
- Lower quotas than registered accounts
- 30-day expiration with inactivity
- No data persistence guarantees
- Limited support
- No SLA

### Upgrade Benefits
Registered accounts get:
- 10x higher quotas
- Persistent data
- Priority support
- Advanced features
- Team collaboration
- Custom policies

## Cost Protection

### Daily Budget
- 500 requests/key × 1000 active keys = 500K requests/day
- At $0.01 per 1K requests = $5/day maximum
- Monthly cap: ~$150 for anonymous beta

### Abuse Prevention
- IP-based blocking
- Automatic key expiration
- Rate limit enforcement
- Monitoring and alerts

## Beta Timeline

### Phase 1: Soft Launch (Week 1-2)
- Limited to 100 anonymous keys
- Monitor for abuse
- Gather feedback
- Adjust limits

### Phase 2: Public Beta (Week 3-8)
- Increase to 1000 active keys
- Add usage dashboard
- Implement auto-cleanup
- Optimize rate limits

### Phase 3: Transition (Week 9-12)
- Encourage account creation
- Offer migration tools
- Maintain anonymous access
- Introduce paid tiers

## FAQ

**Q: Do I need to create an account?**
A: No! During beta, you can use anonymous keys without any registration.

**Q: How long does my key last?**
A: 30 days from last use. Active keys don't expire.

**Q: Can I generate multiple keys?**
A: Yes, but limited to 5 per hour from your IP.

**Q: What happens when I hit the limit?**
A: You'll get a 429 error. Wait for the daily reset or create a registered account for higher limits.

**Q: Is my data safe?**
A: We don't collect personal information. Keys are anonymous and can be deleted anytime.

**Q: Can I upgrade later?**
A: Yes! Create an account and migrate your policies seamlessly.
