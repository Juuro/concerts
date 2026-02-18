import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { getArtistInfo } from "@/utils/lastfm"
import { getArtistImageUrl, getArtistWebsiteUrl } from "@/utils/musicbrainz"
import { validateWebsiteUrl } from "@/utils/validation"

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

    // Fetch Last.fm data, MusicBrainz image, and website URL in parallel
    const [lastfmData, musicbrainzImageUrl, musicbrainzWebsiteUrl] =
      await Promise.all([
        getArtistInfo(band.name),
        getArtistImageUrl(band.name),
        getArtistWebsiteUrl(band.name),
      ])

    if (!lastfmData && !musicbrainzImageUrl && !musicbrainzWebsiteUrl) {
      await prisma.band.update({
        where: { id: band.id },
        data: { imageEnrichedAt: new Date() },
      })
      return NextResponse.json(
        { message: "No enrichment data available" },
        { status: 200 }
      )
    }

    // Determine website URL: preserve existing (admin-set), else use MusicBrainz
    const websiteUrl =
      band.websiteUrl ||
      (musicbrainzWebsiteUrl
        ? validateWebsiteUrl(musicbrainzWebsiteUrl)
        : undefined)

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
        websiteUrl,
        imageEnrichedAt: new Date(),
      },
    })

    return NextResponse.json({
      id: updatedBand.id,
      name: updatedBand.name,
      slug: updatedBand.slug,
      url: `/band/${updatedBand.slug}/`,
      imageUrl: updatedBand.imageUrl,
      websiteUrl: updatedBand.websiteUrl,
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
