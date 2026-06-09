import { afterEach, describe, expect, test, vi } from "vitest"

vi.unmock("@/lib/prisma")

const { resolveDatabaseConnectionString } = await import("@/lib/prisma")

const ENV_KEYS = [
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_URL_NON_POOLING",
] as const

function clearDatabaseEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key]
  }
}

describe("resolveDatabaseConnectionString", () => {
  afterEach(() => {
    clearDatabaseEnv()
  })

  test("prefers POSTGRES_PRISMA_URL when set", () => {
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://pool.example.com:5432/db?sslmode=require"
    process.env.DATABASE_URL = "postgresql://direct.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://pool.example.com:5432/db?sslmode=require"
    )
  })

  test("falls back to POSTGRES_URL when prisma url is unset", () => {
    process.env.POSTGRES_URL = "postgresql://vercel.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://vercel.example.com:5432/db"
    )
  })

  test("skips prisma protocol urls and uses postgres url", () => {
    process.env.DATABASE_URL = "prisma+postgres://accelerate.example.com/db"
    process.env.POSTGRES_URL = "postgresql://vercel.example.com:5432/db"

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://vercel.example.com:5432/db"
    )
  })

  test("throws when no postgres url is configured", () => {
    expect(() => resolveDatabaseConnectionString()).toThrow(
      /Missing database URL/
    )
  })
})
