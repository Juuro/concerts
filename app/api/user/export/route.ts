import * as Sentry from "@sentry/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { parseSupportingActIds } from "@/lib/concerts/transform"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") ?? "json"

  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Use json or csv." },
      { status: 400 }
    )
  }

  try {
    const userId = session.user.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        isPublic: true,
        currency: true,
        hideLocationPublic: true,
        hideCostPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const userConcerts = await prisma.userConcert.findMany({
      where: { userId },
      include: {
        concert: {
          include: {
            bands: {
              include: { band: true },
              orderBy: { sortOrder: "asc" },
            },
            festival: { select: { name: true, slug: true, url: true } },
          },
        },
      },
      orderBy: { concert: { date: "desc" } },
    })

    // Resolve all unique supporting-act band IDs in a single batch query.
    const allSupportingActIds = new Set<string>()
    for (const uc of userConcerts) {
      const acts = parseSupportingActIds(uc.supportingActIds)
      if (acts) {
        for (const act of acts) allSupportingActIds.add(act.bandId)
      }
    }
    const supportingBands =
      allSupportingActIds.size > 0
        ? await prisma.band.findMany({
            where: { id: { in: Array.from(allSupportingActIds) } },
            select: { id: true, name: true, slug: true },
          })
        : []
    const bandsById = new Map(supportingBands.map((b) => [b.id, b]))

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      concerts: userConcerts.map((uc) => {
        const supportingActs = (
          parseSupportingActIds(uc.supportingActIds) ?? []
        ).map((act) => {
          const b = bandsById.get(act.bandId)
          return {
            bandId: act.bandId,
            name: b?.name ?? null,
            slug: b?.slug ?? null,
            sortOrder: act.sortOrder,
          }
        })

        return {
          id: uc.concert.id,
          date: uc.concert.date.toISOString(),
          venue: uc.concert.venue,
          city: uc.concert.normalizedCity,
          latitude: uc.concert.latitude,
          longitude: uc.concert.longitude,
          isFestival: uc.concert.isFestival,
          festival: uc.concert.festival
            ? {
                name: uc.concert.festival.name,
                slug: uc.concert.festival.slug,
                url: uc.concert.festival.url,
              }
            : null,
          headliners: uc.concert.bands
            .filter((cb) => cb.isHeadliner)
            .map((cb) => ({
              name: cb.band.name,
              slug: cb.band.slug,
            })),
          supportingActs,
          cost: uc.cost ? uc.cost.toString() : null,
          notes: uc.notes,
        }
      }),
    }

    if (format === "csv") {
      const rows: string[][] = [
        [
          "Date",
          "Venue",
          "City",
          "Latitude",
          "Longitude",
          "Is Festival",
          "Festival Name",
          "Headliners",
          "Supporting Acts",
          "Cost",
          "Currency",
          "Notes",
        ],
      ]

      for (const concert of exportData.concerts) {
        const headlinerNames = concert.headliners.map((b) => b.name).join("; ")
        const supportingNames = concert.supportingActs
          .map((b) => b.name ?? b.bandId)
          .join("; ")

        rows.push([
          concert.date.split("T")[0],
          concert.venue ?? "",
          concert.city ?? "",
          concert.latitude.toString(),
          concert.longitude.toString(),
          concert.isFestival ? "Yes" : "No",
          concert.festival?.name ?? "",
          headlinerNames,
          supportingNames,
          concert.cost ?? "",
          user?.currency ?? "EUR",
          concert.notes ?? "",
        ])
      }

      const csv = rows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
        .join("\n")

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="concerts-export-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      })
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="concerts-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    })
  } catch (error) {
    Sentry.captureException(error)
    console.error("Error exporting user data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}

