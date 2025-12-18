// Create and configure MCP server
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {GitHubClient, GitHubIssueData, GitHubPRData} from "./github-client.js";
import { z } from "zod";
import {buildPrompt} from "./promptBuilder.js";

// Initialize GitHub client
const githubClient = new GitHubClient(process.env.GITHUB_TOKEN);

export function createMcpServer(): McpServer {
    const server = new McpServer(
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

    // Register the writeDocumentation tool
    server.registerTool(
        "writeDocumentation",
        {
            description:
                "Fetch GitHub PR/issue data and return a prompt for the client LLM to generate technical documentation. Returns the documentation guide along with GitHub context.",
            inputSchema: {
                prUrl: z
                    .string()
                    .optional()
                    .describe("GitHub pull request URL (e.g., https://github.com/owner/repo/pull/123)"),
                issueUrl: z
                    .string()
                    .optional()
                    .describe("GitHub issue URL (e.g., https://github.com/owner/repo/issues/123)"),
                notes: z
                    .string()
                    .optional()
                    .describe("Optional additional notes or context to include in the documentation"),
            },
        },
        async ({ prUrl, issueUrl, notes }) => {
            // Validate input
            if (!prUrl && !issueUrl) {
                return {
                    content: [
                        {
                            type: "text" as const,
                            text: "Error: At least one of prUrl or issueUrl must be provided",
                        },
                    ],
                };
            }

            // Fetch GitHub data
            let prData: GitHubPRData | undefined;
            let issueData: GitHubIssueData | undefined;

            if (prUrl) {
                try {
                    prData = await githubClient.fetchPullRequest(prUrl);
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Failed to fetch PR: ${error instanceof Error ? error.message : "Unknown error"}`,
                            },
                        ],
                    };
                }
            }

            if (issueUrl) {
                try {
                    issueData = await githubClient.fetchIssue(issueUrl);
                } catch (error) {
                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: `Failed to fetch issue: ${error instanceof Error ? error.message : "Unknown error"}`,
                            },
                        ],
                    };
                }
            }

            // Build the prompt with guide + GitHub context
            const prompt = buildPrompt(prData, issueData, notes);

            return {
                content: [
                    {
                        type: "text" as const,
                        text: prompt,
                    },
                ],
            };
        }
    );

    return server;
}