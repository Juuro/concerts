import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { searchMusicBrainzEvent } from "@/utils/musicbrainz"

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
    const mbResult = await searchMusicBrainzEvent(trimmedName)

    if (mbResult) {
      const isExactMatch =
        mbResult.name.toLowerCase() === trimmedName.toLowerCase()
      return NextResponse.json({
        found: true,
        name: mbResult.name,
        correctedName: isExactMatch ? undefined : mbResult.name,
      })
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error("Error validating festival name:", error)
    return NextResponse.json({ found: false })
  }
}
