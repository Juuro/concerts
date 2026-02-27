// Type augmentation for Better Auth to include custom user fields
declare module "better-auth" {
  interface User {
    role?: string
    username?: string | null
    isPublic?: boolean
    currency?: string
    hideLocationPublic?: boolean
    hideCostPublic?: boolean
    banned?: boolean
    banReason?: string | null
    banExpires?: Date | null
  }
}

export {}
