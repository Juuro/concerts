import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getArtistInfo } from "@/utils/lastfm"
import { getArtistImageUrl } from "@/utils/musicbrainz"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { slug } = await params

  try {
    // Find the band
    const band = await prisma.band.findUnique({
      where: { slug },
    })

    if (!band) {
      return NextResponse.json({ error: "Band not found" }, { status: 404 })
    }

    // Fetch Last.fm data and MusicBrainz image in parallel
    const [lastfmData, musicbrainzImageUrl] = await Promise.all([
      getArtistInfo(band.name),
      getArtistImageUrl(band.name),
    ])

    if (!lastfmData && !musicbrainzImageUrl) {
      return NextResponse.json(
        { message: "No enrichment data available" },
        { status: 200 }
      )
    }

    // Update band — MusicBrainz CC-licensed image takes priority
    const updatedBand = await prisma.band.update({
      where: { id: band.id },
      data: {
        lastfmUrl: lastfmData?.url || undefined,
        genres: lastfmData?.genres || [],
        bio: lastfmData?.bio || undefined,
        imageUrl:
          musicbrainzImageUrl ||
          lastfmData?.images.extralarge ||
          lastfmData?.images.large ||
          lastfmData?.images.medium ||
          band.imageUrl ||
          undefined,
      },
    })

    return NextResponse.json({
      id: updatedBand.id,
      name: updatedBand.name,
      slug: updatedBand.slug,
      url: `/band/${updatedBand.slug}/`,
      imageUrl: updatedBand.imageUrl,
      lastfm: {
        url: updatedBand.lastfmUrl,
        genres: updatedBand.genres,
        bio: updatedBand.bio,
      },
    })
  } catch (error) {
    console.error("Error enriching band:", error)
    return NextResponse.json(
      { error: "Failed to enrich band data" },
      { status: 500 }
    )
  }
}
