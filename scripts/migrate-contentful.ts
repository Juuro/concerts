/**
 * Migration script to transfer data from Contentful to PostgreSQL
 *
 * Run with: npx tsx scripts/migrate-contentful.ts
 *
 * This script:
 * 1. Creates or finds a user account for the migration
 * 2. Fetches all bands from Contentful and inserts into Band table
 * 3. Fetches all festivals from Contentful and inserts into Festival table
 * 4. Fetches all concerts from Contentful and inserts into Concert table
 */

import "dotenv/config"
import { prisma } from "../src/lib/prisma"
import { createClient } from "contentful"

// Initialize Contentful client
const contentfulClient = createClient({
  space: process.env.CONTENTFUL_SPACE_ID!,
  accessToken: process.env.CONTENTFUL_DELIVERY_TOKEN!,
})

// Migration user email - update this to your email
const MIGRATION_USER_EMAIL =
  process.env.MIGRATION_USER_EMAIL || "admin@example.com"

interface ContentfulBandFields {
  name: string
  slug: string
  image?: {
    fields?: {
      file?: {
        url: string
      }
    }
  }
}

interface ContentfulFestivalFields {
  name: string
  url?: string
}

interface ContentfulConcertFields {
  date: string
  city: {
    lat: number
    lon: number
  }
  club?: string
  bands?: Array<{
    sys: { id: string }
    fields: ContentfulBandFields
  }>
  isFestival?: boolean
  festival?: {
    sys: { id: string }
    fields: ContentfulFestivalFields
  }
}

async function getOrCreateMigrationUser(): Promise<string> {
  console.log(`Looking for user with email: ${MIGRATION_USER_EMAIL}`)

  let user = await prisma.user.findUnique({
    where: { email: MIGRATION_USER_EMAIL },
  })

  if (!user) {
    console.log("Creating migration user...")
    user = await prisma.user.create({
      data: {
        email: MIGRATION_USER_EMAIL,
        name: "Admin",
        emailVerified: true,
      },
    })
    console.log(`Created user with ID: ${user.id}`)
  } else {
    console.log(`Found existing user with ID: ${user.id}`)
  }

  return user.id
}

async function migrateBands(): Promise<Map<string, string>> {
  console.log("\n--- Migrating Bands ---")

  const contentfulIdToDbId = new Map<string, string>()

  const entries = await contentfulClient.getEntries({
    content_type: "band",
    limit: 1000,
  })

  console.log(`Found ${entries.items.length} bands in Contentful`)

  for (const entry of entries.items) {
    const fields = entry.fields as unknown as ContentfulBandFields

    if (!fields.name || !fields.slug || fields.slug === "data-schema") {
      continue
    }

    try {
      // Check if band already exists
      let band = await prisma.band.findUnique({
        where: { slug: fields.slug },
      })

      if (!band) {
        // Get image URL if available
        let imageUrl: string | undefined
        if (fields.image?.fields?.file?.url) {
          imageUrl = `https:${fields.image.fields.file.url}`
        }

        band = await prisma.band.create({
          data: {
            name: fields.name,
            slug: fields.slug,
            imageUrl,
          },
        })
        console.log(`Created band: ${fields.name}`)
      } else {
        console.log(`Band already exists: ${fields.name}`)
      }

      contentfulIdToDbId.set(entry.sys.id, band.id)
    } catch (error) {
      console.error(`Error migrating band ${fields.name}:`, error)
    }
  }

  console.log(`Migrated ${contentfulIdToDbId.size} bands`)
  return contentfulIdToDbId
}

