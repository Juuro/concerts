import { ImageResponse } from 'next/og';

import { TicketIcon } from './_icons/TicketIcon';

export const contentType = 'image/png';

export function generateImageMetadata() {
  return [
    { id: '32', size: { width: 32, height: 32 }, contentType: 'image/png' },
    { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
    { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const iconId = await id;
  const size = parseInt(iconId, 10);
  return new ImageResponse(<TicketIcon />, { width: size, height: size });
}

