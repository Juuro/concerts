/**
 * Migration script: Convert per-user concerts to shared concert model
 *
 * This script:
 * 1. Creates UserConcert records from existing Concert data (userId, cost)
 * 2. Sets createdById on concerts to preserve audit trail
 * 3. Finds and merges duplicate concerts (same date + location + overlapping bands)
 *
 * Run AFTER the Prisma migration creates the UserConcert table.
 *
 * Usage (requires DIRECT postgres URL, not Prisma Accelerate):
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-to-shared-concerts.ts
 *
 * For Vercel Postgres, use POSTGRES_URL_NON_POOLING from your dashboard.
 */

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  console.error("Error: DATABASE_URL environment variable not set");
  console.error('Usage: DATABASE_URL="postgres://..." npx tsx scripts/migrate-to-shared-concerts.ts');
  process.exit(1);
}

if (connectionString.startsWith("prisma://")) {
  console.error("Error: Prisma Accelerate URLs (prisma://...) are not supported.");
  console.error("Please use a direct PostgreSQL connection string (postgres://...)");
  console.error("\nFor Vercel Postgres, use POSTGRES_URL_NON_POOLING from your dashboard.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ConcertWithBands {
  id: string;
  userId: string;
  date: Date;
  latitude: number;
  longitude: number;
  venue: string | null;
  normalizedCity: string | null;
  cost: Prisma.Decimal | null;
  bands: { bandId: string }[];
}

// Coordinate tolerance (~100m)
const COORD_TOLERANCE = 0.001;

async function migrateUserConcerts() {
  console.log("Step 1: Creating UserConcert records from existing Concert data...\n");

  // Get IDs of concerts that already have UserConcert records
  const existingLinks = await prisma.userConcert.findMany({
    select: { concertId: true },
  });
  const linkedConcertIds = new Set(existingLinks.map((l) => l.concertId));

  // Get all concerts with their current userId and cost
  const allConcerts = await prisma.concert.findMany({
    select: {
      id: true,
      userId: true,
      cost: true,
    },
  });

  // Filter to concerts without UserConcert records and with userId
  const concerts = allConcerts.filter(
    (c) => c.userId && !linkedConcertIds.has(c.id)
  );

  console.log(`Found ${concerts.length} concerts to migrate`);

  if (concerts.length === 0) {
    console.log("No concerts to migrate (UserConcert records may already exist)");
    return;
  }

  // Create UserConcert records in batches
  const batchSize = 100;
  for (let i = 0; i < concerts.length; i += batchSize) {
    const batch = concerts.slice(i, i + batchSize);
    await prisma.userConcert.createMany({
      data: batch.map((c) => ({
        userId: c.userId!,
        concertId: c.id,
        cost: c.cost,
      })),
      skipDuplicates: true,
    });
    console.log(`Migrated ${Math.min(i + batchSize, concerts.length)}/${concerts.length}`);
  }

  console.log("UserConcert migration complete!\n");
}

async function setCreatedByIds() {
  console.log("Step 2: Setting createdById on concerts...\n");

  // Get concerts that need createdById set
  const concertsToUpdate = await prisma.concert.findMany({
    where: {
      createdById: null,
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  console.log(`Found ${concertsToUpdate.length} concerts needing createdById`);

  // Update in batches
  const batchSize = 100;
  let updated = 0;
  for (let i = 0; i < concertsToUpdate.length; i += batchSize) {
    const batch = concertsToUpdate.slice(i, i + batchSize);
    await Promise.all(
      batch.map((c) =>
        prisma.concert.update({
          where: { id: c.id },
          data: { createdById: c.userId },
        })
      )
    );
    updated += batch.length;
    console.log(`Updated ${updated}/${concertsToUpdate.length}`);
  }

  console.log(`Updated ${updated} concerts with createdById\n`);
}

async function findDuplicateGroups(): Promise<ConcertWithBands[][]> {
  console.log("Step 3: Finding duplicate concerts...\n");

  // Get all concerts with bands for duplicate detection
  const concerts = await prisma.concert.findMany({
    select: {
      id: true,
      userId: true,
      date: true,
      latitude: true,
      longitude: true,
      venue: true,
      normalizedCity: true,
      cost: true,
      bands: { select: { bandId: true } },
    },
    orderBy: { date: "asc" },
  }) as unknown as ConcertWithBands[];

  console.log(`Analyzing ${concerts.length} concerts for duplicates...`);

  // Group concerts by date (same day)
  const byDate = new Map<string, ConcertWithBands[]>();
  for (const concert of concerts) {
    const dateKey = concert.date.toISOString().split("T")[0];
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push(concert);
  }

  const duplicateGroups: ConcertWithBands[][] = [];

  // Within each date, find concerts at same location with overlapping bands
  for (const [_dateKey, dateConcerts] of byDate) {
    if (dateConcerts.length < 2) continue;

    const processed = new Set<string>();

    for (const concert of dateConcerts) {
      if (processed.has(concert.id)) continue;

      const group: ConcertWithBands[] = [concert];
      processed.add(concert.id);

      const concertBandIds = new Set(concert.bands.map((b) => b.bandId));

      for (const other of dateConcerts) {
        if (processed.has(other.id)) continue;

        // Check coordinate proximity
        const latDiff = Math.abs(concert.latitude - other.latitude);
        const lonDiff = Math.abs(concert.longitude - other.longitude);

        if (latDiff <= COORD_TOLERANCE && lonDiff <= COORD_TOLERANCE) {
          // Check band overlap
          const hasOverlap = other.bands.some((b) => concertBandIds.has(b.bandId));

          if (hasOverlap) {
            group.push(other);
            processed.add(other.id);
          }
        }
      }

      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }
  }

  console.log(`Found ${duplicateGroups.length} groups of duplicate concerts\n`);
  return duplicateGroups;
}

async function mergeDuplicates(groups: ConcertWithBands[][]) {
  if (groups.length === 0) {
    console.log("No duplicates to merge\n");
    return;
  }

  console.log("Step 4: Merging duplicate concerts...\n");

  for (const group of groups) {
    // Use the oldest concert as canonical (first created)
    const [canonical, ...duplicates] = group;

    console.log(
      `Merging ${duplicates.length} duplicate(s) into concert ${canonical.id} ` +
        `(${canonical.date.toISOString().split("T")[0]} at ${canonical.venue || "unknown venue"})`
    );

    // Collect all unique band IDs from the group
    const allBandIds = new Set<string>();
    for (const concert of group) {
      for (const band of concert.bands) {
        allBandIds.add(band.bandId);
      }
    }

    // Move UserConcert records to canonical concert
    for (const dupe of duplicates) {
      await prisma.userConcert.updateMany({
        where: { concertId: dupe.id },
        data: { concertId: canonical.id },
      });
    }

    // Merge band lists - add any missing bands to canonical
    const canonicalBandIds = new Set(canonical.bands.map((b) => b.bandId));
    const missingBandIds = [...allBandIds].filter((id) => !canonicalBandIds.has(id));

    if (missingBandIds.length > 0) {
      await prisma.concertBand.createMany({
        data: missingBandIds.map((bandId) => ({
          concertId: canonical.id,
          bandId,
          isHeadliner: false,
          sortOrder: 99, // Add at end
        })),
        skipDuplicates: true,
      });
    }

    // Delete duplicate concerts (ConcertBand will cascade delete)
    await prisma.concert.deleteMany({
      where: { id: { in: duplicates.map((d) => d.id) } },
    });
  }

  console.log(`Merged ${groups.length} duplicate groups\n`);
}

async function printStats() {
  const concertCount = await prisma.concert.count();
  const userConcertCount = await prisma.userConcert.count();
  const uniqueAttendees = await prisma.userConcert.groupBy({
    by: ["userId"],
    _count: true,
  });

  console.log("=== Migration Statistics ===");
  console.log(`Total concerts: ${concertCount}`);
  console.log(`Total attendances (UserConcert): ${userConcertCount}`);
  console.log(`Unique users with concerts: ${uniqueAttendees.length}`);
  console.log("============================\n");
}

async function main() {
  console.log("===========================================");
  console.log("Shared Concert Model Migration");
  console.log("===========================================\n");

  try {
    await migrateUserConcerts();
    await setCreatedByIds();

    const duplicateGroups = await findDuplicateGroups();
    await mergeDuplicates(duplicateGroups);

    await printStats();

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
