---
name: ""
overview: ""
todos: []
isProject: false
---

# Sentry User Context (GDPR/DSGVO-Compliant) with Opt-Out

## Goal

Tie errors in Sentry to logged-in users by setting **only the internal user ID** (no email), with a **user-controlled opt-out** in Settings. Minimize PII sent to Sentry and document everything in the privacy policy.

## Data flow

- **Server**: Root layout gets session; only if `session?.user?.includeUserIdInErrorReports !== false` do we call `Sentry.setUser({ id })` and pass `userId` to the client; otherwise `setUser(null)` and pass `null`.
- **Client**: `SentryUserSetter` receives `userId` (or null) and calls `Sentry.setUser` in `useEffect`.
- **Opt-out**: New User field `includeUserIdInErrorReports` (default `true`), editable in Settings; root layout and API respect it.

---

## 1. Database and auth: opt-out field

**File:** [prisma/schema.prisma](prisma/schema.prisma)

- Add to `User` model:  
  `includeUserIdInErrorReports Boolean @default(true)`
- Create and run migration: `yarn db:migrate` (or `yarn db:push` for dev).

**File:** [src/lib/auth.ts](src/lib/auth.ts)

- In `user.additionalFields`, add:  
  `includeUserIdInErrorReports: { type: "boolean", required: false, defaultValue: true }`
- In `ExtendedUserFields`, add: `includeUserIdInErrorReports?: boolean`

**File:** [src/lib/auth-client.ts](src/lib/auth-client.ts)

- In `ExtendedUser`, add: `includeUserIdInErrorReports?: boolean`

---

## 2. Root layout: session + server-side Sentry user (respecting opt-out)

**File:** [app/layout.tsx](app/layout.tsx)

- Import `auth` from `@/lib/auth`, `headers` from `next/headers`, and Sentry.
- Get session: `const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)`.
- Compute effective user id for Sentry:  
  `const sentryUserId = session?.user && session.user.includeUserIdInErrorReports !== false ? session.user.id : null`.
- Call `Sentry.setUser(sentryUserId ? { id: sentryUserId } : null)`.
- Pass `sentryUserId` into the client component from step 3.

---

## 3. Client component: set Sentry user from prop

**New file:** e.g. `src/components/SentryUserSetter/SentryUserSetter.tsx`

- `"use client"` component with prop `userId: string | null`.
- In `useEffect`, call `Sentry.setUser(userId ? { id: userId } : null)` when `userId` changes.
- Render nothing (null).

**Integration:** In [app/layout.tsx](app/layout.tsx), render `<SentryUserSetter userId={sentryUserId} />` inside or next to `<Providers>`.

---

## 4. Privacy policy: Sentry and opt-out

**File:** [app/privacy/page.tsx](app/privacy/page.tsx)

- **Section 2 (Purposes and legal basis):** Add error and performance monitoring: purpose (detect, diagnose and fix errors; monitor performance); data (when logged in and not opted out, an internal user identifier only); legal basis (legitimate interest, Art. 6(1)(f) GDPR). Mention that users can **turn off** inclusion of their identifier in error reports in **Settings**.
- **Section 3 (Recipients and processors):** Add Sentry (error/performance monitoring; internal user ID when not opted out; USA; SCC/DPF; DPA Art. 28 GDPR).

---

## 5. Set sendDefaultPii to false

**Files:** [instrumentation-client.ts](instrumentation-client.ts), [sentry.server.config.ts](sentry.server.config.ts), [sentry.edge.config.ts](sentry.edge.config.ts)

- Set `**sendDefaultPii: false` in all three so only the explicit `setUser({ id })` identifies users.

---

## 6. Settings: opt-out toggle and API

**File:** [app/api/user/profile/route.ts](app/api/user/profile/route.ts)

- In the request body destructuring, add `includeUserIdInErrorReports`.
- In `prisma.user.update` `data`, add:  
  `...(typeof includeUserIdInErrorReports === "boolean" && { includeUserIdInErrorReports })`.
- Include `includeUserIdInErrorReports` in the JSON response.

**File:** [app/(protected)/settings/page.tsx](<app/(protected)/settings/page.tsx>)

- Add state: `const [includeUserIdInErrorReports, setIncludeUserIdInErrorReports] = useState(session?.user?.includeUserIdInErrorReports ?? true)`.
- In the `useEffect` that syncs from `session?.user`, set `setIncludeUserIdInErrorReports(session.user.includeUserIdInErrorReports ?? true)`.
- In the **Privacy** section, add a checkbox:  
  "Include my account identifier in error reports (helps us fix issues faster)".  
  Use `checked={includeUserIdInErrorReports}` and `onChange={(e) => setIncludeUserIdInErrorReports(e.target.checked)}`. Optional hint: "When enabled, we associate error reports with your account so we can fix problems; you can turn this off at any time."
- In `handleSubmit`, include `includeUserIdInErrorReports` in the `JSON.stringify` body sent to `PUT /api/user/profile`.

---

## Summary checklist

| Step | Action                                                                                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Prisma: add `includeUserIdInErrorReports` to User; run migration. Auth: add field to `additionalFields` and `ExtendedUserFields`. Auth-client: add to `ExtendedUser`. |
| 2    | Root layout: get session, compute `sentryUserId` from opt-out, call `Sentry.setUser`, pass `sentryUserId` to client.                                                  |
| 3    | New `SentryUserSetter` client component; mount in layout with `userId={sentryUserId}`.                                                                                |
| 4    | Privacy policy: Sentry purpose, data, legal basis, and opt-out in Settings.                                                                                           |
| 5    | Set `sendDefaultPii: false` in all three Sentry config files.                                                                                                         |
| 6    | Profile API: accept and persist `includeUserIdInErrorReports`. Settings page: checkbox in Privacy section and include in save payload.                                |

After implementation, ensure a DPA with Sentry is in place.
