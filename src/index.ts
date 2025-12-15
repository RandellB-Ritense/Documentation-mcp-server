#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GitHubClient } from "./github-client.js";
import { DocumentationGenerator } from "./documentation-generator.js";

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY environment variable is required");
  process.exit(1);
}

class DocumentationMCPServer {
  private server: Server;
  private githubClient: GitHubClient;
  private docGenerator: DocumentationGenerator;

  constructor() {
    this.server = new Server(
      {
        name: "documentation-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.githubClient = new GitHubClient(GITHUB_TOKEN);
    this.docGenerator = new DocumentationGenerator(ANTHROPIC_API_KEY!);

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "writeDocumentation",
          description:
            "Generate technical documentation from GitHub pull requests and issues. Requires at least one of prUrl or issueUrl.",
          inputSchema: {
            type: "object",
            properties: {
              prUrl: {
                type: "string",
                description: "GitHub pull request URL (e.g., https://github.com/owner/repo/pull/123)",
              },
              issueUrl: {
                type: "string",
                description: "GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)",
              },
              notes: {
                type: "string",
                description: "Optional additional notes or context to include in the documentation",
              },
            },
            oneOf: [
              { required: ["prUrl"] },
              { required: ["issueUrl"] },
              { required: ["prUrl", "issueUrl"] },
            ],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== "writeDocumentation") {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        const args = request.params.arguments as {
          prUrl?: string;
          issueUrl?: string;
          notes?: string;
        };

        // Validate input
        if (!args.prUrl && !args.issueUrl) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "At least one of prUrl or issueUrl must be provided"
          );
        }

        // Fetch GitHub data
        let prData;
        let issueData;

        if (args.prUrl) {
          try {
            prData = await this.githubClient.fetchPullRequest(args.prUrl);
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fetch PR: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        if (args.issueUrl) {
          try {
            issueData = await this.githubClient.fetchIssue(args.issueUrl);
          } catch (error) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fetch issue: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          }
        }

        // Generate documentation
        let documentation;
        try {
          documentation = await this.docGenerator.generate(
            prData,
            issueData,
            args.notes
          );
        } catch (error) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to generate documentation: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: documentation,
            },
          ],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Documentation MCP Server running on stdio");
  }
}

// Start the server
const server = new DocumentationMCPServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
