/**
 * URL validation utilities.
 */

/**
 * Validates and normalizes a website URL.
 * Returns normalized URL string if valid, null otherwise.
 *
 * Security: Only allows http and https protocols to prevent XSS via javascript: URLs.
 */
export function validateWebsiteUrl(
  url: string | null | undefined
): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);

    // Only allow http and https protocols (prevent javascript:, data:, etc.)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}
