/** Normalize band name for deduplication (not for display). */
export function normalizeBandSearchKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
