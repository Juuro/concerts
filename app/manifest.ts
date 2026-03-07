import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Concerts',
    short_name: 'Concerts',
    description: 'Track your personal concert attendance history',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ff0666',
    icons: [
      {
        src: '/icon/32',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
