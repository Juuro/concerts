import { ImageResponse } from 'next/og';

import { ConcertsIcon } from './_icons/ConcertsIcon';

export const runtime = 'edge';
export const contentType = 'image/png';

export const size = {
  width: 180,
  height: 180,
};

export default function AppleIcon() {
  return new ImageResponse(<ConcertsIcon glyphSizePct={74} />, size);
}

