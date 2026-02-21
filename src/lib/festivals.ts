import { prisma } from "./prisma";
import type { Festival as PrismaFestival } from "@/generated/prisma/client";

export interface TransformedFestival {
  id: string;
  name: string;
  slug: string;
  url?: string | null;
}

function transformFestival(festival: PrismaFestival): TransformedFestival {
  return {
    id: festival.id,
    name: festival.name,
    slug: festival.slug,
    url: festival.url,
  };
}

// Get all festivals
export async function getAllFestivals(): Promise<TransformedFestival[]> {
  const festivals = await prisma.festival.findMany({
    orderBy: { name: "asc" },
  });

  return festivals.map(transformFestival);
}

// Get festival by slug
export async function getFestivalBySlug(slug: string): Promise<TransformedFestival | null> {
  const festival = await prisma.festival.findUnique({
    where: { slug },
  });

  if (!festival) return null;
  return transformFestival(festival);
}

// Get festival by ID
export async function getFestivalById(id: string): Promise<TransformedFestival | null> {
  const festival = await prisma.festival.findUnique({
    where: { id },
  });

  if (!festival) return null;
  return transformFestival(festival);
}

// Search festivals by name
export async function searchFestivals(query: string, limit = 10): Promise<TransformedFestival[]> {
  const festivals = await prisma.festival.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: limit,
    orderBy: { name: "asc" },
  });

  return festivals.map(transformFestival);
}

// Create a new festival
export interface CreateFestivalInput {
  name: string;
  slug: string;
  url?: string;
  createdById?: string;
}

export async function createFestival(input: CreateFestivalInput): Promise<TransformedFestival> {
  const festival = await prisma.festival.create({
    data: {
      name: input.name,
      slug: input.slug,
      url: input.url,
      createdById: input.createdById,
    },
  });

  return transformFestival(festival);
}

// Get or create festival by name
export async function getOrCreateFestival(name: string, url?: string, createdById?: string): Promise<TransformedFestival> {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  let festival = await prisma.festival.findUnique({
    where: { slug },
  });

  if (!festival) {
    festival = await prisma.festival.create({
      data: { name, slug, url, createdById },
    });
  }

  return transformFestival(festival);
}
