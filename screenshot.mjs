#!/usr/bin/env node
/**
 * Screenshot script for local development.
 *
 * Usage:
 *   node screenshot.mjs <url> [options] [label]
 *   node screenshot.mjs http://localhost:3000/settings my-label
 *   node screenshot.mjs http://localhost:3000/admin scroll=500 my-label
 *   node screenshot.mjs http://localhost:3000/admin scroll=#attention
 *   node screenshot.mjs http://localhost:3000 full
 *
 * Options:
 *   scroll=N        Scroll down by N pixels before capturing
 *   scroll=#id      Scroll to element matching CSS selector
 *   full            Capture the full page (not just viewport)
 *
 * For protected routes, set DEV_USER_EMAIL in .env.local and the script
 * will automatically authenticate before taking the screenshot.
 *
 * Screenshots are saved to ./temporary screenshots/screenshot-N[-label].png
 */

import puppeteer from "puppeteer"
import fs from "fs"
import path from "path"

const SCREENSHOT_DIR = "./temporary screenshots"
const PROTECTED_ROUTES = ["/concerts/new", "/concerts/edit", "/settings", "/map", "/admin"]

async function getNextScreenshotNumber() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
    return 1
  }

  const files = fs.readdirSync(SCREENSHOT_DIR)
  const numbers = files
    .filter((f) => f.startsWith("screenshot-") && f.endsWith(".png"))
    .map((f) => {
      const match = f.match(/^screenshot-(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    })

  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1
}

function isProtectedRoute(url) {
  try {
    const urlObj = new URL(url)
    return PROTECTED_ROUTES.some((route) => urlObj.pathname.startsWith(route))
  } catch {
    return false
  }
}

async function authenticate(page, baseUrl) {
  console.log("Authenticating via dev login endpoint...")

  // Make request from Node.js to get the session cookie
  const response = await fetch(`${baseUrl}/api/dev/login`, { method: "POST" })

  if (!response.ok) {
    const body = await response.json()
    throw new Error(`Dev login failed: ${body.error || response.status}`)
  }

  const body = await response.json()
  const setCookie = response.headers.get("set-cookie")

  if (!setCookie) {
    throw new Error("No session cookie returned from dev login")
  }

  // Parse the cookie value
  const cookieMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
  if (!cookieMatch) {
    throw new Error("Could not parse session cookie")
  }

  // Set the cookie in Puppeteer's browser context
  const url = new URL(baseUrl)
  await page.setCookie({
    name: "better-auth.session_token",
    value: cookieMatch[1],
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  })

  console.log(`Authenticated as: ${body.user.email}`)
}

function parseArgs(args) {
  const url = args[0]
  let scroll = null
  let fullPage = false
  let label = null

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith("scroll=")) {
      scroll = arg.slice(7)
    } else if (arg === "full") {
      fullPage = true
    } else if (!label) {
      label = arg
    }
  }

  return { url, scroll, fullPage, label }
}

async function main() {
  const { url, scroll, fullPage, label } = parseArgs(process.argv.slice(2))

  if (!url) {
    console.error("Usage: node screenshot.mjs <url> [options] [label]")
    console.error("Example: node screenshot.mjs http://localhost:3000/settings")
    console.error("         node screenshot.mjs http://localhost:3000/admin scroll=500")
    console.error("         node screenshot.mjs http://localhost:3000/admin scroll=#section")
    console.error("         node screenshot.mjs http://localhost:3000 full my-label")
    process.exit(1)
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })

    // Check if this is a protected route that needs auth
    if (isProtectedRoute(url)) {
      const urlObj = new URL(url)
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`
      await authenticate(page, baseUrl)
    }

    // Navigate to the target URL
    console.log(`Navigating to: ${url}`)
    await page.goto(url, { waitUntil: "networkidle0" })

    // Wait a bit for any animations to settle
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 500)))

    // Handle scrolling
    if (scroll) {
      if (/^\d+$/.test(scroll)) {
        // Scroll by pixels
        const pixels = parseInt(scroll, 10)
        console.log(`Scrolling down ${pixels}px...`)
        await page.evaluate((y) => window.scrollBy(0, y), pixels)
      } else {
        // Scroll to CSS selector
        console.log(`Scrolling to element: ${scroll}`)
        const element = await page.$(scroll)
        if (element) {
          await element.scrollIntoView({ behavior: "instant", block: "start" })
        } else {
          console.warn(`Warning: Element "${scroll}" not found, skipping scroll`)
        }
      }
      // Wait for scroll to settle
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)))
    }

    // Generate filename
    const num = await getNextScreenshotNumber()
    const filename = label ? `screenshot-${num}-${label}.png` : `screenshot-${num}.png`
    const filepath = path.join(SCREENSHOT_DIR, filename)

    // Take screenshot
    await page.screenshot({ path: filepath, fullPage })
    console.log(`Screenshot saved: ${filepath}`)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error("Screenshot failed:", err.message)
  process.exit(1)
})
