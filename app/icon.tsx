import { ImageResponse } from 'next/og';

import { ConcertsIcon } from './_icons/ConcertsIcon';

export const runtime = 'edge';
export const contentType = 'image/png';

export const size = {
  width: 32,
  height: 32,
};

export default function Icon() {
  return new ImageResponse(<ConcertsIcon glyphSizePct={78} />, size);
}

