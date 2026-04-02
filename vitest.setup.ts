import '@testing-library/jest-dom/vitest';
import type { ImageProps } from 'next/image';
import type { LinkProps } from 'next/link';
import { vi } from 'vitest';
import React from 'react';

// Mock Next.js Image component (strip Next-only props so React does not forward invalid DOM attributes)
vi.mock('next/image', () => ({
  default: (props: ImageProps) => {
    const {
      fill: _f,
      priority: _p,
      placeholder: _ph,
      blurDataURL: _b,
      onLoadingComplete: _o,
      loader: _l,
      quality: _q,
      unoptimized: _u,
      preload: _preload,
      overrideSrc: _overrideSrc,
      layout: _layout,
      objectFit: _objectFit,
      objectPosition: _objectPosition,
      lazyBoundary: _lazyBoundary,
      lazyRoot: _lazyRoot,
      ...imgProps
    } = props;
    return React.createElement('img', {
      ...(imgProps as React.ImgHTMLAttributes<HTMLImageElement>),
      alt: props.alt ?? '',
    });
  },
}));

// Mock Next.js Link component (strip Next-only props so React does not forward invalid DOM attributes)
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    locale: _locale,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    onNavigate: _onNavigate,
    as: _as,
    ...anchorProps
  }: React.PropsWithChildren<LinkProps>) => {
    return React.createElement('a', { href, ...anchorProps }, children);
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
