import { prisma } from "@/lib/prisma"

async function migrateVenueData() {
  console.log("Starting venue data migration...")

  const concerts = await prisma.concert.findMany()
  console.log(`Found ${concerts.length} concerts to migrate`)

  let migrated = 0
  let skipped = 0

  for (const concert of concerts) {
    // Skip if venue already exists
    if (concert.venue) {
      skipped++
      continue
    }

    // Simply rename club to venue (venue should only contain venue name, not city)
    const venue = concert.club || ""

    await prisma.concert.update({
      where: { id: concert.id },
      data: { venue }
    })

    migrated++

    if (migrated % 100 === 0) {
      console.log(`Progress: ${migrated}/${concerts.length} concerts migrated`)
    }
  }

  console.log("\nMigration complete!")
  console.log(`Migrated: ${migrated} concerts`)
  console.log(`Skipped: ${skipped} concerts (already had venue)`)
}

migrateVenueData()
  .catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
