import { ImageResponse } from 'next/og';
import { createElement } from 'react';

import { ConcertsIcon } from '../_icons/ConcertsIcon';

export const runtime = 'edge';

export function GET() {
  // Serve PNG bytes on /favicon.ico to avoid committing a binary .ico file.
  return new ImageResponse(createElement(ConcertsIcon, { glyphSizePct: 78 }), {
    width: 32,
    height: 32,
  });
}

