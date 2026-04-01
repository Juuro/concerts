import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: (props: any) => {
    return React.createElement('img', { ...props, alt: props.alt || '' });
  },
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: any) => {
    return React.createElement('a', { href, className, ...props }, children);
  },
}));

// Mock Prisma client for database operations
vi.mock('@/lib/prisma', () => ({
  prisma: {
    concert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      $queryRaw: vi.fn(),
    },
    band: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    festival: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userConcert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    concertBand: {
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(this.prisma)),
    $queryRaw: vi.fn(),
  },
}));

// Mock external utility functions
vi.mock('@/utils/data', () => ({
  getGeocodingData: vi.fn().mockResolvedValue({
    _normalized_city: 'Berlin',
  }),
}));

vi.mock('@/utils/helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/helpers')>();
  return { ...actual };
});
