import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createBand, type CreateBandInput } from "@/lib/bands";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "Band name is required" }, { status: 400 });
    }

    // Generate slug from name if not provided
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const input: CreateBandInput = {
      name: body.name,
      slug,
      imageUrl: body.imageUrl,
      lastfmUrl: body.lastfmUrl,
      genres: body.genres,
      bio: body.bio,
    };

    const band = await createBand(input);
    return NextResponse.json(band, { status: 201 });
  } catch (error: any) {
    console.error("Error creating band:", error);

    // Handle unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A band with this name/slug already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create band" }, { status: 500 });
  }
}
