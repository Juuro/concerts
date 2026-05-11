/**
 * Prebuild: fetch Last.fm artist metadata for band names in Postgres and write JSON cache.
 *
 * Run: yarn tsx --env-file=.env scripts/prefetch-lastfm.ts
 * Requires: DATABASE_URL (direct postgres, not prisma://), LASTFM_API_KEY, ENABLE_LASTFM=true
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
    return path.join(nextCacheDir, "lastfm-artists.json")
  }

  const fallbackDir = path.join(process.cwd(), ".cache")
  safeMkdirp(fallbackDir)
  return path.join(fallbackDir, "lastfm-artists.json")
}

function normalizeKey(name: string) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

function getLastFmErrorCode(err: unknown) {
  const msg = getErrorMessage(err)
  const match = msg.match(/\(Code\s+(\d+)\)/i) ?? msg.match(/Code\s+(\d+)/i)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function readExistingCache(cachePath: string) {
  try {
    const raw = fs.readFileSync(cachePath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === "object" &&
      "artists" in parsed &&
      typeof (parsed as { artists: unknown }).artists === "object" &&
      (parsed as { artists: unknown }).artists !== null
    ) {
      return (parsed as { artists: Record<string, unknown> }).artists
    }
  } catch {
    // ignore
  }
  return null
}

function createPrisma(): { prisma: PrismaClient; pool: Pool } | null {
  const connectionString = process.env["DATABASE_URL"]
  if (!connectionString) {
    console.warn("[lastfm prefetch] Missing DATABASE_URL; skipping.")
    return null
  }
  if (connectionString.startsWith("prisma://")) {
    console.warn(
      "[lastfm prefetch] Prisma Accelerate URLs are not supported; use a direct postgres URL. Skipping."
    )
    return null
  }
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  return { prisma, pool }
}

async function getAllBandNamesFromDatabase(
  prisma: PrismaClient
): Promise<string[]> {
  const rows = await prisma.band.findMany({
    where: { slug: { not: "data-schema" } },
    select: { name: true },
    orderBy: { name: "asc" },
  })
  const names: string[] = []
  for (const row of rows) {
    if (typeof row.name === "string" && row.name.trim()) {
      names.push(row.name.trim())
    }
  }
  return Array.from(new Set(names))
}

async function fetchArtistInfo(
  apiKey: string,
  name: string,
  { timeoutMs }: { timeoutMs: number }
) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/")
  url.searchParams.set("method", "artist.getinfo")
  url.searchParams.set("artist", name)
  url.searchParams.set("autocorrect", "1")
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("format", "json")

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
      throw new Error("Unable to parse API response to JSON")
    }

    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      json.error != null
    ) {
      const code = (json as { error: unknown }).error
      const message =
        typeof (json as { message?: string }).message === "string"
          ? (json as { message: string }).message
          : "Last.fm error"
      throw new Error(`${message} (Code ${String(code)})`)
    }

    return json
  } finally {
    clearTimeout(timeout)
  }
}

function mapToCacheShape(lastfmResponse: unknown) {
  if (
    !lastfmResponse ||
    typeof lastfmResponse !== "object" ||
    !("artist" in lastfmResponse)
  ) {
    return null
  }
  const artistData = (lastfmResponse as { artist?: unknown }).artist as
    | Record<string, unknown>
    | undefined
  if (!artistData) return null

  const images = Array.isArray(artistData.image) ? artistData.image : []
  const imageUrls: Record<string, string | null> = {
    small: null,
    medium: null,
    large: null,
    extralarge: null,
    mega: null,
  }

  for (const img of images) {
    if (!img || typeof img !== "object") continue
    const o = img as Record<string, unknown>
    const size = o.size
    const url = (o["#text"] as string) || (o.url as string) || null
    if (typeof size !== "string" || !url) continue
    if (size === "small") imageUrls.small = url
    else if (size === "medium") imageUrls.medium = url
    else if (size === "large") imageUrls.large = url
    else if (size === "extralarge") imageUrls.extralarge = url
    else if (size === "mega") imageUrls.mega = url
  }

  const tagsRaw = artistData.tags
  let tagList: unknown[] = []
  if (
    tagsRaw &&
    typeof tagsRaw === "object" &&
    "tag" in tagsRaw &&
    Array.isArray((tagsRaw as { tag: unknown }).tag)
  ) {
    tagList = (tagsRaw as { tag: unknown[] }).tag
  }
  const genres = tagList
    .map((t) => (typeof t === "string" ? t : (t as { name?: string })?.name))
    .filter((g): g is string => typeof g === "string" && g.trim().length > 0)

  const bio =
    artistData.bio &&
    typeof artistData.bio === "object" &&
    "summary" in (artistData.bio as object)
      ? String((artistData.bio as { summary?: string }).summary ?? "")
      : null

  return {
    name: String(artistData.name ?? ""),
    url: typeof artistData.url === "string" ? artistData.url : undefined,
    images: imageUrls,
    genres,
    bio,
  }
}

async function writeCache(
  cachePath: string,
  artists: Record<string, unknown>,
  meta: Record<string, unknown>
) {
  const payload = {
    generatedAt: new Date().toISOString(),
    artists,
    meta,
  }
  safeMkdirp(path.dirname(cachePath))
  fs.writeFileSync(cachePath, JSON.stringify(payload), "utf8")
  console.log(`[lastfm prefetch] Wrote cache: ${cachePath}`)
}

async function main() {
  loadDotEnvFile()

  const enabled = parseBoolean(process.env.ENABLE_LASTFM, false)
  if (!enabled) {
    console.log("[lastfm prefetch] ENABLE_LASTFM is off; skipping.")
    return
  }

  if (!process.env.LASTFM_API_KEY) {
    console.warn("[lastfm prefetch] Missing LASTFM_API_KEY; skipping.")
    return
  }

  const apiKey = process.env.LASTFM_API_KEY
  const ctx = createPrisma()
  if (!ctx) return

  const { prisma, pool } = ctx

  try {
    const cachePath = getCachePath()
    const existingArtists = readExistingCache(cachePath)
    const bandNames = await getAllBandNamesFromDatabase(prisma)

    console.log(
      `[lastfm prefetch] Fetching ${bandNames.length} artists -> ${cachePath}`
    )

    const MIN_INTERVAL_MS = 700
    const MAX_TIMEOUT_RETRIES = 1
    const REQUEST_TIMEOUT_MS = 8000
    const MAX_TOTAL_MS = 5 * 60 * 1000
    const startedAt = Date.now()

    const artists: Record<string, unknown> = existingArtists
      ? { ...existingArtists }
      : {}
    let lastStartAt = 0

    for (let i = 0; i < bandNames.length; i++) {
      const name = bandNames[i]
      const key = normalizeKey(name)
      if (!key) continue

      if (Object.prototype.hasOwnProperty.call(artists, key)) {
        continue
      }

      if (Date.now() - startedAt > MAX_TOTAL_MS) {
        console.warn(
          "[lastfm prefetch] Time budget exceeded; stopping early (soft)."
        )
        await writeCache(cachePath, artists, {
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
          const res = await fetchArtistInfo(apiKey, name, {
            timeoutMs: REQUEST_TIMEOUT_MS,
          })
          artists[key] = mapToCacheShape(res)
          break
        } catch (err) {
          const msg = getErrorMessage(err)
          const code = getLastFmErrorCode(err)

          if (
            code === 6 ||
            code === 7 ||
            /could not be found/i.test(msg) ||
            /\bnot found\b/i.test(msg)
          ) {
            artists[key] = null
            break
          }

          if (code === 10 || code === 26) {
            console.warn(
              `[lastfm prefetch] API key error (code ${code}). Stopping prefetch early.`
            )
            await writeCache(cachePath, artists, {
              stoppedEarly: true,
              reason: `api_key_${code}`,
            })
            return
          }

          if (code === 29 || /rate\s*limit/i.test(msg)) {
            console.warn(
              "[lastfm prefetch] Rate limited (code 29). Stopping early to avoid clogging the API."
            )
            artists[key] = null
            await writeCache(cachePath, artists, {
              stoppedEarly: true,
              reason: "rate_limited",
            })
            return
          }

          if (
            /timeout/i.test(msg) ||
            /timed out/i.test(msg) ||
            /ECONNRESET/i.test(msg) ||
            /socket hang up/i.test(msg)
          ) {
            if (attempt < MAX_TIMEOUT_RETRIES) {
              attempt += 1
              await sleep(1000)
              continue
            }
            artists[key] = null
            break
          }

          console.warn(`[lastfm prefetch] Error for "${name}": ${msg}`)
          artists[key] = null
          break
        }
      }

      if ((i + 1) % 25 === 0 || i === bandNames.length - 1) {
        console.log(`[lastfm prefetch] Progress: ${i + 1}/${bandNames.length}`)
      }
    }

    await writeCache(cachePath, artists, { stoppedEarly: false })
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

void main().catch((err) => {
  console.warn(`[lastfm prefetch] Failed (soft): ${getErrorMessage(err)}`)
})
