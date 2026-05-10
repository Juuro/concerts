import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { sourceId, targetId } = body

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { error: "sourceId and targetId are required" },
        { status: 400 }
      )
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "Cannot merge a band with itself" },
        { status: 400 }
      )
    }

    // Fetch both bands
    const [sourceBand, targetBand] = await Promise.all([
      prisma.band.findUnique({
        where: { id: sourceId },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          websiteUrl: true,
          lastfmUrl: true,
          genres: true,
          bio: true,
          _count: { select: { concerts: true } },
        },
      }),
      prisma.band.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrl: true,
          websiteUrl: true,
          lastfmUrl: true,
          genres: true,
          bio: true,
          _count: { select: { concerts: true } },
        },
      }),
    ])

    if (!sourceBand) {
      return NextResponse.json(
        { error: "Source band not found" },
        { status: 404 }
      )
    }

    if (!targetBand) {
      return NextResponse.json(
        { error: "Target band not found" },
        { status: 404 }
      )
    }

    // Perform the merge in a transaction
    await prisma.$transaction(async (tx) => {
      // Get all concert relations from source band
      const sourceConcertBands = await tx.concertBand.findMany({
        where: { bandId: sourceId },
        select: { concertId: true, isHeadliner: true, sortOrder: true },
      })

      // Get existing concert relations for target band
      const targetConcertIds = await tx.concertBand.findMany({
        where: { bandId: targetId },
        select: { concertId: true },
      })
      const targetConcertIdSet = new Set(
        targetConcertIds.map((c) => c.concertId)
      )

      // Move non-duplicate concert relations to target
      for (const relation of sourceConcertBands) {
        if (!targetConcertIdSet.has(relation.concertId)) {
          await tx.concertBand.update({
            where: {
              concertId_bandId: {
                concertId: relation.concertId,
                bandId: sourceId,
              },
            },
            data: { bandId: targetId },
          })
        }
      }

      // Delete remaining source concert relations (duplicates)
      await tx.concertBand.deleteMany({
        where: { bandId: sourceId },
      })

      // Update UserConcert.supportingActIds: replace source band ID with target in any support act arrays
      const userConcertsWithSupportingActs = await tx.userConcert.findMany({
        where: { supportingActIds: { not: Prisma.DbNull } },
        select: { id: true, supportingActIds: true },
      })
      for (const uc of userConcertsWithSupportingActs) {
        const raw = uc.supportingActIds
        if (raw == null || !Array.isArray(raw)) continue
        const arr = raw as { bandId?: string; sortOrder?: number }[]
        const hasSource = arr.some((item) => item.bandId === sourceId)
        if (!hasSource) continue
        const updated = arr
          .map((item) => {
            if (item.bandId === sourceId) return { ...item, bandId: targetId }
            return item
          })
          .filter(
            (item, i, a) => a.findIndex((x) => x.bandId === item.bandId) === i
          ) // dedupe by bandId
        await tx.userConcert.update({
          where: { id: uc.id },
          data: { supportingActIds: updated },
        })
      }

      // Merge metadata: fill gaps in target with source data
      const updateData: Record<string, unknown> = {}

      if (!targetBand.imageUrl && sourceBand.imageUrl) {
        updateData.imageUrl = sourceBand.imageUrl
      }
      if (!targetBand.websiteUrl && sourceBand.websiteUrl) {
        updateData.websiteUrl = sourceBand.websiteUrl
      }
      if (!targetBand.lastfmUrl && sourceBand.lastfmUrl) {
        updateData.lastfmUrl = sourceBand.lastfmUrl
      }
      if (targetBand.genres.length === 0 && sourceBand.genres.length > 0) {
        updateData.genres = sourceBand.genres
      }
      if (!targetBand.bio && sourceBand.bio) {
        updateData.bio = sourceBand.bio
      }

      if (Object.keys(updateData).length > 0) {
        await tx.band.update({
          where: { id: targetId },
          data: updateData,
        })
      }

      // Delete the source band
      await tx.band.delete({
        where: { id: sourceId },
      })

      // Log the admin activity
      await tx.adminActivity.create({
        data: {
          userId: session.user.id,
          action: "band_merge",
          targetType: "band",
          targetId: targetId,
          details: {
            sourceBand: {
              id: sourceBand.id,
              name: sourceBand.name,
              concertCount: sourceBand._count.concerts,
            },
            targetBand: {
              id: targetBand.id,
              name: targetBand.name,
              concertCount: targetBand._count.concerts,
            },
            movedConcerts:
              sourceConcertBands.length -
              sourceConcertBands.filter((c) =>
                targetConcertIdSet.has(c.concertId)
              ).length,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      merged: {
        source: { id: sourceBand.id, name: sourceBand.name },
        target: { id: targetBand.id, name: targetBand.name },
      },
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error merging bands:", error)
    return NextResponse.json(
      { error: "Failed to merge bands" },
      { status: 500 }
    )
  }
}
