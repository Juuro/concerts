import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createBand, updateBandLastfm, type CreateBandInput } from "@/lib/bands";
import { getArtistInfo } from "@/utils/lastfm";

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
      websiteUrl: body.websiteUrl,
      lastfmUrl: body.lastfmUrl,
      genres: body.genres,
      bio: body.bio,
    };

    const band = await createBand(input);

    // Fire-and-forget Last.fm enrichment
    getArtistInfo(band.name)
      .then(async (lastfmData) => {
        if (!lastfmData) return;
        await updateBandLastfm(band.id, {
          lastfmUrl: lastfmData.url || undefined,
          genres: lastfmData.genres || [],
          bio: lastfmData.bio || undefined,
          imageUrl:
            lastfmData.images.extralarge ||
            lastfmData.images.large ||
            lastfmData.images.medium ||
            undefined,
        });
      })
      .catch((err) => {
        console.error(`Background enrichment failed for ${band.name}:`, err);
      });

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
