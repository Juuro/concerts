import { getGithubFeedbackRepoConfig } from "@/lib/github/feedback-issues"
import { fetchWithGithubRetry } from "@/lib/github/github-fetch"

export type GithubRestIssueState = "OPEN" | "CLOSED"

/**
 * Fetches current open/closed state for an issue in GITHUB_FEEDBACK_REPO.
 */
export async function fetchGithubIssueStateByNumber(
  issueNumber: number
): Promise<{ state: GithubRestIssueState }> {
  const { token, owner, repo } = getGithubFeedbackRepoConfig()
  const res = await fetchWithGithubRetry(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub issue fetch failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { state?: string }
  if (data.state === "closed") {
    return { state: "CLOSED" }
  }
  return { state: "OPEN" }
}
