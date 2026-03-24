# Lelu Studio Redesign - Prisma-like Approach

## Problem with Current Implementation

Current `lelu studio` command:
- ❌ Requires Docker to work
- ❌ Starts entire stack with docker-compose
- ❌ Fails if Docker not installed
- ❌ UI is not bundled with npm package

## How Prisma Studio Works

```bash
npm install prisma
npx prisma studio
```

**What happens:**
1. ✅ UI is bundled in the npm package
2. ✅ Starts a local web server (port 5555)
3. ✅ Serves the UI from the package
4. ✅ Connects to database via connection string
5. ✅ NO Docker required

**Key insight:** The UI is just static files served by a Node.js server!

## New Lelu Studio Architecture

### What Should Happen

```bash
npm install @lelu-auth/lelu
npx lelu studio
```

**Flow:**
1. ✅ UI is pre-built and bundled in npm package
2. ✅ Starts local Next.js server (port 3002)
3. ✅ Serves UI from `node_modules/@lelu-auth/lelu/ui`
4. ✅ Connects to Platform API (configurable URL)
5. ✅ NO Docker required for UI

### What User Needs

**Minimum Requirements:**
- Platform API running (can be local or remote)
- Database for Platform API (SQLite, PostgreSQL, etc.)

**Optional:**
- Docker (for easy database setup)
- Engine service (for full features)

## Implementation Plan

### 1. Bundle UI in npm Package

```json
// sdk/typescript/package.json
{
  "name": "@lelu-auth/lelu",
  "files": [
    "dist/",
    "scripts/",
    "ui/"  // ← Add pre-built UI
  ]
}
```

### 2. Build UI During Package Publish

```json
// sdk/typescript/package.json
{
  "scripts": {
    "prepublishOnly": "npm run build:ui",
    "build:ui": "cd ../../platform/ui && npm run build && cp -r .next/standalone ../../sdk/typescript/ui"
  }
}
```

### 3. Update Studio Command

```javascript
// sdk/typescript/scripts/studio.js

function startStudio() {
  // 1. Check if Platform API is accessible
  const platformUrl = process.env.LELU_PLATFORM_URL || 'http://localhost:9091';
  
  // 2. Start UI server from bundled files
  const uiPath = path.join(__dirname, '../ui');
  const server = spawn('node', [path.join(uiPath, 'server.js')], {
    env: {
      ...process.env,
      PORT: options.port,
      PLATFORM_URL: platformUrl,
    }
  });
  
  // 3. Wait for server to be ready
  waitForServer(() => {
    openBrowser(`http://localhost:${options.port}`);
  });
}
```

### 4. Provide Setup Helpers

```bash
# If Platform API not running, show helpful message
lelu studio

⚠️  Platform API not accessible at http://localhost:9091

To start Platform API:

Option 1: Use Docker (easiest)
  docker-compose up -d platform postgres

Option 2: Run locally
  cd platform && go run cmd/api/main.go

Option 3: Use remote API
  LELU_PLATFORM_URL=https://your-api.com lelu studio
```

## Comparison

### Prisma Approach
```
npm install prisma
npx prisma studio
→ UI bundled in package
→ Connects to database
→ No Docker needed
```

### New Lelu Approach
```
npm install @lelu-auth/lelu
npx lelu studio
→ UI bundled in package
→ Connects to Platform API
→ No Docker needed for UI
```

## User Experience

### Scenario 1: Local Development (No Docker)

```bash
# 1. Install Lelu
npm install @lelu-auth/lelu

# 2. Start Platform API (with SQLite)
cd platform
DATABASE_URL=sqlite:./lelu.db go run cmd/api/main.go

# 3. Start Studio
npx lelu studio
# → Opens http://localhost:3002
# → Connects to http://localhost:9091
```

### Scenario 2: Local Development (With Docker)

```bash
# 1. Install Lelu
npm install @lelu-auth/lelu

# 2. Start services with Docker
docker-compose up -d

# 3. Start Studio
npx lelu studio
# → Opens http://localhost:3002
# → Connects to http://localhost:9091 (in Docker)
```

### Scenario 3: Remote API

```bash
# 1. Install Lelu
npm install @lelu-auth/lelu

# 2. Start Studio pointing to remote API
LELU_PLATFORM_URL=https://api.lelu.company.com lelu studio
# → Opens http://localhost:3002
# → Connects to remote API
```

## Benefits

✅ **No Docker Required** - UI works standalone
✅ **Flexible Deployment** - Connect to any Platform API
✅ **Faster Startup** - No container orchestration
✅ **Smaller Package** - Just UI files, no Docker images
✅ **Better DX** - Works like Prisma Studio
✅ **Team Friendly** - Share remote API URL

## Migration Path

### Phase 1: Bundle UI in Package
- Build UI during npm publish
- Include in package files
- Test serving from package

### Phase 2: Update Studio Command
- Remove Docker dependency
- Add Platform API health check
- Serve UI from bundled files

### Phase 3: Improve Setup Experience
- Add `lelu init` for first-time setup
- Provide SQLite option for Platform API
- Add helpful error messages

### Phase 4: Documentation
- Update all docs to reflect new approach
- Add troubleshooting guides
- Create video tutorials

## Technical Details

### UI Bundle Size
- Next.js standalone build: ~50MB
- Gzipped in npm package: ~15MB
- Acceptable for CLI tool

### Server Requirements
- Node.js 18+ (already required for CLI)
- No additional dependencies
- Uses Next.js standalone server

### Configuration
```bash
# Environment variables
LELU_PLATFORM_URL=http://localhost:9091  # Platform API
LELU_ENGINE_URL=http://localhost:8083    # Engine API (optional)
LELU_PLATFORM_API_KEY=your-key           # API key
```

## Summary

**Current:** `lelu studio` = Docker orchestration tool
**New:** `lelu studio` = UI server (like Prisma Studio)

This makes Lelu much more accessible and follows industry best practices!
