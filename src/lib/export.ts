/**
 * Get the export filename with today's date in YYYY-MM-DD format.
 * Used in both client-side download and server-side response headers.
 */
export function getExportFilename(format: "json" | "csv"): string {
  const date = new Date().toISOString().split("T")[0]
  return `concerts-export-${date}.${format}`
}
