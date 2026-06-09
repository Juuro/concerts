import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, type PoolConfig } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

/**
 * Vercel serverless: default pg pool size (10) × many warm isolates exhausts
 * Postgres connection limits. Prefer POSTGRES_PRISMA_URL (pooled) and cap max.
 */
function createPoolConfig(): PoolConfig {
  const connectionString =
    process.env["POSTGRES_PRISMA_URL"] || process.env["DATABASE_URL"]

  const onVercel = process.env.VERCEL === "1"
  const fromEnv = process.env.PG_POOL_MAX
  let max = onVercel ? 1 : 10
  if (fromEnv != null && fromEnv !== "") {
    const parsed = parseInt(fromEnv, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      max = parsed
    }
  }

  return {
    connectionString,
    max,
    idleTimeoutMillis: onVercel ? 20_000 : 30_000,
    ...(onVercel ? { allowExitOnIdle: true } : {}),
  }
}

const pool = globalForPrisma.pgPool ?? new Pool(createPoolConfig())
if (globalForPrisma.pgPool === undefined) {
  globalForPrisma.pgPool = pool
}

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (globalForPrisma.prisma === undefined) {
  globalForPrisma.prisma = prisma
}
