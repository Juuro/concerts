import '../src/styles/layout.scss';
import type { Metadata } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Concerts',
  description: "List of all concerts and festivals I've visited. Including pages for every band I ever saw.",
  authors: [{ name: '@juuro' }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
