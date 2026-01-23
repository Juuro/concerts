import React from 'react';
import Layout from '../../src/components/layout-client';
import MapClient from '../../src/components/MapClient';
import { getAllConcerts } from '../../src/utils/data';
import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Map | Concerts',
  description: 'Map of all concerts',
};

export default async function MapPage() {
  const concerts = await getAllConcerts();

  return (
    <Layout concerts={concerts}>
      <MapClient concerts={concerts} />
    </Layout>
  );
}
