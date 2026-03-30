# API Key Purpose in Lelu Authorization Engine

## Overview

API keys in the Lelu project serve as the **primary authentication and tenant identification mechanism** for the authorization engine. They enable secure, multi-tenant access control while supporting both SaaS and self-hosted deployment modes.

## Core Purposes

### 1. **Authentication & Authorization**
API keys authenticate clients making requests to the authorization engine:

```
Client Request → API Key Validation → Tenant Identification → Authorization Decision
```

Without a valid API key, requests are rejected with `401 Unauthorized`.

### 2. **Multi-Tenant Isolation**
Each API key is mapped to a specific `tenant_id`, enabling:

- **Data Isolation**: Each tenant's authorization decisions, audit logs, and policies are kept separate
- **Resource Tracking**: Usage metrics are tracked per tenant
- **Security Boundaries**: One tenant cannot access another tenant's data

**Example Flow**:
```
API Key: lelu_test_abc123 → Tenant: tenant_dev_001
API Key: lelu_live_xyz789 → Tenant: customer_acme_corp
```

### 3. **Dual-Mode Architecture Support**

The system supports two deployment modes:

#### **SaaS Mode** (Hosted on Render/Cloud)
- Users get API keys from the hosted platform
- Keys enable access to the shared authorization engine
- Rate limiting and quotas prevent abuse
- Billing/usage tracking per tenant

```typescript
// Points to hosted SaaS instance
const client = new LeluClient({
  apiKey: "lelu_live_abc123..."  // Auto-routes to render.com
});
```

#### **Self-Hosted Mode** (Docker/On-Premise)
- Users generate their own API keys locally
- Keys authenticate against their own engine instance
- No external dependencies or billing

```typescript
// Points to local instance
const client = new LeluClient({
  apiKey: "lelu_test_local123",
  baseUrl: "http://localhost:8083"
});
```

### 4. **Rate Limiting & Quota Management**

API keys enable per-tenant rate limiting:

- **Free Tier**: 10,000 authorization requests/month
- **Paid Tiers**: Higher quotas based on subscription
- **Abuse Prevention**: Prevents single tenant from overwhelming the system
- **Fair Usage**: Ensures all tenants get reliable service

The engine tracks usage per API key/tenant and returns `429 Too Many Requests` when limits are exceeded.

### 5. **Environment Separation**

Different key prefixes separate environments:

- `lelu_test_*` - Development/testing keys (sandbox environment)
- `lelu_live_*` - Production keys (live environment)
- `lelu_anon_*` - Anonymous beta keys (temporary, IP-bound)

This prevents accidental production data access during development.

### 6. **Audit Trail & Compliance**

API keys enable comprehensive audit logging:

- **Who**: Which tenant made the request (via API key → tenant_id)
- **What**: What authorization decision was requested
- **When**: Timestamp of the request
- **Result**: Whether access was granted or denied

This is critical for:
- Security investigations
- Compliance requirements (SOC2, GDPR, etc.)
- Usage analytics
- Debugging authorization issues

### 7. **Anonymous Beta Access**

Special anonymous keys (`lelu_anon_*`) enable:

- **No-signup testing**: Users can try the service without creating an account
- **IP Binding**: Keys are bound to the first IP that uses them (security)
- **Time-limited**: 30-day expiration
- **Rate Limited**: 5 keys/hour, 10 keys/day per IP (prevents abuse)

This lowers the barrier to entry for new users while maintaining security.

## Technical Implementation

### Key Generation
```go
// Secure random generation
randomBytes := make([]byte, 32)
rand.Read(randomBytes)
randomPart := base64.RawURLEncoding.EncodeToString(randomBytes)
apiKey := "lelu_test_" + randomPart
```

### Key Storage (Redis)
```
Key: lelu:apikey:lelu_test_abc123
Value: {
  "tenant_id": "tenant_dev_001",
  "key_id": "abc123",
  "created_at": "2026-03-27T00:00:00Z",
  "revoked": false,
  "name": "Development Key",
  "env": "test"
}
```

