import { Suspense } from "react"
import "../src/styles/layout.scss"
import type { Metadata } from "next"
import { Providers } from "./providers"
import SessionAwareShell from "./SessionAwareShell"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://concertivity.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Concertivity",
    template: "%s | Concertivity",
  },
  description:
    "Track every concert you've ever attended. Discover your top bands, favourite cities, and most active years — all in one place.",
  authors: [{ name: "@juuro" }],
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Concertivity",
    locale: "en_US",
    url: siteUrl,
    title: "Concertivity",
    description:
      "Track every concert you've ever attended. Discover your top bands, favourite cities, and most active years — all in one place.",
  },
  twitter: {
    card: "summary",
    title: "Concertivity",
    description:
      "Track every concert you've ever attended. Discover your top bands, favourite cities, and most active years — all in one place.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Suspense fallback={null}>
            <SessionAwareShell>{children}</SessionAwareShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}
