import type { FeedbackGithubCreate } from "@/lib/feedback/triage-schema"
import { fetchWithGithubRetry } from "@/lib/github/github-fetch"
import { getGithubFeedbackToken } from "@/lib/github/github-token"

interface CreateGithubIssueInput extends FeedbackGithubCreate {
  feedbackId: string
  category: string
  pagePath?: string | null
}

export interface CreatedIssue {
  number: number
  url: string
  /** GraphQL node ID for Project V2 linking */
  nodeId: string
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

function sanitizeText(input: string): string {
  return input.replace(EMAIL_REGEX, "[redacted-email]").trim()
}

/** Repo + token for GitHub REST (issues, issue status). */
export function getGithubFeedbackRepoConfig(): {
  token: string
  owner: string
  repo: string
} {
  const token = getGithubFeedbackToken()
  const repoPath = process.env.GITHUB_FEEDBACK_REPO?.trim()

  if (!repoPath) {
    throw new Error(
      "Missing GITHUB_FEEDBACK_REPO environment variable (expected owner/repo)"
    )
  }

  const parts = repoPath.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(
      `Invalid GITHUB_FEEDBACK_REPO "${repoPath}" (expected exactly owner/repo)`
    )
  }

  const [owner, repo] = parts
  return { token, owner, repo }
}

export async function createFeedbackIssue(
  input: CreateGithubIssueInput
): Promise<CreatedIssue> {
  const { token, owner, repo } = getGithubFeedbackRepoConfig()

  const response = await fetchWithGithubRetry(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: sanitizeText(input.title),
        body: [
          `Feedback ID: ${input.feedbackId}`,
          `Category: ${input.category}`,
          input.pagePath ? `Page: ${sanitizeText(input.pagePath)}` : null,
          "",
          sanitizeText(input.body),
        ]
          .filter(Boolean)
          .join("\n"),
        labels: input.labels.map(sanitizeText),
      }),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `GitHub issue creation failed (${response.status}): ${text}`
    )
  }

  const data = (await response.json()) as {
    number: number
    html_url: string
    node_id: string
  }
  if (!data.node_id) {
    throw new Error(
      "GitHub issue response missing node_id (needed for Projects)"
    )
  }
  return { number: data.number, url: data.html_url, nodeId: data.node_id }
}
