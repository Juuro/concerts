import { NextRequest, NextResponse } from "next/server"
import { searchBandsWithSuggestions } from "@/lib/bandSearchMerge"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q") || ""
  const limit = parseInt(searchParams.get("limit") || "10", 10)

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  const results = await searchBandsWithSuggestions(query, Math.min(limit, 50))
  return NextResponse.json(results)
}
