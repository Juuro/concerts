import type { MetadataRoute } from "next"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://concertivity.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/", "/imprint", "/privacy", "/terms", "/login"],
        disallow: [
          "/api/",
          "/band/",
          "/city/",
          "/year/",
          "/concerts/",
          "/settings/",
          "/map",
          "/monitoring",
          "/_next/",
          "/admin/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
