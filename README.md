# Documentation MCP Server

A Model Context Protocol (MCP) server that provides GitHub PR/issue data along with a documentation guide for LLM-based documentation generation.

## Overview

This MCP server is a **data provider** that:

- Fetches GitHub PR and issue data server-side
- Loads a static documentation template
- Returns formatted context to the client LLM
- Lets the client LLM generate the actual documentation
- **Runs as an HTTP service** - can be deployed on a remote machine

**Architecture Flow:**

```
User → Client LLM → HTTP/SSE → MCP Server (remote)
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

- **HTTP Transport**: Uses Server-Sent Events (SSE) for MCP communication
- **Remote Deployment**: Run on a different machine from your MCP client
- **Single Tool**: `writeDocumentation` - aggregates GitHub data with documentation guide
- **Server-Side Fetching**: Automatically retrieves PR details, linked issues, and diffs
- **Static Template**: Uses a fixed documentation guide loaded at startup
- **No LLM Calls**: Returns raw context for the client LLM to process
- **Health Check**: Built-in `/health` endpoint for monitoring

## Installation

```bash
npm install
npm run build
```

## Configuration

Configure using environment variables:

```bash
# Optional: GitHub token (recommended for higher rate limits and private repos)
export GITHUB_TOKEN="your-github-token"

# Server configuration
export PORT=3000        # Default: 3000
export HOST=0.0.0.0     # Default: 0.0.0.0 (all interfaces)
```

Or create a `.env` file (see `.env.example`).

## Usage

### Running the Server

```bash
# Local development
npm start

# Production with custom port
PORT=8080 npm start

# Run on specific interface
HOST=127.0.0.1 PORT=3000 npm start
```

The server will start and display:
```
Documentation MCP Server running on http://0.0.0.0:3000
SSE endpoint: http://0.0.0.0:3000/sse
Health check: http://0.0.0.0:3000/health
```

### Health Check

Test if the server is running:

```bash
curl http://localhost:3000/health
# Response: {"status":"ok","service":"documentation-mcp-server"}
```

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "documentation": {
      "url": "http://your-server:3000/sse"
    }
  }
}
```

**For remote servers:**

```json
{
  "mcpServers": {
    "documentation": {
      "url": "http://192.168.1.100:3000/sse"
    }
  }
}
```

**For Claude Desktop (example):**

Edit your Claude Desktop config file:

```json
{
  "mcpServers": {
    "documentation": {
      "transport": {
        "type": "sse",
        "url": "http://localhost:3000/sse"
      }
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

When you call the tool from your LLM client:

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

**Error Conditions:**

The tool will return an error if:

- GitHub URLs are invalid or inaccessible
- Required input is missing
- GitHub API is unavailable

## Documentation Template

The server uses a static documentation guide located at `documentation-guide.md`. This template:

- Defines 7 required sections (Overview, Problem Statement, Solution, Changes, Testing, Dependencies, Notes)
- Specifies formatting rules
- Lists forbidden phrases (no speculation, no emojis)
- Ensures consistent output structure

The guide is loaded once at startup and included in every tool response.

## Architecture

```
src/
├── index.ts           # MCP server with HTTP/SSE transport
└── github-client.ts   # GitHub API integration

documentation-guide.md # Static documentation template
```

### How It Works

1. **Server Starts**: Loads documentation guide, starts HTTP server
2. **Client Connects**: MCP client connects to `/sse` endpoint via SSE
3. **Tool Invocation**: Client calls `writeDocumentation` with GitHub URLs
4. **Data Fetching**: Server fetches PR/issue data from GitHub API
5. **Context Building**: Server combines guide + GitHub data into formatted prompt
6. **Response**: Server returns complete context via SSE
7. **Generation**: Client LLM generates documentation following the guide

### Transport Details

- **Protocol**: Server-Sent Events (SSE) over HTTP
- **SSE Endpoint**: `GET /sse` - Main MCP communication channel
- **Message Endpoint**: `POST /message` - Handled by SSE transport
- **Health Endpoint**: `GET /health` - Status check
- **CORS**: Enabled for all origins (configure for production)

## Deployment

### Docker (example)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Systemd Service (example)

```ini
[Unit]
Description=Documentation MCP Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/documentation-mcp-server
Environment="PORT=3000"
Environment="GITHUB_TOKEN=your-token"
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

## Why HTTP Transport?

**Benefits:**

- ✅ **Remote deployment** - Run server on different machine
- ✅ **Centralized** - Multiple clients can use same server
- ✅ **Scalable** - Can run behind load balancer
- ✅ **Monitoring** - Health checks and metrics
- ✅ **Firewall friendly** - Standard HTTP/HTTPS ports

**vs stdio transport:**

- stdio: Server runs as subprocess of client (local only)
- HTTP: Server runs independently (can be remote)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm start

# Run with custom config
PORT=8080 GITHUB_TOKEN=ghp_xxx npm start
```

## What This Server Does NOT Do

- Call external LLMs (client handles generation)
- Maintain conversation state
- Ask follow-up questions
- Store or cache results
- Validate generated documentation (client's responsibility)

## Security Considerations

For production deployment:

1. **Configure CORS**: Restrict allowed origins in `src/index.ts`
2. **Use HTTPS**: Deploy behind reverse proxy (nginx, caddy)
3. **Rate Limiting**: Add rate limiting middleware
4. **Authentication**: Add auth tokens if needed
5. **GitHub Token**: Keep secure, use environment variables
6. **Network**: Use firewall rules to restrict access

## Requirements

- Node.js 18+
- TypeScript 5+
- GitHub token (optional, but recommended)

## License

MIT