### Authentication Middleware
```go
// Extract API key from header
authHeader := r.Header.Get("Authorization")
apiKey := extractBearerToken(authHeader)

// Validate and get tenant
tenantID, err := apiKeySvc.ValidateKey(ctx, apiKey)

// Inject into request context
ctx = context.WithValue(ctx, "tenant_id", tenantID)
```

### Request Flow
```
1. Client sends request with X-API-Key header
2. Middleware extracts and validates key
3. Redis lookup: key → tenant_id
4. Check if key is revoked or expired
5. For anonymous keys: verify IP binding
6. Inject tenant_id into request context
7. Rate limiter checks tenant quota
8. Authorization engine processes request
9. Audit log records decision with tenant_id
```

## Security Features

### 1. **Revocation**
Keys can be instantly revoked:
```go
apiKeySvc.RevokeKey(ctx, "lelu_test_abc123")
// All future requests with this key will fail
```

### 2. **IP Binding (Anonymous Keys)**
Anonymous keys bind to the first IP that uses them:
```go
// First request from 192.168.1.100 → binds key to this IP
// Subsequent requests from 192.168.1.200 → rejected
```

### 3. **Expiration**
Keys can have expiration dates (especially anonymous keys):
- Anonymous keys: 30 days
- Regular keys: No expiration (unless explicitly set)

### 4. **Secure Storage**
- Keys stored in Redis with metadata
- Never logged in plaintext
- Transmitted over HTTPS only

## Use Cases

### 1. **AI Agent Authorization**
```typescript
// Agent needs to perform action on behalf of user
const decision = await lelu.authorize({
  actor: "agent-gpt4",
  action: "s3:DeleteObject",
  resource: { bucket: "prod-data" },
  confidence: 0.85,
  acting_for: "user-123"
});
```
API key identifies which customer's agent this is.

### 2. **Multi-Environment Testing**
```bash
# Test environment
export LELU_API_KEY=lelu_test_dev123

# Production environment  
export LELU_API_KEY=lelu_live_prod456
```

### 3. **Service-to-Service Auth**
```python
# Microservice A calls authorization engine
client = LeluClient(api_key=os.getenv("LELU_API_KEY"))
result = client.authorize(principal, resource, action)
```

### 4. **Beta User Onboarding**
```
1. User visits /beta page
2. Clicks "Generate Beta Key"
3. Gets lelu_anon_xyz123 key
4. Can immediately test the API
5. No signup, no credit card required
```

## Why Not Use Other Auth Methods?

### Why not JWT tokens?
- **Stateless problem**: Can't revoke JWTs instantly
- **Tenant mapping**: Would need additional lookup anyway
- **Complexity**: API keys are simpler for API-to-API auth

### Why not OAuth?
- **Overhead**: Too complex for service-to-service auth
- **User context**: OAuth is for user authentication, not service authentication
- **Latency**: Additional token exchange adds latency

### Why not mTLS?
- **Certificate management**: Complex to manage and rotate
- **Developer experience**: Harder to get started
- **Flexibility**: API keys are easier to generate and share

## Summary

API keys in Lelu serve as the **foundation of the security and multi-tenancy architecture**:

✅ **Authenticate** clients making authorization requests  
✅ **Identify** which tenant the request belongs to  
✅ **Isolate** tenant data and resources  
✅ **Track** usage and enforce quotas  
✅ **Enable** both SaaS and self-hosted deployments  
✅ **Provide** audit trails for compliance  
✅ **Support** anonymous beta testing  
✅ **Prevent** abuse through rate limiting  

Without API keys, the system couldn't:
- Distinguish between different customers
- Enforce rate limits per tenant
- Track usage for billing
- Provide secure multi-tenant isolation
- Support the dual-mode architecture

They're not just authentication tokens—they're the **tenant identity system** that makes the entire multi-tenant authorization engine work.
