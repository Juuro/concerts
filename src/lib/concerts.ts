import { prisma } from "./prisma";
import type { Concert as PrismaConcert, Band as PrismaBand, Festival as PrismaFestival, ConcertBand } from "@/generated/prisma";

// Types matching the existing app structure
export interface TransformedBand {
  id: string;
  name: string;
  slug: string;
  url: string;
  imageUrl?: string | null;
  lastfm?: {
    url?: string | null;
    genres?: string[];
    bio?: string | null;
  } | null;
}

export interface TransformedConcert {
  id: string;
  date: string;
  city: {
    lat: number;
    lon: number;
  };
  club?: string | null;
  bands: TransformedBand[];
  isFestival: boolean;
  festival: {
    fields: {
      name: string;
      url?: string | null;
    };
  } | null;
  fields: {
    geocoderAddressFields: {
      _normalized_city: string;
      city?: string;
      country?: string;
    };
  };
}

type ConcertWithRelations = PrismaConcert & {
  bands: (ConcertBand & { band: PrismaBand })[];
  festival: PrismaFestival | null;
};

function transformConcert(concert: ConcertWithRelations): TransformedConcert {
  return {
    id: concert.id,
    date: concert.date.toISOString(),
    city: {
      lat: concert.latitude,
      lon: concert.longitude,
    },
    club: concert.club,
    bands: concert.bands
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cb) => ({
        id: cb.band.id,
        name: cb.band.name,
        slug: cb.band.slug,
        url: `/band/${cb.band.slug}/`,
        imageUrl: cb.band.imageUrl,
        lastfm: cb.band.lastfmUrl
          ? {
              url: cb.band.lastfmUrl,
              genres: cb.band.genres,
              bio: cb.band.bio,
            }
          : null,
      })),
    isFestival: concert.isFestival,
    festival: concert.festival
      ? {
          fields: {
            name: concert.festival.name,
            url: concert.festival.url,
          },
        }
      : null,
    fields: {
      geocoderAddressFields: {
        _normalized_city: concert.city || `${concert.latitude.toFixed(3)}, ${concert.longitude.toFixed(3)}`,
        city: concert.city || undefined,
      },
    },
  };
}

// Get all concerts for a user
export async function getUserConcerts(userId: string): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: { userId },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  });

  return concerts.map(transformConcert);
}

// Get all concerts (public, for global views)
export async function getAllConcerts(): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  });

  return concerts.map(transformConcert);
}

// Get concerts by band slug
export async function getConcertsByBand(slug: string): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      bands: {
        some: {
          band: { slug },
        },
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  });

  return concerts.map(transformConcert);
}

// Get concerts by year
export async function getConcertsByYear(year: number | string): Promise<TransformedConcert[]> {
  const yearNum = typeof year === "string" ? parseInt(year, 10) : year;
  const startDate = new Date(yearNum, 0, 1);
  const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);

  const concerts = await prisma.concert.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  });

  return concerts.map(transformConcert);
}

// Get concerts by city
export async function getConcertsByCity(cityName: string): Promise<TransformedConcert[]> {
  const concerts = await prisma.concert.findMany({
    where: { city: cityName },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
    orderBy: { date: "desc" },
  });

  return concerts.map(transformConcert);
}

// Get all unique years
export async function getAllYears(): Promise<string[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      date: { lte: new Date() },
    },
    select: { date: true },
  });

  const years = new Set<string>();
  concerts.forEach((concert) => {
    years.add(concert.date.getFullYear().toString());
  });

  return Array.from(years).sort();
}

// Get all unique cities
export async function getAllCities(): Promise<string[]> {
  const concerts = await prisma.concert.findMany({
    where: {
      city: { not: null },
    },
    select: { city: true },
    distinct: ["city"],
  });

  return concerts
    .map((c) => c.city)
    .filter((city): city is string => city !== null)
    .sort();
}

// Concert CRUD operations

export interface CreateConcertInput {
  userId: string;
  date: Date;
  latitude: number;
  longitude: number;
  city?: string;
  club?: string;
  isFestival?: boolean;
  festivalId?: string;
  bandIds: { bandId: string; isHeadliner?: boolean }[];
}

export async function createConcert(input: CreateConcertInput): Promise<TransformedConcert> {
  const concert = await prisma.concert.create({
    data: {
      userId: input.userId,
      date: input.date,
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city,
      club: input.club,
      isFestival: input.isFestival || false,
      festivalId: input.festivalId,
      bands: {
        create: input.bandIds.map((b, index) => ({
          bandId: b.bandId,
          isHeadliner: b.isHeadliner || false,
          sortOrder: index,
        })),
      },
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  });

  return transformConcert(concert);
}

export interface UpdateConcertInput {
  date?: Date;
  latitude?: number;
  longitude?: number;
  city?: string;
  club?: string;
  isFestival?: boolean;
  festivalId?: string | null;
  bandIds?: { bandId: string; isHeadliner?: boolean }[];
}

export async function updateConcert(
  id: string,
  userId: string,
  input: UpdateConcertInput
): Promise<TransformedConcert | null> {
  // Verify ownership
  const existing = await prisma.concert.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return null;
  }

  // If updating bands, delete existing and create new
  if (input.bandIds) {
    await prisma.concertBand.deleteMany({
      where: { concertId: id },
    });
  }

  const concert = await prisma.concert.update({
    where: { id },
    data: {
      date: input.date,
      latitude: input.latitude,
      longitude: input.longitude,
      city: input.city,
      club: input.club,
      isFestival: input.isFestival,
      festivalId: input.festivalId,
      ...(input.bandIds && {
        bands: {
          create: input.bandIds.map((b, index) => ({
            bandId: b.bandId,
            isHeadliner: b.isHeadliner || false,
            sortOrder: index,
          })),
        },
      }),
    },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  });

  return transformConcert(concert);
}

export async function deleteConcert(id: string, userId: string): Promise<boolean> {
  const existing = await prisma.concert.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return false;
  }

  await prisma.concert.delete({
    where: { id },
  });

  return true;
}

export async function getConcertById(id: string): Promise<TransformedConcert | null> {
  const concert = await prisma.concert.findUnique({
    where: { id },
    include: {
      bands: {
        include: { band: true },
        orderBy: { sortOrder: "asc" },
      },
      festival: true,
    },
  });

  if (!concert) return null;
  return transformConcert(concert);
}
