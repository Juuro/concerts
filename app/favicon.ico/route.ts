import { ImageResponse } from 'next/og';
import { createElement } from 'react';

import { TicketIcon } from '../_icons/TicketIcon';

export const runtime = 'edge';

export function GET() {
  // Serve PNG bytes on /favicon.ico to avoid committing a binary .ico file.
  return new ImageResponse(createElement(TicketIcon), {
    width: 32,
    height: 32,
  });
}

