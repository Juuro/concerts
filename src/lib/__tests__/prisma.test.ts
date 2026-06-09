import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { poolInstances, prismaClientInstances, Pool, PrismaPg, PrismaClient } =
  vi.hoisted(() => {
    const poolInstances: Array<{ config: Record<string, unknown> }> = []
    const prismaClientInstances: Array<{
      opts: { log: string[] }
      user: { findMany: ReturnType<typeof vi.fn> }
      $connect: ReturnType<typeof vi.fn>
    }> = []

    class MockPool {
      config: Record<string, unknown>
      end = vi.fn()

      constructor(config: Record<string, unknown>) {
        this.config = config
        poolInstances.push(this)
      }
    }

    class MockPrismaClient {
      opts: { log: string[] }
      user = { findMany: vi.fn() }
      $connect = vi.fn()

      constructor(opts: { log: string[] }) {
        this.opts = opts
        prismaClientInstances.push(this)
      }
    }

    class MockPrismaPg {
      pool: unknown

      constructor(pool: unknown) {
        this.pool = pool
      }
    }

    const Pool = vi.fn(MockPool)
    const PrismaPg = vi.fn(MockPrismaPg)
    const PrismaClient = vi.fn(MockPrismaClient)

    return {
      poolInstances,
      prismaClientInstances,
      Pool,
      PrismaPg,
      PrismaClient,
    }
  })

vi.mock("pg", () => ({ Pool }))
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg }))
vi.mock("@/generated/prisma/client", () => ({ PrismaClient }))
vi.unmock("@/lib/prisma")

const DATABASE_ENV_KEYS = [
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
] as const

const RUNTIME_ENV_KEYS = [
  ...DATABASE_ENV_KEYS,
  "VERCEL",
  "PG_POOL_MAX",
  "NODE_ENV",
] as const

function clearRuntimeEnv(): void {
  for (const key of RUNTIME_ENV_KEYS) {
    delete process.env[key]
  }
}

function clearPrismaGlobals(): void {
  const globalForPrisma = globalThis as {
    prisma?: unknown
    pgPool?: unknown
  }
  delete globalForPrisma.prisma
  delete globalForPrisma.pgPool
}

function resetTestState(): void {
  vi.unstubAllEnvs()
  clearRuntimeEnv()
  clearPrismaGlobals()
  poolInstances.length = 0
  prismaClientInstances.length = 0
  vi.clearAllMocks()
}

async function importPrismaModule() {
  return import("@/lib/prisma")
}

describe("resolveDatabaseConnectionString", () => {
  let resolveDatabaseConnectionString: () => string

  beforeEach(async () => {
    resetTestState()
    ;({ resolveDatabaseConnectionString } = await importPrismaModule())
  })

  afterEach(() => {
    resetTestState()
  })

  test("prefers POSTGRES_PRISMA_URL when set", () => {
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://pool.example.com:5432/db?sslmode=require"
    process.env.DATABASE_URL = "postgresql://direct.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://pool.example.com:5432/db?sslmode=require"
    )
  })

  test("falls back to DATABASE_URL when prisma url is unset", () => {
    process.env.DATABASE_URL = "postgresql://direct.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://direct.example.com:5432/db"
    )
  })

  test("falls back to POSTGRES_URL when higher-priority urls are unset", () => {
    process.env.POSTGRES_URL = "postgresql://vercel.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://vercel.example.com:5432/db"
    )
  })

  test("falls back to POSTGRES_URL_NON_POOLING as last resort", () => {
    process.env.POSTGRES_URL_NON_POOLING =
      "postgres://non-pooling.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgres://non-pooling.example.com:5432/db"
    )
  })

  test("skips prisma protocol urls and uses postgres url", () => {
    process.env.DATABASE_URL = "prisma+postgres://accelerate.example.com/db"
    process.env.POSTGRES_URL = "postgresql://vercel.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://vercel.example.com:5432/db"
    )
  })

  test("ignores empty env values and continues to the next candidate", () => {
    process.env.POSTGRES_PRISMA_URL = ""
    process.env.DATABASE_URL = "postgresql://direct.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://direct.example.com:5432/db"
    )
  })

  test("throws when no postgres url is configured", () => {
    expect(() => resolveDatabaseConnectionString()).toThrow(
      /Missing database URL/
    )
  })
})

describe("prisma lazy initialization", () => {
  let prisma: Awaited<ReturnType<typeof importPrismaModule>>["prisma"]

  beforeEach(async () => {
    resetTestState()
    process.env.POSTGRES_URL = "postgresql://test.example.com:5432/db"
    ;({ prisma } = await importPrismaModule())
  })

  afterEach(() => {
    resetTestState()
  })

  test("creates a singleton client and pg pool on first access", () => {
    const userModel = prisma.user
    const connect = prisma.$connect

    expect(PrismaClient).toHaveBeenCalledTimes(1)
    expect(Pool).toHaveBeenCalledTimes(1)
    expect(PrismaPg).toHaveBeenCalledTimes(1)
    expect(userModel).toBe(prismaClientInstances[0]?.user)
    expect(typeof connect).toBe("function")
    expect(connect).not.toBe(prismaClientInstances[0]?.$connect)
  })

  test("reuses the cached client on subsequent access", () => {
    void prisma.user
    void prisma.$connect

    expect(PrismaClient).toHaveBeenCalledTimes(1)
    expect(Pool).toHaveBeenCalledTimes(1)
  })

  test("uses a small pool on Vercel", () => {
    process.env.VERCEL = "1"

    void prisma.user

    expect(poolInstances[0]?.config).toMatchObject({
      connectionString: "postgresql://test.example.com:5432/db",
      max: 1,
      idleTimeoutMillis: 20_000,
      allowExitOnIdle: true,
    })
  })

  test("uses a larger default pool outside Vercel", () => {
    void prisma.user

    expect(poolInstances[0]?.config).toMatchObject({
      connectionString: "postgresql://test.example.com:5432/db",
      max: 10,
      idleTimeoutMillis: 30_000,
    })
    expect(poolInstances[0]?.config.allowExitOnIdle).toBeUndefined()
  })

  test("honors PG_POOL_MAX when it is a positive integer", () => {
    process.env.PG_POOL_MAX = "5"

    void prisma.user

    expect(poolInstances[0]?.config.max).toBe(5)
  })

  test("ignores invalid PG_POOL_MAX values", () => {
    process.env.PG_POOL_MAX = "not-a-number"

    void prisma.user

    expect(poolInstances[0]?.config.max).toBe(10)
  })

  test("enables verbose prisma logging in development", () => {
    vi.stubEnv("NODE_ENV", "development")

    void prisma.user

    expect(prismaClientInstances[0]?.opts.log).toEqual([
      "query",
      "error",
      "warn",
    ])
  })

  test("limits prisma logging to errors outside development", () => {
    vi.stubEnv("NODE_ENV", "production")

    void prisma.user

    expect(prismaClientInstances[0]?.opts.log).toEqual(["error"])
  })
})
