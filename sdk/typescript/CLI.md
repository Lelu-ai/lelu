# Lelu TypeScript SDK CLI

The Lelu TypeScript SDK includes a built-in CLI for viewing audit logs and other utilities.

## Installation

```bash
npm install lelu-agent-auth
```

## Usage

### View Audit Logs

```bash
npx lelu audit-log
```

### Help

```bash
npx lelu help
```

## Environment Variables

- `LELU_PLATFORM_URL` - Platform API URL (default: http://localhost:3001)
- `LELU_AUDIT_LIMIT` - Number of events to fetch (default: 20)

## Examples

```bash
# View recent audit events
npx lelu audit-log

# View 50 recent events
LELU_AUDIT_LIMIT=50 npx lelu audit-log

# Use custom platform URL
LELU_PLATFORM_URL=https://api.example.com npx lelu audit-log
```

## Requirements

- The Lelu platform service must be running (not just the engine)
- Network access to the platform API
