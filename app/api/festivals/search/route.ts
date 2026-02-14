import { NextRequest, NextResponse } from "next/server";
import { searchFestivals } from "@/lib/festivals";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const festivals = await searchFestivals(query, Math.min(limit, 50));
  return NextResponse.json(festivals);
}
