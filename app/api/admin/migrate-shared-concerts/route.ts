import { NextRequest, NextResponse } from "next/server";
import { auth, getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Migration endpoint: Convert per-user concerts to shared concert model
 *
 * This runs the migration within the deployed app where Prisma Accelerate works.
 *
 * POST /api/admin/migrate-shared-concerts
 *
 * Only accessible by admin users.
 */

export async function POST(request: NextRequest) {
  const session = await getSession(await headers());

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const results: string[] = [];

  try {
    // Step 1: Create UserConcert records
    results.push("Step 1: Creating UserConcert records...");

    const existingLinks = await prisma.userConcert.findMany({
      select: { concertId: true },
    });
    const linkedConcertIds = new Set(existingLinks.map((l) => l.concertId));

    const allConcerts = await prisma.concert.findMany({
      select: { id: true, userId: true, cost: true },
    });

    const concertsToMigrate = allConcerts.filter(
      (c) => c.userId && !linkedConcertIds.has(c.id)
    );

    results.push(`Found ${concertsToMigrate.length} concerts to migrate`);

    if (concertsToMigrate.length > 0) {
      await prisma.userConcert.createMany({
        data: concertsToMigrate.map((c) => ({
          userId: c.userId!,
          concertId: c.id,
          cost: c.cost,
        })),
        skipDuplicates: true,
      });
      results.push(`Created ${concertsToMigrate.length} UserConcert records`);
    }

    // Step 2: Set createdById on concerts
    results.push("Step 2: Setting createdById on concerts...");

    const concertsNeedingCreatedBy = await prisma.concert.findMany({
      where: {
        createdById: null,
        userId: { not: null },
      },
      select: { id: true, userId: true },
    });

    results.push(`Found ${concertsNeedingCreatedBy.length} concerts needing createdById`);

    for (const concert of concertsNeedingCreatedBy) {
      await prisma.concert.update({
        where: { id: concert.id },
        data: { createdById: concert.userId },
      });
    }

    results.push(`Updated ${concertsNeedingCreatedBy.length} concerts with createdById`);

    // Step 3: Get statistics
    const concertCount = await prisma.concert.count();
    const userConcertCount = await prisma.userConcert.count();
    const uniqueAttendees = await prisma.userConcert.groupBy({
      by: ["userId"],
      _count: true,
    });

    results.push("=== Migration Statistics ===");
    results.push(`Total concerts: ${concertCount}`);
    results.push(`Total attendances (UserConcert): ${userConcertCount}`);
    results.push(`Unique users with concerts: ${uniqueAttendees.length}`);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return NextResponse.json({
      success: false,
      results,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
