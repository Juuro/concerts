import { prisma } from "./prisma";
import type { Band as PrismaBand } from "@/generated/prisma/client";
import { getConcertsByBand, type TransformedConcert } from "./concerts";
import { getArtistInfo } from "@/utils/lastfm";
import { getArtistImageUrl, getArtistWebsiteUrl } from "@/utils/musicbrainz";
import { validateWebsiteUrl } from "@/utils/validation";

export interface TransformedBand {
  id: string;
  name: string;
  slug: string;
  url: string;
  imageUrl?: string | null;
  imageEnrichedAt?: Date | null;
  websiteUrl?: string | null;
  lastfm?: {
    url?: string | null;
    genres?: string[];
    bio?: string | null;
  } | null;
  concert?: TransformedConcert[];
}

function transformBand(band: PrismaBand): Omit<TransformedBand, "concert"> {
  return {
    id: band.id,
    name: band.name,
    slug: band.slug,
    url: `/band/${band.slug}/`,
    imageUrl: band.imageUrl,
    imageEnrichedAt: band.imageEnrichedAt,
    websiteUrl: band.websiteUrl,
    lastfm: band.lastfmUrl
      ? {
          url: band.lastfmUrl,
          genres: band.genres,
          bio: band.bio,
        }
      : null,
  };
}

// Get all bands
export async function getAllBands(): Promise<TransformedBand[]> {
  const bands = await prisma.band.findMany({
    orderBy: { name: "asc" },
  });

  // Get concerts for each band
  const bandsWithConcerts = await Promise.all(
    bands.map(async (band) => {
      const concerts = await getConcertsByBand(band.slug);
      return {
        ...transformBand(band),
        concert: concerts,
      };
    })
  );

  return bandsWithConcerts;
}

// Get band by slug
export async function getBandBySlug(slug: string): Promise<TransformedBand | null> {
  const band = await prisma.band.findUnique({
    where: { slug },
  });

  if (!band) return null;

  const concerts = await getConcertsByBand(slug);
  return {
    ...transformBand(band),
    concert: concerts,
  };
}

// Get band by ID
export async function getBandById(id: string): Promise<TransformedBand | null> {
  const band = await prisma.band.findUnique({
    where: { id },
  });

  if (!band) return null;

  const concerts = await getConcertsByBand(band.slug);
  return {
    ...transformBand(band),
    concert: concerts,
  };
}

// Search bands by name (for autocomplete)
export async function searchBands(query: string, limit = 10): Promise<Omit<TransformedBand, "concert">[]> {
  const bands = await prisma.band.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return bands.map(transformBand);
}

// Create a new band
export interface CreateBandInput {
  name: string;
  slug: string;
  websiteUrl?: string;
  lastfmUrl?: string;
  genres?: string[];
  bio?: string;
  createdById?: string;
}

export async function createBand(input: CreateBandInput): Promise<Omit<TransformedBand, "concert">> {
  const band = await prisma.band.create({
    data: {
      name: input.name,
      slug: input.slug,
      websiteUrl: input.websiteUrl,
      lastfmUrl: input.lastfmUrl,
      genres: input.genres || [],
      bio: input.bio,
      createdById: input.createdById,
    },
  });

  return transformBand(band);
}

// Update band with Last.fm data
export async function updateBandLastfm(
  id: string,
  data: {
    lastfmUrl?: string;
    genres?: string[];
    bio?: string;
    imageUrl?: string;
  }
): Promise<Omit<TransformedBand, "concert"> | null> {
  const band = await prisma.band.update({
    where: { id },
    data: {
      lastfmUrl: data.lastfmUrl,
      genres: data.genres,
      bio: data.bio,
      imageUrl: data.imageUrl,
    },
  });

  return transformBand(band);
}

// Get or create band by name
export async function getOrCreateBand(name: string, createdById?: string): Promise<Omit<TransformedBand, "concert">> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  let band = await prisma.band.findUnique({
    where: { slug },
  });

  if (!band) {
    band = await prisma.band.create({
      data: { name, slug, createdById },
    });
  }

  return transformBand(band);
}

// Update a band's editable fields (admin-only)
export interface UpdateBandInput {
  name?: string;
  websiteUrl?: string | null;
  imageUrl?: string | null;
  updatedById?: string;
}

export async function updateBand(
  slug: string,
  data: UpdateBandInput
): Promise<Omit<TransformedBand, "concert"> | null> {
  const existing = await prisma.band.findUnique({ where: { slug } });
  if (!existing) return null;

  const band = await prisma.band.update({
    where: { slug },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.updatedById && { updatedById: data.updatedById }),
    },
  });
  return transformBand(band);
}

// Get all band slugs (for static generation)
export async function getAllBandSlugs(): Promise<string[]> {
  const bands = await prisma.band.findMany({
    select: { slug: true },
  });

  return bands.map((b) => b.slug);
}

// Enrich a band with external metadata (Last.fm + MusicBrainz image)
export interface EnrichBandOptions {
  imageOnly?: boolean;
}

export async function enrichBandData(
  bandId: string,
  bandName: string,
  options: EnrichBandOptions = {}
): Promise<void> {
  try {
    const { imageOnly = false } = options;

    // Fetch existing band data to preserve admin-set values
    const existingBand = await prisma.band.findUnique({
      where: { id: bandId },
      select: { websiteUrl: true },
    });

    const [lastfmData, musicbrainzImageUrl, musicbrainzWebsiteUrl] =
      await Promise.all([
        imageOnly ? Promise.resolve(null) : getArtistInfo(bandName),
        getArtistImageUrl(bandName),
        getArtistWebsiteUrl(bandName),
      ]);

    if (!lastfmData && !musicbrainzImageUrl && !musicbrainzWebsiteUrl) {
      await prisma.band.update({
        where: { id: bandId },
        data: { imageEnrichedAt: new Date() },
      });
      return;
    }

    const imageUrl =
      musicbrainzImageUrl ||
      lastfmData?.images.extralarge ||
      lastfmData?.images.large ||
      lastfmData?.images.medium ||
      undefined;

    const updateData: Record<string, unknown> = {
      imageEnrichedAt: new Date(),
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    // Only update websiteUrl if band doesn't already have one
    // (preserves admin-set values, auto-populates for new bands)
    if (musicbrainzWebsiteUrl && !existingBand?.websiteUrl) {
      const validatedUrl = validateWebsiteUrl(musicbrainzWebsiteUrl);
      if (validatedUrl) {
        updateData.websiteUrl = validatedUrl;
      }
    }

    if (!imageOnly && lastfmData) {
      updateData.lastfmUrl = lastfmData.url || undefined;
      updateData.genres = lastfmData.genres || [];
      updateData.bio = lastfmData.bio || undefined;
    }

    await prisma.band.update({
      where: { id: bandId },
      data: updateData,
    });
  } catch (err) {
    console.error(`Background enrichment failed for "${bandName}":`, err);
  }
}
