import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getConcertById, updateConcert, deleteConcert, type UpdateConcertInput } from "@/lib/concerts";
import { getOrCreateFestival } from "@/lib/festivals";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const concert = await getConcertById(id);

  if (!concert) {
    return NextResponse.json({ error: "Concert not found" }, { status: 404 });
  }

  return NextResponse.json(concert);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();

    // Resolve festival: use provided ID, create from name, or clear
    let resolvedFestivalId: string | null | undefined = body.festivalId
    if (body.isFestival && body.festivalName && !body.festivalId) {
      const festival = await getOrCreateFestival(body.festivalName)
      resolvedFestivalId = festival.id
    } else if (body.isFestival === false) {
      resolvedFestivalId = null
    }

    const input: UpdateConcertInput = {
      date: body.date ? new Date(body.date) : undefined,
      latitude: body.latitude,
      longitude: body.longitude,
      venue: body.venue,
      isFestival: body.isFestival,
      festivalId: resolvedFestivalId,
      cost:
        body.cost !== undefined
          ? body.cost !== null && body.cost !== ""
            ? parseFloat(body.cost)
            : null
          : undefined,
      bandIds: body.bandIds,
    };

    const concert = await updateConcert(id, session.user.id, input);

    if (!concert) {
      return NextResponse.json({ error: "Concert not found or not authorized" }, { status: 404 });
    }

    // Revalidate statistics cache
    revalidateTag("concert-statistics");

    return NextResponse.json(concert);
  } catch (error) {
    console.error("Error updating concert:", error);
    return NextResponse.json({ error: "Failed to update concert" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await deleteConcert(id, session.user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Concert not found or not authorized" }, { status: 404 });
  }

  // Revalidate statistics cache
  revalidateTag("concert-statistics");

  return NextResponse.json({ success: true });
}
