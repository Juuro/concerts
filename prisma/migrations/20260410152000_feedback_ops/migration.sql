-- CreateEnum
CREATE TYPE "AppFeedbackTriageStatus" AS ENUM ('NEW', 'TRIAGED', 'IN_PROGRESS', 'DONE', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AppFeedbackPriority" AS ENUM ('P1', 'P2', 'P3', 'P4', 'P5');

-- AlterTable
ALTER TABLE "app_feedback"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "triageStatus" "AppFeedbackTriageStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "priority" "AppFeedbackPriority" NOT NULL DEFAULT 'P3',
ADD COLUMN "ownerUserId" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "githubIssueNumber" INTEGER,
ADD COLUMN "githubIssueUrl" VARCHAR(512),
ADD COLUMN "githubProjectItemId" VARCHAR(128),
ADD COLUMN "triagedAt" TIMESTAMP(3),
ADD COLUMN "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "app_feedback_updatedAt_idx" ON "app_feedback"("updatedAt");
CREATE INDEX "app_feedback_triageStatus_idx" ON "app_feedback"("triageStatus");
CREATE INDEX "app_feedback_priority_idx" ON "app_feedback"("priority");
CREATE INDEX "app_feedback_ownerUserId_idx" ON "app_feedback"("ownerUserId");

-- AddForeignKey
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
