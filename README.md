# Documentation MCP Server

A Model Context Protocol (MCP) server that provides GitHub PR/issue data along with a documentation guide for LLM-based documentation generation.

## Overview

This MCP server is a **data provider** that:

- Fetches GitHub PR and issue data server-side
- Loads a static documentation template
- Returns formatted context to the client LLM
- Lets the client LLM generate the actual documentation

**Architecture Flow:**

```
User → Client LLM → MCP Tool (writeDocumentation)
                         ↓
                   MCP Server fetches GitHub data
                         ↓
                   Returns guide + GitHub context
                         ↓
                   Client LLM generates documentation
                         ↓
                   User receives documentation
```

The server does NOT contain its own LLM - it aggregates data for the client's LLM to process.

## Features

- **Single Tool**: `writeDocumentation` - aggregates GitHub data with documentation guide
- **Server-Side Fetching**: Automatically retrieves PR details, linked issues, and diffs
- **Static Template**: Uses a fixed documentation guide loaded at startup
- **No LLM Calls**: Returns raw context for the client LLM to process
- **Explicit Errors**: Fails clearly when GitHub data cannot be fetched

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variable (optional):

```bash
# Optional (recommended for higher rate limits and private repos)
export GITHUB_TOKEN="your-github-token"
```

No API keys required - the client LLM handles generation.

## Usage

### Running the Server

```bash
npm start
```

The server communicates over stdio and can be used with any MCP client.

### MCP Client Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "documentation": {
      "command": "node",
      "args": ["/path/to/documentation-mcp-server/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "your-token-here"
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

Client LLM: [Calls writeDocumentation tool]

MCP Server: [Returns documentation guide + GitHub PR data]

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
├── index.ts           # MCP server implementation
└── github-client.ts   # GitHub API integration

documentation-guide.md # Static documentation template
```

### How It Works

1. **User Request**: User asks their LLM to document a GitHub PR/issue
2. **Tool Invocation**: Client LLM calls `writeDocumentation` with URLs
3. **Data Fetching**: MCP server fetches GitHub data (PR, issue, diffs)
4. **Context Building**: Server combines guide + GitHub data into formatted prompt
5. **Return to Client**: Server returns the complete context
6. **Generation**: Client LLM generates documentation following the guide
7. **Validation**: Client LLM (optionally) validates output structure

## Why This Architecture?

**Before (incorrect):**
- MCP Server contained its own LLM call (Anthropic SDK)
- Required ANTHROPIC_API_KEY in the server
- Duplicated LLM usage (client + server both calling LLMs)

**Now (correct MCP pattern):**
- MCP Server is a pure data provider
- No LLM dependencies in the server
- Client's existing LLM does all generation
- Simpler, cheaper, more flexible

## Development

```bash
# Build
npm run build

# Run
npm start
```

## What This Server Does NOT Do

- Call external LLMs (client handles generation)
- Maintain conversation state
- Ask follow-up questions
- Store or cache results
- Validate generated documentation (client's responsibility)

## Requirements

- Node.js 18+
- TypeScript 5+
- GitHub token (optional, but recommended)

## License

MIT
