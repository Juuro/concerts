export type UserAccountStatus =
  | "banned"
  | "reset_pending"
  | "unverified"
  | "active"

export type AuthProviderLabel = "email" | "github" | "both"

export interface UserAccountStatusInput {
  banned: boolean
  emailVerified: boolean
  hasPendingPasswordReset: boolean
}

const STATUS_LABELS: Record<UserAccountStatus, string> = {
  banned: "Banned",
  reset_pending: "Reset pending",
  unverified: "Unverified",
  active: "Active",
}

const AUTH_PROVIDER_LABELS: Record<AuthProviderLabel, string> = {
  email: "Email",
  github: "GitHub",
  both: "Email + GitHub",
}

/**
 * Derive the primary admin account status.
 * Priority: banned > reset_pending > unverified > active
 */
export function deriveUserAccountStatus(
  input: UserAccountStatusInput
): UserAccountStatus {
  if (input.banned) return "banned"
  if (input.hasPendingPasswordReset) return "reset_pending"
  if (!input.emailVerified) return "unverified"
  return "active"
}

export function getAccountStatusLabel(status: UserAccountStatus): string {
  return STATUS_LABELS[status]
}

/**
 * Map Better Auth provider IDs to display labels.
 */
export function deriveAuthProviderLabel(
  providerIds: string[]
): AuthProviderLabel | null {
  const hasCredential = providerIds.includes("credential")
  const hasGithub = providerIds.includes("github")

  if (hasCredential && hasGithub) return "both"
  if (hasCredential) return "email"
  if (hasGithub) return "github"
  return null
}

export function getAuthProviderLabel(label: AuthProviderLabel): string {
  return AUTH_PROVIDER_LABELS[label]
}
