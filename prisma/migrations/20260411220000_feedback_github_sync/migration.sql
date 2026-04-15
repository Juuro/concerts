-- CreateEnum
CREATE TYPE "GithubIssueState" AS ENUM ('OPEN', 'CLOSED');

-- AlterTable
ALTER TABLE "app_feedback"
ADD COLUMN "githubIssueState" "GithubIssueState",
ADD COLUMN "githubSyncedAt" TIMESTAMP(3);

-- Backfill linked issues as OPEN (best-effort; admins can refresh for truth)
UPDATE "app_feedback"
SET
  "githubIssueState" = 'OPEN',
  "githubSyncedAt" = COALESCE("updatedAt", "createdAt")
WHERE "githubIssueNumber" IS NOT NULL;
