import { Octokit } from "@octokit/rest";

export interface GitHubPRData {
  title: string;
  description: string;
  number: number;
  linkedIssue?: GitHubIssueData;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
  url: string;
}

export interface GitHubIssueData {
  title: string;
  description: string;
  number: number;
  url: string;
}

export class GitHubClient {
  private octokit: Octokit;
  private maxDiffSize = 50000; // Truncate diffs if they exceed this size

  constructor(token?: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }

  parseGitHubUrl(url: string): { owner: string; repo: string; number: number } | null {
    // Match: https://github.com/owner/repo/pull/123
    // Match: https://github.com/owner/repo/issues/123
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/(pull|issues)\/(\d+)/);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[4], 10),
    };
  }

  async fetchPullRequest(prUrl: string): Promise<GitHubPRData> {
    const parsed = this.parseGitHubUrl(prUrl);
    if (!parsed) {
      throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
    }

    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: parsed.owner,
        repo: parsed.repo,
        pull_number: parsed.number,
      });

      const { data: files } = await this.octokit.pulls.listFiles({
        owner: parsed.owner,
        repo: parsed.repo,
        pull_number: parsed.number,
        per_page: 100,
      });

      let linkedIssue: GitHubIssueData | undefined;

      // Try to extract linked issue from PR body
      if (pr.body) {
        const issueMatch = pr.body.match(/#(\d+)|\/issues\/(\d+)/);
        if (issueMatch) {
          const issueNumber = parseInt(issueMatch[1] || issueMatch[2], 10);
          try {
            const { data: issue } = await this.octokit.issues.get({
              owner: parsed.owner,
              repo: parsed.repo,
              issue_number: issueNumber,
            });
            linkedIssue = {
              title: issue.title,
              description: issue.body || "",
              number: issue.number,
              url: issue.html_url,
            };
          } catch {
            // Ignore if issue fetch fails
          }
        }
      }

      // Truncate patches if total size is too large
      let totalSize = 0;
      const processedFiles = files.map((file) => {
        let patch = file.patch;
        if (patch) {
          totalSize += patch.length;
          if (totalSize > this.maxDiffSize) {
            patch = `[Diff truncated - file too large]\n${patch.substring(0, 1000)}...`;
          }
        }
        return {
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          patch,
        };
      });

      return {
        title: pr.title,
        description: pr.body || "",
        number: pr.number,
        linkedIssue,
        files: processedFiles,
        url: pr.html_url,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch PR data: ${error.message}`);
      }
      throw new Error("Failed to fetch PR data");
    }
  }

  async fetchIssue(issueUrl: string): Promise<GitHubIssueData> {
    const parsed = this.parseGitHubUrl(issueUrl);
    if (!parsed) {
      throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
    }

    try {
      const { data: issue } = await this.octokit.issues.get({
        owner: parsed.owner,
        repo: parsed.repo,
        issue_number: parsed.number,
      });

      return {
        title: issue.title,
        description: issue.body || "",
        number: issue.number,
        url: issue.html_url,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch issue data: ${error.message}`);
      }
      throw new Error("Failed to fetch issue data");
    }
  }
}
