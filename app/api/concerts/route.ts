import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserConcerts, createConcert, getConcertsPaginated, type CreateConcertInput } from "@/lib/concerts";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const direction = (searchParams.get("direction") || "forward") as "forward" | "backward";
  const userOnly = searchParams.get("userOnly") === "true";

  // If userOnly, require auth and return user's concerts
  if (userOnly) {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const concerts = await getUserConcerts(session.user.id);
    return NextResponse.json(concerts);
  }

  // Public paginated endpoint
  const result = await getConcertsPaginated(cursor, limit, direction);
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const input: CreateConcertInput = {
      userId: session.user.id,
      date: new Date(body.date),
      latitude: body.latitude,
      longitude: body.longitude,
      city: body.city,
      club: body.club,
      isFestival: body.isFestival || false,
      festivalId: body.festivalId,
      bandIds: body.bandIds || [],
    };

    const concert = await createConcert(input);
    
    // Revalidate statistics cache
    revalidateTag("concert-statistics");
    
    return NextResponse.json(concert, { status: 201 });
  } catch (error) {
    console.error("Error creating concert:", error);
    return NextResponse.json({ error: "Failed to create concert" }, { status: 500 });
  }
}
