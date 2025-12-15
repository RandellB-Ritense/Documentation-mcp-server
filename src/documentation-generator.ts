import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GitHubPRData, GitHubIssueData } from "./github-client.js";
import { DocumentationValidator } from "./validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DocumentationGenerator {
  private anthropic: Anthropic;
  private validator: DocumentationValidator;
  private guideContent: string;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
    this.validator = new DocumentationValidator();

    // Load the static documentation guide
    const guidePath = join(__dirname, "..", "documentation-guide.md");
    this.guideContent = readFileSync(guidePath, "utf-8");
  }

  private buildContext(
    prData?: GitHubPRData,
    issueData?: GitHubIssueData,
    notes?: string
  ): string {
    let context = "";

    if (prData) {
      context += `## Pull Request Data\n\n`;
      context += `**Title:** ${prData.title}\n\n`;
      context += `**URL:** ${prData.url}\n\n`;
      context += `**Description:**\n${prData.description || "No description provided"}\n\n`;

      if (prData.linkedIssue) {
        context += `**Linked Issue:**\n`;
        context += `- Title: ${prData.linkedIssue.title}\n`;
        context += `- URL: ${prData.linkedIssue.url}\n`;
        context += `- Description: ${prData.linkedIssue.description || "No description"}\n\n`;
      }

      context += `**Files Changed (${prData.files.length}):**\n\n`;
      for (const file of prData.files) {
        context += `### ${file.filename}\n`;
        context += `Status: ${file.status}, +${file.additions} -${file.deletions}\n\n`;
        if (file.patch) {
          context += "```diff\n";
          context += file.patch;
          context += "\n```\n\n";
        }
      }
    }

    if (issueData && !prData?.linkedIssue) {
      context += `## Issue Data\n\n`;
      context += `**Title:** ${issueData.title}\n\n`;
      context += `**URL:** ${issueData.url}\n\n`;
      context += `**Description:**\n${issueData.description || "No description provided"}\n\n`;
    }

    if (notes) {
      context += `## Additional Notes\n\n`;
      context += notes;
      context += "\n\n";
    }

    return context;
  }

  async generate(
    prData?: GitHubPRData,
    issueData?: GitHubIssueData,
    notes?: string
  ): Promise<string> {
    if (!prData && !issueData) {
      throw new Error("At least one of prData or issueData must be provided");
    }

    const context = this.buildContext(prData, issueData, notes);

    const prompt = `${this.guideContent}

---

# Source Materials

${context}

---

Generate the technical documentation following the guide exactly. Do not guess or speculate on missing information.`;

    try {
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from LLM");
      }

      const documentation = content.text;

      // Validate the output
      const validationResult = this.validator.validate(documentation);
      if (!validationResult.valid) {
        throw new Error(
          `Documentation validation failed:\n${validationResult.errors.join("\n")}`
        );
      }

      return documentation;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate documentation: ${error.message}`);
      }
      throw new Error("Failed to generate documentation");
    }
  }
}
