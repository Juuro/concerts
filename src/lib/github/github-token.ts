/** Token for GitHub REST + GraphQL (issues, projects). */
export function getGithubFeedbackToken(): string {
  const token = process.env.GITHUB_FEEDBACK_TOKEN || process.env.GH_ACCESS_TOKEN
  if (!token) {
    throw new Error("Missing GITHUB_FEEDBACK_TOKEN (or GH_ACCESS_TOKEN)")
  }
  return token
}