async function migrateFestivals(): Promise<Map<string, string>> {
  console.log("\n--- Migrating Festivals ---")

  const contentfulIdToDbId = new Map<string, string>()

  const entries = await contentfulClient.getEntries({
    content_type: "festival",
    limit: 1000,
  })

  console.log(`Found ${entries.items.length} festivals in Contentful`)

  for (const entry of entries.items) {
    const fields = entry.fields as unknown as ContentfulFestivalFields

    if (!fields.name) {
      continue
    }

    const slug = fields.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")

    try {
      // Check if festival already exists
      let festival = await prisma.festival.findUnique({
        where: { slug },
      })

      if (!festival) {
        festival = await prisma.festival.create({
          data: {
            name: fields.name,
            slug,
            url: fields.url,
          },
        })
        console.log(`Created festival: ${fields.name}`)
      } else {
        console.log(`Festival already exists: ${fields.name}`)
      }

      contentfulIdToDbId.set(entry.sys.id, festival.id)
    } catch (error) {
      console.error(`Error migrating festival ${fields.name}:`, error)
    }
  }

  console.log(`Migrated ${contentfulIdToDbId.size} festivals`)
  return contentfulIdToDbId
}

async function migrateConcerts(
  userId: string,
  bandIdMap: Map<string, string>,
  festivalIdMap: Map<string, string>
): Promise<void> {
  console.log("\n--- Migrating Concerts ---")

  const entries = await contentfulClient.getEntries({
    content_type: "concert",
    limit: 1000,
    order: ["-fields.date"],
  })

  console.log(`Found ${entries.items.length} concerts in Contentful`)

  let migratedCount = 0
  let skippedCount = 0

  for (const entry of entries.items) {
    const fields = entry.fields as unknown as ContentfulConcertFields

    if (!fields.date || !fields.city) {
      console.log(`Skipping concert without date/city: ${entry.sys.id}`)
      skippedCount++
      continue
    }

    try {
      // Check if concert already exists (by date and coordinates)
      const existingConcert = await prisma.concert.findFirst({
        where: {
          userId,
          date: new Date(fields.date),
          latitude: fields.city.lat,
          longitude: fields.city.lon,
        },
      })

      if (existingConcert) {
        console.log(`Concert already exists for ${fields.date}`)
        skippedCount++
        continue
      }

      // Map festival ID
      let festivalId: string | undefined
      if (fields.festival?.sys?.id) {
        festivalId = festivalIdMap.get(fields.festival.sys.id)
      }

      // Create the concert
      const concert = await prisma.concert.create({
        data: {
          userId,
          date: new Date(fields.date),
          latitude: fields.city.lat,
          longitude: fields.city.lon,
          club: fields.club,
          isFestival: fields.isFestival || false,
          festivalId,
        },
      })

      // Add bands to concert
      if (fields.bands && fields.bands.length > 0) {
        for (let i = 0; i < fields.bands.length; i++) {
          const bandEntry = fields.bands[i]
          const bandId = bandIdMap.get(bandEntry.sys.id)

          if (bandId) {
            await prisma.concertBand.create({
              data: {
                concertId: concert.id,
                bandId,
                isHeadliner: i === 0, // First band is headliner
                sortOrder: i,
              },
            })
          } else {
            console.warn(`Band not found for ID: ${bandEntry.sys.id}`)
          }
        }
      }

      migratedCount++
      console.log(
        `Migrated concert: ${fields.date} (${fields.bands?.length || 0} bands)`
      )
    } catch (error) {
      console.error(`Error migrating concert ${fields.date}:`, error)
    }
  }

  console.log(`\nMigrated ${migratedCount} concerts, skipped ${skippedCount}`)
}

async function main() {
  console.log("=== Contentful to PostgreSQL Migration ===\n")

  // Verify environment variables
  if (
    !process.env.CONTENTFUL_SPACE_ID ||
    !process.env.CONTENTFUL_DELIVERY_TOKEN
  ) {
    console.error(
      "Error: CONTENTFUL_SPACE_ID and CONTENTFUL_DELIVERY_TOKEN must be set"
    )
    process.exit(1)
  }

  try {
    // Get or create the migration user
    const userId = await getOrCreateMigrationUser()

    // Migrate bands first (needed for concert references)
    const bandIdMap = await migrateBands()

    // Migrate festivals (needed for concert references)
    const festivalIdMap = await migrateFestivals()

    // Migrate concerts
    await migrateConcerts(userId, bandIdMap, festivalIdMap)

    console.log("\n=== Migration Complete ===")
  } catch (error) {
    console.error("Migration failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
