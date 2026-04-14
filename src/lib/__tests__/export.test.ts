import { describe, it, expect } from "vitest"
import { getExportFilename } from "../export"

describe("getExportFilename", () => {
  it("generates filename with current date in YYYY-MM-DD format", () => {
    const filename = getExportFilename("json")
    expect(filename).toMatch(/^concerts-export-\d{4}-\d{2}-\d{2}\.json$/)
  })

  it("generates JSON filename with json extension", () => {
    const filename = getExportFilename("json")
    expect(filename).toMatch(/\.json$/)
    expect(filename).toMatch(/^concerts-export-/)
  })

  it("generates CSV filename with csv extension", () => {
    const filename = getExportFilename("csv")
    expect(filename).toMatch(/\.csv$/)
    expect(filename).toMatch(/^concerts-export-/)
  })

  it("generates consistent filenames for same date", () => {
    const json1 = getExportFilename("json")
    const json2 = getExportFilename("json")
    const csv1 = getExportFilename("csv")
    const csv2 = getExportFilename("csv")

    // Extract date portion (should be same for tests run on same day)
    const jsonDate1 = json1.split(".")[0]
    const jsonDate2 = json2.split(".")[0]
    const csvDate1 = csv1.split(".")[0]
    const csvDate2 = csv2.split(".")[0]

    expect(jsonDate1).toBe(jsonDate2)
    expect(csvDate1).toBe(csvDate2)
  })

  it("uses ISO date format (YYYY-MM-DD)", () => {
    const filename = getExportFilename("json")
    const datePart = filename.split(".")[0].replace("concerts-export-", "")
    const date = new Date(datePart)
    expect(date.toISOString().split("T")[0]).toBe(datePart)
  })
})
