import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool, type PoolConfig } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: Pool | undefined
}

/**
 * Read server env at request time. Next.js 16 + Turbopack can replace
 * `process.env.DATABASE_URL` at build with `undefined`; dynamic keys avoid that.
 */
function readRuntimeEnv(key: string): string | undefined {
  const value = process.env[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

function postgresPrismaUrlEnv(): string | undefined {
  return readRuntimeEnv(["POSTGRES", "_PRISMA", "_URL"].join(""))
}

function databaseUrlEnv(): string | undefined {
  return readRuntimeEnv(["DATA", "BASE", "_URL"].join(""))
}

function postgresUrlEnv(): string | undefined {
  return readRuntimeEnv(["POSTGRES", "_URL"].join(""))
}

function postgresUrlNonPoolingEnv(): string | undefined {
  return readRuntimeEnv(["POSTGRES", "_URL", "_NON_POOLING"].join(""))
}

function isDirectPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://")
}

/**
 * Resolve a postgres:// URL for the `pg` driver. Skips prisma:// URLs.
 */
export function resolveDatabaseConnectionString(): string {
  const candidates = [
    postgresPrismaUrlEnv(),
    databaseUrlEnv(),
    postgresUrlEnv(),
    postgresUrlNonPoolingEnv(),
  ]

  // [DBDIAG-MARKER-v7] temporary diagnostic — remove after debugging
  const diag = candidates.map((v) => {
    if (!v) return "absent"
    try {
      return new URL(v).host
    } catch {
      return `unparseable(${v.slice(0, 12)})`
    }
  })
  console.warn(
    `[DBDIAG-MARKER-v7] VERCEL=${process.env["VERCEL"]} candidates(prisma,database,url,nonpool)=${JSON.stringify(diag)}`
  )

  for (const value of candidates) {
    if (value && isDirectPostgresUrl(value)) {
      return value
    }
  }

  throw new Error(
    "[DBDIAG-MARKER-v7] Missing database URL. Set POSTGRES_PRISMA_URL, DATABASE_URL, or POSTGRES_URL " +
      "to a postgres:// connection string."
  )
}

/**
 * Vercel serverless: default pg pool size (10) × many warm isolates exhausts
 * Postgres connection limits. Prefer POSTGRES_PRISMA_URL (pooled) and cap max.
 */
function createPoolConfig(): PoolConfig {
  const connectionString = resolveDatabaseConnectionString()

  const onVercel = readRuntimeEnv(["VER", "CEL"].join("")) === "1"
  const fromEnv = readRuntimeEnv(["PG", "_POOL", "_MAX"].join(""))
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

function createPrismaClient(): PrismaClient {
  const pool = new Pool(createPoolConfig())
  globalForPrisma.pgPool = pool

  const adapter = new PrismaPg(pool)
  const isDevelopment =
    readRuntimeEnv(["NODE", "_ENV"].join("")) === "development"

  return new PrismaClient({
    adapter,
    log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  })
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
}

/**
 * Lazy Prisma singleton. Defers pool creation until the first query so Vercel
 * runtime env vars are available (not build-time undefined from Turbopack).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient()
    const value = Reflect.get(client, prop) as unknown

    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client)
    }

    return value
  },
})
