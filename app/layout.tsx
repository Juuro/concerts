import { Suspense } from 'react';
import '../src/styles/layout.scss';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Concerts',
  description: "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
  authors: [{ name: '@juuro' }],
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
        </Providers>
      </body>
    </html>
  );
}
