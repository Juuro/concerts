import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory-adapter"

function getAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET environment variable is required in production")
  }
  return secret ?? "placeholder-secret-replace-in-production"
}

// Minimal auth instance for session checking.
// This branch does not have a real database; the memory adapter is a
// placeholder so that auth.api.getSession() resolves safely (always returning
// null, i.e. every visitor is treated as a guest).  When the multi-tenancy
// branch is merged this file is replaced with the full Prisma-backed
// configuration that includes email/password, GitHub OAuth, and the admin plugin.
export const auth = betterAuth({
  database: memoryAdapter({}),
  secret: getAuthSecret(),
})
