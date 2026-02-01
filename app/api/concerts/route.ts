import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserConcerts, createConcert, type CreateConcertInput } from "@/lib/concerts";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const concerts = await getUserConcerts(session.user.id);
  return NextResponse.json(concerts);
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
    return NextResponse.json(concert, { status: 201 });
  } catch (error) {
    console.error("Error creating concert:", error);
    return NextResponse.json({ error: "Failed to create concert" }, { status: 500 });
  }
}
