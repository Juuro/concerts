import { Suspense } from "react";
import "../src/styles/layout.scss";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Providers } from "./providers";
import SessionAwareShell from "./SessionAwareShell";

export const metadata: Metadata = {
  title: "Concerts",
  description:
    "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
  authors: [{ name: "@juuro" }],
  manifest: "/manifest.webmanifest",
};

/** Awaits connection() so the request (and CSP nonce) is available for this render. Must be inside Suspense when cacheComponents is enabled. */
async function RootLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <Providers>
      <Suspense fallback={null}>
        <SessionAwareShell>{children}</SessionAwareShell>
      </Suspense>
    </Providers>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <RootLayoutContent>{children}</RootLayoutContent>
        </Suspense>
      </body>
    </html>
  );
}
