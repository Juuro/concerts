#!/usr/bin/env node
/**
 * Deletes screenshots older than 14 days from the "temporary screenshots" directory.
 *
 * Usage:
 *   node scripts/cleanup-screenshots.mjs
 *   yarn cleanup:screenshots
 */

import fs from "fs"
import path from "path"

const SCREENSHOT_DIR = "./temporary screenshots"
const MAX_AGE_DAYS = 14

if (!fs.existsSync(SCREENSHOT_DIR)) {
  console.log("No screenshot directory found. Nothing to clean up.")
  process.exit(0)
}

const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
const files = fs.readdirSync(SCREENSHOT_DIR).filter((f) => f.endsWith(".png"))

let deleted = 0

for (const file of files) {
  const filePath = path.join(SCREENSHOT_DIR, file)
  const { mtimeMs } = fs.statSync(filePath)

  if (mtimeMs < cutoff) {
    fs.unlinkSync(filePath)
    console.log(`Deleted: ${file}`)
    deleted++
  }
}

console.log(`\nDone. Deleted ${deleted} file(s), ${files.length - deleted} remaining.`)
