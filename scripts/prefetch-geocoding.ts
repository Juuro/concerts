/**
 * Prebuild: reverse-geocode concert coordinates via Photon and write JSON cache.
 *
 * Run: yarn tsx --env-file=.env scripts/prefetch-geocoding.ts
 * Requires: DATABASE_URL (direct postgres, not prisma://)
 */

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

function loadDotEnvFile() {
  const envPath = path.join(process.cwd(), ".env")
  if (!fs.existsSync(envPath)) return

  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!key) continue
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function parseBoolean(value: string | undefined, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue
  const normalized = String(value).toLowerCase().trim()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}

function sleep(ms: number) {
  if (!ms || ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function safeMkdirp(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function getCachePath() {
  const nextCacheDir = path.join(process.cwd(), ".next", "cache")
  if (fs.existsSync(path.join(process.cwd(), ".next"))) {
    safeMkdirp(nextCacheDir)
    return path.join(nextCacheDir, "geocoding.json")
  }

  const fallbackDir = path.join(process.cwd(), ".cache")
  safeMkdirp(fallbackDir)
  return path.join(fallbackDir, "geocoding.json")
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

function coordKey(lat: unknown, lon: unknown) {
  const latN = typeof lat === "number" ? lat : Number(lat)
  const lonN = typeof lon === "number" ? lon : Number(lon)
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return ""
  return `${latN.toFixed(6)},${lonN.toFixed(6)}`
}

function formatCoordinates(lat: unknown, lon: unknown) {
  const latN = typeof lat === "number" ? lat : Number(lat)
  const lonN = typeof lon === "number" ? lon : Number(lon)
  if (!Number.isFinite(latN) || !Number.isFinite(lonN)) return ""
  return `${latN.toFixed(3)}, ${lonN.toFixed(3)}`
}

function readExistingCache(cachePath: string) {
  try {
    const raw = fs.readFileSync(cachePath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      "locations" in parsed &&
      typeof (parsed as { locations: unknown }).locations === "object" &&
      (parsed as { locations: unknown }).locations !== null
    ) {
      return (parsed as { locations: Record<string, unknown> }).locations
    }
  } catch {
    // ignore
  }
  return null
}

function createPrisma(): { prisma: PrismaClient; pool: Pool } | null {
  const connectionString = process.env["DATABASE_URL"]
  if (!connectionString) {
    console.warn("[geocoding prefetch] Missing DATABASE_URL; skipping.")
    return null
  }
  if (connectionString.startsWith("prisma://")) {
    console.warn(
      "[geocoding prefetch] Prisma Accelerate URLs are not supported; use a direct postgres URL. Skipping."
    )
    return null
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  return { prisma, pool }
}

async function getAllConcertCoordinatesFromDatabase(prisma: PrismaClient) {
  const rows = await prisma.concert.findMany({
    select: { latitude: true, longitude: true },
  })

  const coords: { key: string; lat: number; lon: number }[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const key = coordKey(row.latitude, row.longitude)
    if (!key || seen.has(key)) continue
    seen.add(key)
    coords.push({
      key,
      lat: Number(row.latitude),
      lon: Number(row.longitude),
    })
  }
  return coords
}

async function fetchPhotonReverse({
  baseUrl,
  lat,
  lon,
  timeoutMs,
}: {
  baseUrl: string
  lat: number
  lon: number
  timeoutMs: number
}) {
  const url = new URL("/reverse", baseUrl)
  url.searchParams.set("lat", String(lat))
  url.searchParams.set("lon", String(lon))
  url.searchParams.set("limit", "1")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })

    const text = await res.text()
    let json: unknown
    try {
      json = JSON.parse(text) as unknown
    } catch {
      json = null
    }

    return { status: res.status, ok: res.ok, json }
  } finally {
    clearTimeout(timeout)
  }
}

function normalizePhotonToGeocodingData(
  lat: number,
  lon: number,
  photonJson: unknown
) {
  const features = Array.isArray(
    (photonJson as { features?: unknown })?.features
  )
    ? (photonJson as { features: unknown[] }).features
    : []
  const first = features[0] as { properties?: unknown } | undefined
  const props =
    first?.properties && typeof first.properties === "object"
      ? (first.properties as Record<string, unknown>)
      : {}

  const city =
    (props.city as string) ||
    (props.locality as string) ||
    (props.name as string) ||
    (props.county as string) ||
    (props.state as string) ||
    ""

  if (typeof city === "string" && city.trim()) {
    return {
      _normalized_city: city.trim(),
      city: typeof props.city === "string" ? props.city : undefined,
      locality: typeof props.locality === "string" ? props.locality : undefined,
      name: typeof props.name === "string" ? props.name : undefined,
      county: typeof props.county === "string" ? props.county : undefined,
      state: typeof props.state === "string" ? props.state : undefined,
      country: typeof props.country === "string" ? props.country : undefined,
    }
  }

  return {
    _normalized_city: formatCoordinates(lat, lon),
    _is_coordinates: true,
  }
}

async function writeCache(
  cachePath: string,
  locations: Record<string, unknown>,
  meta: Record<string, unknown>
) {
  const payload = {
    generatedAt: new Date().toISOString(),
    locations,
    meta,
  }
  safeMkdirp(path.dirname(cachePath))
  fs.writeFileSync(cachePath, JSON.stringify(payload), "utf8")
  console.log(`[geocoding prefetch] Wrote cache: ${cachePath}`)
}

async function main() {
  loadDotEnvFile()

  const enabled = parseBoolean(process.env.ENABLE_GEOCODING, true)
  if (!enabled) {
    console.log("[geocoding prefetch] ENABLE_GEOCODING is off; skipping.")
    return
  }

  const baseUrl = process.env.PHOTON_BASE_URL || "https://photon.komoot.io"
  const ctx = createPrisma()
  if (!ctx) return

  const { prisma, pool } = ctx

  try {
    const cachePath = getCachePath()
    const existingLocations = readExistingCache(cachePath)
    const coords = await getAllConcertCoordinatesFromDatabase(prisma)

    console.log(
      `[geocoding prefetch] Fetching ${coords.length} locations -> ${cachePath}`
    )

    const MIN_INTERVAL_MS = 700
    const MAX_TRANSIENT_RETRIES = 2
    const RATE_LIMIT_COOLDOWN_MS = 30_000
    const REQUEST_TIMEOUT_MS = 8000
    const MAX_TOTAL_MS = 5 * 60 * 1000
    const startedAt = Date.now()

    const locations: Record<string, unknown> = existingLocations
      ? { ...existingLocations }
      : {}
    let lastStartAt = 0

    for (let i = 0; i < coords.length; i++) {
      const { key, lat, lon } = coords[i]

      const existing = locations[key]
      const isFallback =
        existing &&
        typeof existing === "object" &&
        existing !== null &&
        "_is_coordinates" in existing &&
        (existing as { _is_coordinates?: boolean })._is_coordinates === true
      if (Object.prototype.hasOwnProperty.call(locations, key) && !isFallback) {
        continue
      }

      if (Date.now() - startedAt > MAX_TOTAL_MS) {
        console.warn(
          "[geocoding prefetch] Time budget exceeded; stopping early (soft)."
        )
        await writeCache(cachePath, locations, {
          stoppedEarly: true,
          reason: "time_budget_exceeded",
        })
        return
      }

      const now = Date.now()
      const waitMs = Math.max(0, lastStartAt + MIN_INTERVAL_MS - now)
      if (waitMs > 0) await sleep(waitMs)
      lastStartAt = Date.now()

      let attempt = 0
      while (true) {
        try {
          const { status, ok, json } = await fetchPhotonReverse({
            baseUrl,
            lat,
            lon,
            timeoutMs: REQUEST_TIMEOUT_MS,
          })

          if (status === 429) {
            const remainingMs = Math.max(
              0,
              MAX_TOTAL_MS - (Date.now() - startedAt)
            )
            if (remainingMs < RATE_LIMIT_COOLDOWN_MS) {
              console.warn(
                "[geocoding prefetch] Rate limited (429) near time budget end. Stopping early (soft)."
              )
              await writeCache(cachePath, locations, {
                stoppedEarly: true,
                reason: "rate_limited_429",
              })
              return
            }

            console.warn(
              `[geocoding prefetch] Rate limited (429). Cooling down ${RATE_LIMIT_COOLDOWN_MS}ms and retrying...`
            )
            await sleep(RATE_LIMIT_COOLDOWN_MS)
            continue
          }

          const isServerError = status >= 500
          const isInvalidJson = ok && json === null
          if (
            (isServerError || isInvalidJson) &&
            attempt < MAX_TRANSIENT_RETRIES
          ) {
            attempt += 1
            const backoffMs = 1000 * attempt
            await sleep(backoffMs)
            continue
          }

          if (!ok) {
            if (!Object.prototype.hasOwnProperty.call(locations, key)) {
              locations[key] = {
                _normalized_city: formatCoordinates(lat, lon),
                _is_coordinates: true,
              }
            }
            break
          }

          const normalized = normalizePhotonToGeocodingData(lat, lon, json)
          locations[key] = normalized
          break
        } catch (err) {
          const msg = getErrorMessage(err)
          if (
            attempt < MAX_TRANSIENT_RETRIES &&
            (/timeout/i.test(msg) ||
              /ECONNRESET/i.test(msg) ||
              /socket hang up/i.test(msg))
          ) {
            attempt += 1
            await sleep(1000 * attempt)
            continue
          }

          console.warn(`[geocoding prefetch] Error for ${key}: ${msg}`)
          if (!Object.prototype.hasOwnProperty.call(locations, key)) {
            locations[key] = {
              _normalized_city: formatCoordinates(lat, lon),
              _is_coordinates: true,
            }
          }
          break
        }
      }

      if ((i + 1) % 25 === 0 || i === coords.length - 1) {
        console.log(`[geocoding prefetch] Progress: ${i + 1}/${coords.length}`)
      }
    }

    await writeCache(cachePath, locations, { stoppedEarly: false, baseUrl })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

void main().catch((err) => {
  console.warn(`[geocoding prefetch] Failed (soft): ${getErrorMessage(err)}`)
})
