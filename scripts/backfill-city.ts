/**
 * Backfill script to populate normalizedCity for existing concerts
 *
 * Run with: npx tsx -r tsconfig-paths/register scripts/backfill-city.ts
 *
 * This script:
 * 1. Finds all concerts where normalizedCity is null
 * 2. Reverse geocodes each concert's lat/lon via Photon API
 * 3. Updates the concert's normalizedCity field
 * 4. Respects rate limiting (700ms between API calls)
 */

import "dotenv/config"
import { prisma } from "../src/lib/prisma"

async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`
  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const json = await res.json()
  const props = json?.features?.[0]?.properties
  const city =
    props?.city ||
    props?.locality ||
    props?.name ||
    props?.county ||
    props?.state ||
    ""
  return city
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log("=== Backfill normalizedCity ===\n")

  const concerts = await prisma.concert.findMany({
    where: { normalizedCity: null },
    select: { id: true, latitude: true, longitude: true },
  })

  console.log(`Found ${concerts.length} concerts with missing normalizedCity\n`)

  let updated = 0
  let failed = 0

  for (const concert of concerts) {
    try {
      const city = await reverseGeocode(concert.latitude, concert.longitude)

      if (city) {
        await prisma.concert.update({
          where: { id: concert.id },
          data: { normalizedCity: city },
        })
        updated++
        console.log(
          `[${updated + failed}/${concerts.length}] ${concert.id}: "${city}"`
        )
      } else {
        failed++
        console.warn(
          `[${updated + failed}/${concerts.length}] ${concert.id}: no city found for (${concert.latitude}, ${concert.longitude})`
        )
      }

      // Rate limit: 700ms between API calls
      await sleep(700)
    } catch (error) {
      failed++
      console.error(
        `[${updated + failed}/${concerts.length}] ${concert.id}: error -`,
        error
      )
      // Still respect rate limit on errors
      await sleep(700)
    }
  }

  console.log(`\n=== Backfill Complete ===`)
  console.log(`Updated: ${updated}`)
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
