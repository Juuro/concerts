/**
 * Token for GitHub REST + GraphQL (issues, projects).
 * Prefer `GITHUB_FEEDBACK_TOKEN` in production; `GH_ACCESS_TOKEN` is supported
 * as a local-dev fallback when the same PAT is already configured for other tools.
 */
export function getGithubFeedbackToken(): string {
  const token = process.env.GITHUB_FEEDBACK_TOKEN || process.env.GH_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      "Missing GitHub token: set GITHUB_FEEDBACK_TOKEN (or GH_ACCESS_TOKEN for local dev)"
    )
  }
  return token
}
