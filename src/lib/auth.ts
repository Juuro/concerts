import { betterAuth, APIError } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins/admin"
import { prisma } from "./prisma"
import { sendVerificationEmail, sendPasswordResetEmail } from "./email"
import { checkUserBan } from "./ban"

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3000"
}

export const auth = betterAuth({
  baseURL: getBaseURL(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url)
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const banStatus = await checkUserBan(session.userId)
          if (banStatus.banned) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been suspended",
            })
          }
          // Return void to proceed with session creation
        },
      },
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        unique: true,
      },
      isPublic: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      currency: {
        type: "string",
        required: false,
        defaultValue: "EUR",
      },
      hideLocationPublic: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      hideCostPublic: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      includeUserIdInErrorReports: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      // Added by admin plugin, declared here for TypeScript inference
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
      },
    },
  },
})

// Base session type from Better Auth
type BaseSession = typeof auth.$Infer.Session

// Extended user fields from additionalFields config and admin plugin
interface ExtendedUserFields {
  role?: string
  username?: string | null
  isPublic?: boolean
  currency?: string
  hideLocationPublic?: boolean
  hideCostPublic?: boolean
  includeUserIdInErrorReports?: boolean
  banned?: boolean
  banReason?: string | null
  banExpires?: Date | null
}

// Extended session type including all custom user fields
export type Session = Omit<BaseSession, "user"> & {
  user: BaseSession["user"] & ExtendedUserFields
}

/**
 * Get session with proper typing for role field (added by admin plugin)
 */
export async function getSession(headers: Headers): Promise<Session | null> {
  const session = await auth.api.getSession({ headers })
  return session as Session | null
}
