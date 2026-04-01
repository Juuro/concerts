// Fork Logic Tests - TO BE APPENDED to src/lib/concerts.test.ts
// These tests address DA3 HIGH severity finding: forkConcertForUser is NOT tested in base plan

describe('Fork Logic (Multi-Tenant)', () => {
  /**
   * Fork triggers when:
   * 1. Concert has multiple attendees (_count.attendees > 1)
   * 2. Core fields change: date, venue, latitude, longitude, or headliner band
   *
   * Fork behavior:
   * - Creates new concert with edited data
   * - Removes user from original concert
   * - Preserves user's cost, notes, supportingActIds
   * - Deletes original concert if orphaned (no remaining attendees)
   * - Keeps original concert if other attendees remain
   * - Calls getGeocodingData for new location
   */

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('updateConcert multi-attendee forks on date change', async () => {
    const userId = 'user-1'
    const originalDate = new Date('2024-06-15')
    const newDate = new Date('2024-06-16')

    const existingConcert = {
      id: 'concert-1',
      date: originalDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-1',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-1', name: 'Band A', slug: 'band-a' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-1', cost: 50, notes: 'Great show' }],
      _count: { attendees: 2 }, // Multi-attendee triggers fork
    }

    const newConcert = {
      id: 'concert-2',
      date: newDate,
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Venue A',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-1',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-1', name: 'Band A', slug: 'band-a' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-1', cost: 50, notes: 'Great show' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-1',
      userId,
      concertId: 'concert-1',
      cost: 50,
      notes: 'Great show',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    // Mock $transaction to execute callback
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    // Mock transaction operations
    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null) // No matching concert

    const result = await updateConcert('concert-1', userId, { date: newDate })

    expect(result).toBeTruthy()
    expect(result?.id).toBe('concert-2')
    expect(result?.date).toBe(newDate.toISOString())

    // Verify fork transaction steps
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: { userId_concertId: { userId, concertId: 'concert-1' } },
    })
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          date: newDate,
          createdById: userId,
        }),
      })
    )
  })

  test('updateConcert multi-attendee forks on venue change', async () => {
    const userId = 'user-2'

    const existingConcert = {
      id: 'concert-3',
      date: new Date('2024-07-20'),
      latitude: 51.5,
      longitude: -0.1,
      venue: 'Old Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-2',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-2', name: 'Band B', slug: 'band-b' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-2', cost: 60, notes: null }],
      _count: { attendees: 3 }, // Multi-attendee
    }

    const newConcert = {
      id: 'concert-4',
      date: new Date('2024-07-20'),
      latitude: 51.5,
      longitude: -0.1,
      venue: 'New Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-2',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-2', name: 'Band B', slug: 'band-b' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-2', cost: 60, notes: null }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-2',
      userId,
      concertId: 'concert-3',
      cost: 60,
      notes: null,
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert('concert-3', userId, { venue: 'New Venue' })

    expect(result).toBeTruthy()
    expect(result?.venue).toBe('New Venue')
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test('updateConcert multi-attendee forks on headliner change', async () => {
    const userId = 'user-3'

    const existingConcert = {
      id: 'concert-5',
      date: new Date('2024-08-10'),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      normalizedCity: 'paris',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-3',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-3', name: 'Band C', slug: 'band-c' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-3', cost: 75, notes: 'Amazing' }],
      _count: { attendees: 2 },
    }

    const newConcert = {
      id: 'concert-6',
      date: new Date('2024-08-10'),
      latitude: 48.8566,
      longitude: 2.3522,
      venue: 'Paris Arena',
      normalizedCity: 'paris',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-4',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-4', name: 'Band D', slug: 'band-d' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-3', cost: 75, notes: 'Amazing' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-3',
      userId,
      concertId: 'concert-5',
      cost: 75,
      notes: 'Amazing',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(newConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    const result = await updateConcert('concert-5', userId, {
      bandIds: [{ bandId: 'band-4', isHeadliner: true }],
    })

    expect(result).toBeTruthy()
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bands: expect.objectContaining({
            create: expect.objectContaining({
              bandId: 'band-4',
              isHeadliner: true,
            }),
          }),
        }),
      })
    )
  })

  test('fork creates new concert and removes user from original', async () => {
    const userId = 'user-fork-1'

    const existingConcert = {
      id: 'concert-original',
      date: new Date('2024-09-01'),
      latitude: 40.7128,
      longitude: -74.006,
      venue: 'Original Venue',
      normalizedCity: 'new-york',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-fork',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-fork', name: 'Fork Band', slug: 'fork-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-fork-1', cost: 100, notes: 'Fork test' }],
      _count: { attendees: 2 },
    }

    const forkedConcert = {
      id: 'concert-forked',
      date: new Date('2024-09-02'), // Date changed
      latitude: 40.7128,
      longitude: -74.006,
      venue: 'Original Venue',
      normalizedCity: 'new-york',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-fork',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-fork', name: 'Fork Band', slug: 'fork-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-fork-1', cost: 100, notes: 'Fork test' }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-fork',
      userId,
      concertId: 'concert-original',
      cost: 100,
      notes: 'Fork test',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-original', userId, {
      date: new Date('2024-09-02'),
    })

    // Verify user removed from original
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: {
        userId_concertId: { userId, concertId: 'concert-original' },
      },
    })

    // Verify new concert created
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.objectContaining({
            create: expect.objectContaining({ userId }),
          }),
        }),
      })
    )
  })

  test('fork preserves user cost and notes', async () => {
    const userId = 'user-preserve'
    const userCost = 150
    const userNotes = 'VIP ticket with backstage pass'

    const existingConcert = {
      id: 'concert-preserve',
      date: new Date('2024-10-15'),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: 'LA Venue',
      normalizedCity: 'los-angeles',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-preserve',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-preserve', name: 'Preserve Band', slug: 'preserve-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-preserve', cost: userCost, notes: userNotes }],
      _count: { attendees: 2 },
    }

    const forkedConcert = {
      id: 'concert-forked-preserve',
      date: new Date('2024-10-16'),
      latitude: 34.0522,
      longitude: -118.2437,
      venue: 'LA Venue',
      normalizedCity: 'los-angeles',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-preserve',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-preserve', name: 'Preserve Band', slug: 'preserve-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-preserve', cost: userCost, notes: userNotes }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-preserve',
      userId,
      concertId: 'concert-preserve',
      cost: userCost,
      notes: userNotes,
      supportingActIds: [{ bandId: 'support-1', sortOrder: 0 }],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-preserve', userId, {
      date: new Date('2024-10-16'),
    })

    // Verify cost and notes preserved in new concert
    expect(prisma.concert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendees: expect.objectContaining({
            create: expect.objectContaining({
              userId,
              cost: userCost,
              notes: userNotes,
              supportingActIds: [{ bandId: 'support-1', sortOrder: 0 }],
            }),
          }),
        }),
      })
    )
  })

  test('fork does NOT delete original if other attendees remain', async () => {
    const userId = 'user-keep-original'

    const existingConcert = {
      id: 'concert-keep',
      date: new Date('2024-11-20'),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: 'London Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-keep',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-keep', name: 'Keep Band', slug: 'keep-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-keep-original', cost: 80, notes: null }],
      _count: { attendees: 3 }, // 3 attendees, so original should remain
    }

    const forkedConcert = {
      id: 'concert-forked-keep',
      date: new Date('2024-11-21'),
      latitude: 51.5074,
      longitude: -0.1278,
      venue: 'London Venue',
      normalizedCity: 'london',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-keep',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-keep', name: 'Keep Band', slug: 'keep-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-keep-original', cost: 80, notes: null }],
      _count: { attendees: 1 },
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-keep',
      userId,
      concertId: 'concert-keep',
      cost: 80,
      notes: null,
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(existingConcert)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      return await callback(prisma as any)
    })

    vi.mocked(prisma.userConcert.delete).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.concert.create).mockResolvedValueOnce(forkedConcert as any)
    vi.mocked(prisma.concert.findUnique).mockResolvedValueOnce(null)

    await updateConcert('concert-keep', userId, {
      date: new Date('2024-11-21'),
    })

    // Verify original concert is NOT deleted (3 attendees -> 2 after fork)
    expect(prisma.concert.delete).not.toHaveBeenCalledWith({
      where: { id: 'concert-keep' },
    })

    // User removed from original, new concert created
    expect(prisma.userConcert.delete).toHaveBeenCalledWith({
      where: {
        userId_concertId: { userId, concertId: 'concert-keep' },
      },
    })
    expect(prisma.concert.create).toHaveBeenCalled()
  })

  test('updateConcert single attendee does NOT fork (updates in place)', async () => {
    const userId = 'user-single'

    const existingConcert = {
      id: 'concert-single',
      date: new Date('2024-12-01'),
      latitude: 52.52,
      longitude: 13.405,
      venue: 'Single Venue',
      normalizedCity: 'berlin',
      isFestival: false,
      festivalId: null,
      bands: [
        {
          bandId: 'band-single',
          isHeadliner: true,
          sortOrder: 0,
          band: { id: 'band-single', name: 'Single Band', slug: 'single-band' },
        },
      ],
      festival: null,
      attendees: [{ userId: 'user-single', cost: 45, notes: 'Solo show' }],
      _count: { attendees: 1 }, // Single attendee = no fork
    }

    const updatedConcert = {
      ...existingConcert,
      date: new Date('2024-12-02'),
    }

    vi.mocked(prisma.userConcert.findUnique).mockResolvedValueOnce({
      id: 'attendance-single',
      userId,
      concertId: 'concert-single',
      cost: 45,
      notes: 'Solo show',
      supportingActIds: [],
    })

    vi.mocked(prisma.concert.findUnique)
      .mockResolvedValueOnce(existingConcert)
      .mockResolvedValueOnce(updatedConcert)

    vi.mocked(prisma.concert.update).mockResolvedValueOnce(updatedConcert as any)

    const result = await updateConcert('concert-single', userId, {
      date: new Date('2024-12-02'),
    })

    expect(result).toBeTruthy()

    // Verify update called (not fork)
    expect(prisma.concert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'concert-single' },
      })
    )

    // Verify fork NOT triggered
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.userConcert.delete).not.toHaveBeenCalled()
    expect(prisma.concert.create).not.toHaveBeenCalled()
  })
})
