import { GITHUB_FETCH_TIMEOUT_MS } from "@/lib/github/constants"

const MAX_ATTEMPTS = 3
const RETRY_BACKOFF_MS = [300, 900] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbortError(e: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      e instanceof DOMException &&
      e.name === "AbortError") ||
    (e instanceof Error && e.name === "AbortError")
  )
}

function shouldRetryHttp(status: number): boolean {
  return status === 429 || status === 502 || status === 503
}

/**
 * GitHub API fetch with per-attempt timeout and limited retries for transient failures.
 */
export async function fetchWithGithubRetry(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const signal = AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(input, { ...init, signal })
      if (
        !res.ok &&
        shouldRetryHttp(res.status) &&
        attempt < MAX_ATTEMPTS - 1
      ) {
        await res.text()
        await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[1])
        continue
      }
      return res
    } catch (e) {
      if (isAbortError(e)) throw e
      if (e instanceof TypeError && attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BACKOFF_MS[attempt] ?? RETRY_BACKOFF_MS[1])
        continue
      }
      throw e
    }
  }
  throw new Error("fetchWithGithubRetry: exhausted retries")
}
