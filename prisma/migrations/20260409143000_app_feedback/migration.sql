-- CreateEnum
CREATE TYPE "AppFeedbackCategory" AS ENUM ('BUG', 'FEATURE', 'GENERAL');

-- CreateTable
CREATE TABLE "app_feedback" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "AppFeedbackCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "pagePath" VARCHAR(512),
    "userAgent" VARCHAR(512),

    CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_feedback_createdAt_idx" ON "app_feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
