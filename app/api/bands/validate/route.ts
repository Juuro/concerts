import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { searchMusicBrainzArtist } from "@/utils/musicbrainz"
import { getArtistInfo } from "@/utils/lastfm"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const name = request.nextUrl.searchParams.get("name")

  if (!name || name.trim().length < 2) {
    return NextResponse.json(
      { error: "Name parameter is required (min 2 characters)" },
      { status: 400 }
    )
  }

  const trimmedName = name.trim()

  try {
    // Primary: MusicBrainz artist search
    const mbResult = await searchMusicBrainzArtist(trimmedName)

    if (mbResult) {
      const isExactMatch =
        mbResult.name.toLowerCase() === trimmedName.toLowerCase()
      return NextResponse.json({
        found: true,
        name: mbResult.name,
        correctedName: isExactMatch ? undefined : mbResult.name,
        source: "musicbrainz",
      })
    }

    // Fallback: Last.fm with autocorrect
    const lastfmResult = await getArtistInfo(trimmedName)

    if (lastfmResult) {
      const isExactMatch =
        lastfmResult.name.toLowerCase() === trimmedName.toLowerCase()
      return NextResponse.json({
        found: true,
        name: lastfmResult.name,
        correctedName: isExactMatch ? undefined : lastfmResult.name,
        source: "lastfm",
      })
    }

    // Not found in either source
    return NextResponse.json({ found: false })
  } catch (error) {
    console.error("Error validating band name:", error)
    // On validation error, don't block the user -- return as not found
    return NextResponse.json({ found: false })
  }
}
