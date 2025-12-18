// Helper function to build the prompt
import {GitHubIssueData, GitHubPRData} from "./github-client.js";
import {readFileSync} from "fs";
import {join} from "path";

// Load the static documentation guide
const guidePath = join(__dirname, "..", "documentation-guide.md");
const guideContent = readFileSync(guidePath, "utf-8");

export function buildPrompt(
    prData?: GitHubPRData,
    issueData?: GitHubIssueData,
    notes?: string
): string {
    let prompt = guideContent + "\n\n---\n\n# Source Materials\n\n";

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

    prompt += `---\n\nGenerate the documentation following the guide exactly. Do not guess or speculate on missing information.`;

    return prompt;
}