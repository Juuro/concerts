-- AlterTable
ALTER TABLE "user_concert" ADD COLUMN IF NOT EXISTS "bandOverrideIds" JSONB;
