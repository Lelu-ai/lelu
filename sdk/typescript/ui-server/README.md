# Lelu UI Server

This directory contains the bundled Next.js UI for Lelu Studio.

## Usage

```bash
node start.js
```

## Environment Variables

- `PORT` - Port to run the server on (default: 3002)
- `PLATFORM_URL` - Platform API URL (default: http://localhost:9091)
- `PLATFORM_API_KEY` - Platform API key (default: platform-dev-key)
- `LELU_ENGINE_URL` - Engine API URL (default: http://localhost:8083)

## Note

This is a standalone Next.js build bundled with the lelu-agent-auth npm package.
It allows `lelu studio` to work without requiring Docker or external dependencies.
