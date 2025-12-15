#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import cors from "cors";
import { GitHubClient, GitHubPRData, GitHubIssueData } from "./github-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

class DocumentationMCPServer {
  private server: Server;
  private githubClient: GitHubClient;
  private guideContent: string;

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

    // Load the static documentation guide
    const guidePath = join(__dirname, "..", "documentation-guide.md");
    this.guideContent = readFileSync(guidePath, "utf-8");

    this.setupHandlers();
  }

  private buildPrompt(
    prData?: GitHubPRData,
    issueData?: GitHubIssueData,
    notes?: string
  ): string {
    let prompt = this.guideContent + "\n\n---\n\n# Source Materials\n\n";

    if (prData) {
      prompt += `## Pull Request Data\n\n`;
      prompt += `**Title:** ${prData.title}\n\n`;
      prompt += `**URL:** ${prData.url}\n\n`;
      prompt += `**Description:**\n${prData.description || "No description provided"}\n\n`;

      if (prData.linkedIssue) {
        prompt += `**Linked Issue:**\n`;
        prompt += `- Title: ${prData.linkedIssue.title}\n`;
        prompt += `- URL: ${prData.linkedIssue.url}\n`;
        prompt += `- Description: ${prData.linkedIssue.description || "No description"}\n\n`;
      }

      prompt += `**Files Changed (${prData.files.length}):**\n\n`;
      for (const file of prData.files) {
        prompt += `### ${file.filename}\n`;
        prompt += `Status: ${file.status}, +${file.additions} -${file.deletions}\n\n`;
        if (file.patch) {
          prompt += "```diff\n";
          prompt += file.patch;
          prompt += "\n```\n\n";
        }
      }
    }

    if (issueData && !prData?.linkedIssue) {
      prompt += `## Issue Data\n\n`;
      prompt += `**Title:** ${issueData.title}\n\n`;
      prompt += `**URL:** ${issueData.url}\n\n`;
      prompt += `**Description:**\n${issueData.description || "No description provided"}\n\n`;
    }

    if (notes) {
      prompt += `## Additional Notes\n\n`;
      prompt += notes;
      prompt += "\n\n";
    }

    prompt += `---\n\nGenerate the technical documentation following the guide exactly. Do not guess or speculate on missing information.`;

    return prompt;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "writeDocumentation",
          description:
            "Fetch GitHub PR/issue data and return a prompt for the client LLM to generate technical documentation. Returns the documentation guide along with GitHub context.",
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

        // Build the prompt with guide + GitHub context
        const prompt = this.buildPrompt(prData, issueData, args.notes);

        return {
          content: [
            {
              type: "text",
              text: prompt,
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
    const app = express();

    // Enable CORS for all origins (configure as needed for production)
    app.use(cors());

    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({ status: "ok", service: "documentation-mcp-server" });
    });

    // SSE endpoint for MCP
    app.get("/sse", async (req, res) => {
      console.error("New SSE connection established");

      const transport = new SSEServerTransport("/message", res);
      await this.server.connect(transport);

      // Handle client disconnect
      req.on("close", () => {
        console.error("SSE connection closed");
      });
    });

    // Message endpoint for client requests
    app.post("/message", express.json(), async (req, res) => {
      // This endpoint is handled by the SSE transport
      res.status(200).end();
    });

    app.listen(PORT, HOST, () => {
      console.error(`Documentation MCP Server running on http://${HOST}:${PORT}`);
      console.error(`SSE endpoint: http://${HOST}:${PORT}/sse`);
      console.error(`Health check: http://${HOST}:${PORT}/health`);
    });
  }
}

// Start the server
const server = new DocumentationMCPServer();
server.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
