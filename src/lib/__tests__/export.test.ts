import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getExportFilename } from "../export"

describe("getExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-04-14T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("generates filename with current date in YYYY-MM-DD format", () => {
    const filename = getExportFilename("json")
    expect(filename).toBe("concerts-export-2026-04-14.json")
  })

  it("generates JSON filename with json extension", () => {
    const filename = getExportFilename("json")
    expect(filename).toMatch(/\.json$/)
    expect(filename).toMatch(/^concerts-export-/)
  })

  it("generates CSV filename with csv extension", () => {
    const filename = getExportFilename("csv")
    expect(filename).toBe("concerts-export-2026-04-14.csv")
  })

  it("generates consistent filenames for same date", () => {
    const json1 = getExportFilename("json")
    const json2 = getExportFilename("json")
    const csv1 = getExportFilename("csv")
    const csv2 = getExportFilename("csv")

    expect(json1).toBe(json2)
    expect(csv1).toBe(csv2)
  })

  it("uses ISO date format (YYYY-MM-DD)", () => {
    const filename = getExportFilename("json")
    expect(filename).toBe("concerts-export-2026-04-14.json")
  })

  it("handles different dates correctly", () => {
    vi.setSystemTime(new Date("2025-12-31T23:59:59Z"))
    expect(getExportFilename("json")).toBe("concerts-export-2025-12-31.json")

    vi.setSystemTime(new Date("2027-01-01T00:00:00Z"))
    expect(getExportFilename("csv")).toBe("concerts-export-2027-01-01.csv")
  })
})
