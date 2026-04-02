/**
 * Returns today's date at UTC midnight (00:00:00.000Z).
 * Used for date comparisons to ensure "today" is treated as future.
 */
export function getStartOfToday(): Date {
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return now
}
