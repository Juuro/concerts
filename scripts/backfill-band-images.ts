/**
 * Backfill script to populate band images from MusicBrainz/Wikidata/Wikimedia Commons
 *
 * Run with: yarn backfill:images
 *
 * Flags:
 *   --overwrite    Replace existing image URLs (default: only fill missing)
 *   --dry-run      Log what would be updated without writing to DB
 */

import "dotenv/config"
import { prisma } from "../src/lib/prisma"

const USER_AGENT = "ConcertsApp/1.0.0 (https://github.com/Juuro/concerts)"
const MIN_INTERVAL_MS = 1100 // MusicBrainz: max 1 req/sec
const IMAGE_THUMBNAIL_WIDTH = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function searchMusicBrainzArtist(
  artistName: string
): Promise<{ mbid: string } | null> {
  const encoded = encodeURIComponent(artistName)
  const url = `https://musicbrainz.org/ws/2/artist/?query=artist:${encoded}&fmt=json&limit=5`

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`MusicBrainz search failed: ${response.status}`)
  }

  const data = await response.json()
  const artists = data.artists || []
  if (artists.length === 0) return null

  const exactMatch = artists.find(
    (a: { name: string }) => a.name.toLowerCase() === artistName.toLowerCase()
  )
  const bestMatch = exactMatch || artists[0]

  return { mbid: bestMatch.id }
}

async function lookupMusicBrainzArtist(mbid: string): Promise<string | null> {
  await sleep(MIN_INTERVAL_MS)

  const url = `https://musicbrainz.org/ws/2/artist/${mbid}?fmt=json&inc=url-rels`

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`MusicBrainz lookup failed: ${response.status}`)
  }

  const data = await response.json()
  const relations = data.relations || []

  const wikidataRelation = relations.find(
    (r: { type: string }) => r.type === "wikidata"
  )
  if (!wikidataRelation) return null

  const wikidataUrl = wikidataRelation.url.resource
  const entityId = wikidataUrl.split("/").pop()

  return entityId && entityId.startsWith("Q") ? entityId : null
}

async function getWikidataImageFilename(
  wikidataId: string
): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json`

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`Wikidata lookup failed: ${response.status}`)
  }

  const data = await response.json()
  const entity = data.entities?.[wikidataId]
  const p18Claims = entity?.claims?.P18

  if (!p18Claims || p18Claims.length === 0) return null

  const filename = p18Claims[0]?.mainsnak?.datavalue?.value
  return filename || null
}

async function getWikimediaCommonsUrl(
  filename: string
): Promise<string | null> {
  const encoded = encodeURIComponent(filename)
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encoded}&prop=imageinfo&iiprop=url&iiurlwidth=${IMAGE_THUMBNAIL_WIDTH}&format=json`

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`Wikimedia Commons lookup failed: ${response.status}`)
  }

  const data = await response.json()
  const pages = data.query?.pages
  if (!pages) return null

  const pageId = Object.keys(pages)[0]
  if (!pageId || pageId === "-1") return null

  const imageInfo = pages[pageId]?.imageinfo?.[0]
  return imageInfo?.thumburl || imageInfo?.url || null
}

async function getArtistImageUrl(
  artistName: string
): Promise<string | null> {
  const searchResult = await searchMusicBrainzArtist(artistName)
  if (!searchResult) return null

  const wikidataId = await lookupMusicBrainzArtist(searchResult.mbid)
  if (!wikidataId) return null

  const filename = await getWikidataImageFilename(wikidataId)
  if (!filename) return null

  return getWikimediaCommonsUrl(filename)
}

async function main() {
  const args = process.argv.slice(2)
  const overwrite = args.includes("--overwrite")
  const dryRun = args.includes("--dry-run")

  console.log("=== Backfill Band Images (MusicBrainz/Wikidata/Wikimedia) ===")
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)
  console.log(`Overwrite existing: ${overwrite}\n`)

  const whereClause = overwrite
    ? {}
    : {
        OR: [{ imageUrl: null }, { imageUrl: "" }],
      }

  const bands = await prisma.band.findMany({
    where: whereClause,
    select: { id: true, name: true, slug: true, imageUrl: true },
    orderBy: { name: "asc" },
  })

  console.log(`Found ${bands.length} bands to process\n`)

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i]
    try {
      // Rate limit between bands
      if (i > 0) await sleep(MIN_INTERVAL_MS)

      const imageUrl = await getArtistImageUrl(band.name)

      if (imageUrl) {
        if (!dryRun) {
          await prisma.band.update({
            where: { id: band.id },
            data: { imageUrl },
          })
        }
        updated++
        console.log(
          `[${i + 1}/${bands.length}] ${band.name}: ${imageUrl}`
        )
      } else {
        skipped++
        console.log(
          `[${i + 1}/${bands.length}] ${band.name}: no image found`
        )
      }
    } catch (error) {
      failed++
      console.error(
        `[${i + 1}/${bands.length}] ${band.name}: error -`,
        error
      )
      // Still respect rate limit on errors
      await sleep(MIN_INTERVAL_MS)
    }
  }

  console.log(`\n=== Backfill Complete ===`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (no image found): ${skipped}`)
  console.log(`Failed: ${failed}`)
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
