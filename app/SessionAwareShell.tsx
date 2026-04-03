import { headers } from "next/headers"
import * as Sentry from "@sentry/nextjs"
import { auth } from "@/lib/auth"
import SentryUserSetter from "@/components/SentryUserSetter/SentryUserSetter"

export default async function SessionAwareShell({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null)

  const sentryUserId =
    session?.user && session.user.includeUserIdInErrorReports !== false
      ? session.user.id
      : null

  Sentry.setUser(sentryUserId ? { id: sentryUserId } : null)

  return (
    <>
      <SentryUserSetter userId={sentryUserId} />
      {children}
    </>
  )
}
