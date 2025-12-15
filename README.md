# Documentation MCP Server

A Model Context Protocol (MCP) server that generates structured technical documentation from GitHub pull requests and issues.

## Overview

This MCP server provides a single tool for deterministic documentation generation. It:

- Fetches GitHub PR and issue data server-side
- Applies a fixed documentation template
- Generates validated Markdown documentation
- Fails explicitly when requirements aren't met

**This is a compiler, not an assistant.** It does not chat, ask follow-up questions, or make autonomous decisions.

## Features

- **Single Tool**: `writeDocumentation` - generates documentation from GitHub URLs
- **Server-Side Fetching**: Automatically retrieves PR details, linked issues, and diffs
- **Static Template**: Uses a fixed documentation guide (not user-configurable at runtime)
- **Validation**: Enforces required sections and forbidden phrases
- **Explicit Errors**: Fails loudly when inputs are invalid or outputs don't meet requirements

## Installation

```bash
npm install
npm run build
```

## Configuration

Set the following environment variables:

```bash
# Required
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional (recommended for higher rate limits)
export GITHUB_TOKEN="your-github-token"
```

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
        "ANTHROPIC_API_KEY": "your-key-here",
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

**Example:**

```json
{
  "prUrl": "https://github.com/owner/repo/pull/123",
  "notes": "This fixes a critical authentication bug"
}
```

**Output:**

Returns structured Markdown documentation with the following sections:

1. Overview
2. Problem Statement
3. Solution
4. Changes
5. Testing
6. Dependencies
7. Notes

**Error Conditions:**

The tool will return an error if:

- GitHub URLs are invalid or inaccessible
- Required input is missing
- Generated documentation fails validation
- External APIs are unavailable

## Documentation Template

The server uses a static documentation guide located at `documentation-guide.md`. This template:

- Defines required sections
- Specifies formatting rules
- Lists forbidden phrases
- Ensures consistent output structure

The guide is loaded once at startup and cannot be modified at runtime.

## Validation

Generated documentation is validated for:

- Presence of all required sections
- Correct section order
- No emojis
- No speculative language ("I think", "maybe", "possibly")
- Proper Markdown formatting

If validation fails, the tool returns an error instead of partial output.

## Architecture

```
src/
├── index.ts                    # MCP server implementation
├── github-client.ts            # GitHub API integration
├── documentation-generator.ts  # LLM integration and orchestration
└── validator.ts                # Output validation logic

documentation-guide.md          # Static documentation template
```

## Development

```bash
# Build
npm run build

# Run
npm start
```

## Non-Goals

This server does NOT:

- Maintain conversation state
- Ask follow-up questions
- Perform autonomous decision-making
- Store or cache results
- Provide multiple tools
- Allow runtime template customization

## Requirements

- Node.js 18+
- TypeScript 5+
- Anthropic API key
- GitHub token (optional, but recommended)

## License

MIT
