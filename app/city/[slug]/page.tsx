import React from 'react';
import { notFound } from 'next/navigation';
import Layout from '../../../src/components/layout-client';
import ConcertCard from '../../../src/components/ConcertCard/concertCard';
import ConcertCount from '../../../src/components/ConcertCount/concertCount';
import { getAllCities, getConcertsByCity, getAllConcerts } from '@/lib/concerts';
import { cityToSlug, findCityBySlug } from '../../../src/utils/helpers';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const cities = await getAllCities();
  return cities.map((city) => ({
    slug: cityToSlug(city),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cities = await getAllCities();
  const city = findCityBySlug(slug, cities);

  return {
    title: `${city || slug} | Concerts`,
  };
}

export default async function CityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cities = await getAllCities();
  const cityName = findCityBySlug(slug, cities);

  if (!cityName) {
    notFound();
  }

  const [concerts, allConcerts] = await Promise.all([
    getConcertsByCity(cityName),
    getAllConcerts(),
  ]);

  // Transform for layout
  const allConcertsFormatted = allConcerts.map((c) => ({
    ...c,
    bands: c.bands.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      url: b.url,
    })),
  }));

  const concertsFormatted = {
    edges: concerts.map(c => ({ node: c })),
    totalCount: concerts.length,
  };

  return (
    <Layout concerts={allConcertsFormatted}>
      <main>
        <div className="container">
          <h2>
            {cityName}
            <ConcertCount concerts={concertsFormatted} />
          </h2>

          <ul className="list-unstyled">
            {concerts.map((concert) => (
              <ConcertCard
                key={concert.id}
                concert={{
                  ...concert,
                  bands: concert.bands.map((b) => ({
                    id: b.id,
                    name: b.name,
                    slug: b.slug,
                    url: b.url,
                  })),
                }}
              />
            ))}
          </ul>
        </div>
      </main>
    </Layout>
  );
}
