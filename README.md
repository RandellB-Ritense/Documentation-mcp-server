# Documentation MCP Server

A Model Context Protocol (MCP) server that provides GitHub PR/issue data along with a documentation guide for LLM-based documentation generation.

## Overview

This MCP server is a **data provider** that:

- Fetches GitHub PR and issue data server-side
- Loads a static documentation template
- Returns formatted context to the client LLM
- Lets the client LLM generate the actual documentation
- **Runs as an HTTP service** - can be deployed locally or remotely

**Architecture Flow:**

```
User → Client LLM → HTTP → MCP Server
                              ↓
                       Fetches GitHub data
                              ↓
                       Returns guide + context
                              ↓
              Client LLM generates documentation
                              ↓
                      User receives documentation
```

The server does NOT contain its own LLM - it aggregates data for the client's LLM to process.

## Features

- **HTTP Transport**: Uses StreamableHTTP for MCP communication
- **Stateless**: Supports multiple concurrent clients without session conflicts
- **Remote Deployment**: Run on a different machine from your MCP client
- **Single Tool**: `writeDocumentation` - aggregates GitHub data with documentation guide
- **Server-Side Fetching**: Automatically retrieves PR details, linked issues, and diffs
- **Static Template**: Uses a fixed documentation guide loaded at startup
- **No LLM Calls**: Returns raw context for the client LLM to process
- **Health Check**: Built-in `/health` endpoint for monitoring

## Quick Start

### 1. Install and Build

```bash
npm install
npm run build
```

### 2. Set GitHub Token

```bash
export GITHUB_TOKEN="ghp_your_github_token_here"
```

Get your token at: https://github.com/settings/tokens

### 3. Start the Server

```bash
npm start
```

You should see:
```
Documentation MCP Server running on http://0.0.0.0:3000
MCP endpoint: http://0.0.0.0:3000/mcp
Health check: http://0.0.0.0:3000/health
Mode: HTTP (stateless, multiple clients supported)
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | - | Yes |
| `PORT` | HTTP server port | `3000` | No |
| `HOST` | HTTP server host | `0.0.0.0` | No |

### Examples

```bash
# Custom port
PORT=8080 npm start

# Specific interface
HOST=127.0.0.1 npm start

# Both
PORT=8080 HOST=127.0.0.1 GITHUB_TOKEN=your_token npm start
```

## Usage

### Health Check

Test if the server is running:

```bash
curl http://localhost:3000/health
# Response: {"status":"ok","service":"documentation-mcp-server"}
```

### MCP Client Configuration

Configure your MCP client to connect to the server:

```json
{
  "mcpServers": {
    "documentation": {
      "url": "http://localhost:3000/mcp",
      "transport": "http"
    }
  }
}
```

**For remote servers:**

```json
{
  "mcpServers": {
    "documentation": {
      "url": "https://your-server.com/mcp",
      "transport": "http"
    }
  }
}
```

### Tool: writeDocumentation

**Input Parameters:**

- `prUrl` (string, optional): GitHub pull request URL
- `issueUrl` (string, optional): GitHub issue URL
- `notes` (string, optional): Additional context or notes

At least one of `prUrl` or `issueUrl` is required.

**Example Usage:**

```
User: "Write documentation for https://github.com/owner/repo/pull/123"

Client LLM: [Calls writeDocumentation tool via HTTP]

MCP Server: [Fetches GitHub data, returns guide + context]

Client LLM: [Generates documentation following the guide]

User: [Receives completed documentation]
```

**Output:**

Returns a formatted prompt containing:

1. The documentation guide (structure, rules, required sections)
2. GitHub PR/issue data (title, description, files, diffs)
3. Any additional notes provided
4. Instructions for the client LLM to generate documentation

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["npm", "start"]
```

Build and run:

```bash
docker build -t documentation-mcp-server .
docker run -d -p 3000:3000 \
  -e GITHUB_TOKEN=your_token \
  --name mcp-server \
  documentation-mcp-server
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - PORT=3000
      - HOST=0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Process Manager (PM2)

```bash
npm install -g pm2
pm2 start dist/index.js --name mcp-server
pm2 save
pm2 startup
```

### Cloud Platforms

Deploy to Railway, Render, Fly.io, or any platform supporting Node.js:

1. Push your code to GitHub
2. Connect repository to platform
3. Set `GITHUB_TOKEN` environment variable
4. Platform will auto-deploy

## Testing

### Test with curl

```bash
# Initialize
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'

# List tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

## Architecture

```
src/
├── index.ts           # MCP server with HTTP transport
└── github-client.ts   # GitHub API integration

documentation-guide.md # Static documentation template
```

### How It Works

1. **Server Starts**: Loads documentation guide, starts HTTP server
2. **Client Connects**: MCP client connects to `/mcp` endpoint
3. **Tool Invocation**: Client calls `writeDocumentation` with GitHub URLs
4. **Data Fetching**: Server fetches PR/issue data from GitHub API
5. **Context Building**: Server combines guide + GitHub data into formatted prompt
6. **Response**: Server returns complete context via HTTP
7. **Generation**: Client LLM generates documentation following the guide

### Transport Details

- **Protocol**: StreamableHTTP (MCP specification)
- **MCP Endpoint**: `GET/POST /mcp` - Main MCP communication
- **Health Endpoint**: `GET /health` - Status check
- **CORS**: Enabled for all origins (configure for production)
- **Session Mode**: Stateless (supports multiple concurrent clients)

## Security

For production deployment:

1. **Configure CORS**: Restrict allowed origins
2. **Use HTTPS**: Deploy behind reverse proxy (nginx, Caddy)
3. **Rate Limiting**: Add rate limiting middleware
4. **Authentication**: Add auth tokens if needed
5. **GitHub Token**: Keep secure, use environment variables
6. **Network**: Use firewall rules to restrict access

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

**Common issues:**

- **"Server already initialized"**: Fixed in latest version (stateless mode)
- **Connection refused**: Server not running or wrong port
- **CORS errors**: Configure CORS for your client origin
- **GitHub rate limits**: Use a GitHub token

## Requirements

- Node.js 18+
- TypeScript 5+
- GitHub token (optional, but recommended)

## License

MIT
