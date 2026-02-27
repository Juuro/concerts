import { NextRequest, NextResponse } from "next/server"
import { auth, getSession } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

interface DuplicatePair {
  band1: {
    id: string
    name: string
    slug: string
    imageUrl: string | null
    concertCount: number
    genres: string[]
  }
  band2: {
    id: string
    name: string
    slug: string
    imageUrl: string | null
    concertCount: number
    genres: string[]
  }
  similarity: number
}

function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/,\s*the$/i, "")
    .replace(/[^a-z0-9]/g, "")
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

function calculateSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeForComparison(name1)
  const normalized2 = normalizeForComparison(name2)

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0
  }

  const maxLength = Math.max(normalized1.length, normalized2.length)
  if (maxLength === 0) return 0

  const distance = levenshteinDistance(normalized1, normalized2)
  return 1 - distance / maxLength
}

export async function GET(request: NextRequest) {
  const session = await getSession(await headers())

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50)
  const threshold = parseFloat(searchParams.get("threshold") || "0.75")

  try {
    // Get all bands with their concert counts
    const bands = await prisma.band.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        genres: true,
        _count: { select: { concerts: true } },
      },
      orderBy: { name: "asc" },
    })

    // Find potential duplicates
    const duplicates: DuplicatePair[] = []
    const processedPairs = new Set<string>()

    for (let i = 0; i < bands.length && duplicates.length < limit; i++) {
      for (let j = i + 1; j < bands.length && duplicates.length < limit; j++) {
        const pairKey = [bands[i].id, bands[j].id].sort().join("-")
        if (processedPairs.has(pairKey)) continue

        const similarity = calculateSimilarity(bands[i].name, bands[j].name)

        if (similarity >= threshold) {
          processedPairs.add(pairKey)
          duplicates.push({
            band1: {
              id: bands[i].id,
              name: bands[i].name,
              slug: bands[i].slug,
              imageUrl: bands[i].imageUrl,
              concertCount: bands[i]._count.concerts,
              genres: bands[i].genres,
            },
            band2: {
              id: bands[j].id,
              name: bands[j].name,
              slug: bands[j].slug,
              imageUrl: bands[j].imageUrl,
              concertCount: bands[j]._count.concerts,
              genres: bands[j].genres,
            },
            similarity: Math.round(similarity * 100) / 100,
          })
        }
      }
    }

    // Sort by similarity descending
    duplicates.sort((a, b) => b.similarity - a.similarity)

    return NextResponse.json({
      duplicates,
      total: duplicates.length,
    })
  } catch (error) {
    console.error("Error finding duplicate bands:", error)
    return NextResponse.json(
      { error: "Failed to find duplicates" },
      { status: 500 }
    )
  }
}
