import { vi } from "vitest"

/**
 * Prisma mock helpers.
 *
 * Next.js `yarn build` type-checks these Vitest mocks, so we cast the mocked
 * Prisma methods to `any` before `mockImplementation` to satisfy Prisma's
 * `PrismaPromise` typing.
 */
export function mockConcertCountPastFuture(
  prisma: any,
  args: { past: number; future: number },
): void {
  vi.mocked(prisma.concert.count as any).mockImplementation((whereArgs: any) => {
    if (whereArgs?.where?.date?.lt) return Promise.resolve(args.past)
    if (whereArgs?.where?.date?.gte) return Promise.resolve(args.future)
    return Promise.resolve(0)
  })
}

