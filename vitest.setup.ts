import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import React from 'react';

// Mock Next.js Image component (strip Next-only props so React does not forward invalid DOM attributes)
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const {
      fill: _f,
      priority: _p,
      placeholder: _ph,
      blurDataURL: _b,
      onLoadingComplete: _o,
      loader: _l,
      quality: _q,
      unoptimized: _u,
      ...imgProps
    } = props;
    return React.createElement('img', {
      ...imgProps,
      alt: (props.alt as string) || '',
    });
  },
}));

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: any) => {
    return React.createElement('a', { href, className, ...props }, children);
  },
}));

// Mock Prisma client for database operations
vi.mock('@/lib/prisma', () => {
  const prismaModels = {
    concert: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    band: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    festival: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
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
  };

  const prismaMock = {
    ...prismaModels,
    $queryRaw: vi.fn(),
    $transaction: vi.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return Promise.resolve(arg(prismaMock));
      }
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return Promise.resolve(undefined);
    }),
  };

  return { prisma: prismaMock };
});

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
